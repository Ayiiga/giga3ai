import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// ─── Helper: get key from DB first, fallback to env ──

async function getKey(ctx: any, name: string): Promise<string | null> {
  const dbVal: string | null = await ctx.runQuery(internal.settings.getSetting, { key: name });
  if (dbVal) return dbVal;
  return null;
}

// ─── Helper: fetch with timeout ──────────────────────

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = 15000): Promise<Response> {
  const AbortControllerCtor = (globalThis as any).AbortController;
  const fetchFn = (globalThis as any).fetch;
  const controller = new AbortControllerCtor();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Check if Paystack is configured ─────────────────

export const isConfigured = action({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const pk = await getKey(ctx, "PAYSTACK_PUBLIC_KEY");
    const sk = await getKey(ctx, "PAYSTACK_SECRET_KEY");
    return !!pk && !!sk;
  },
});

export const getPublicKey = action({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    return await getKey(ctx, "PAYSTACK_PUBLIC_KEY");
  },
});

// ─── Prepare Payment ─────────────────────────────────

export const preparePayment = action({
  args: {
    productId: v.id("marketplaceProducts"),
    userId: v.string(),
    email: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    publicKey: v.optional(v.string()),
    reference: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const publicKey = await getKey(ctx, "PAYSTACK_PUBLIC_KEY");
    if (!publicKey) {
      return { success: false, error: "Payment system not configured. Contact support." };
    }

    // Get product details
    const product: any = await ctx.runQuery(api.marketplace.getProduct, {
      productId: args.productId,
    });
    if (!product) {
      return { success: false, error: "Product not found." };
    }
    if (product.price === 0) {
      return { success: false, error: "This product is free. No payment needed." };
    }

    // Generate unique reference
    const reference = `giga3_${Date.now()}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

    // Create pending purchase
    await ctx.runMutation(api.marketplace.createPendingPurchase, {
      userId: args.userId,
      productId: args.productId,
      price: product.price,
      currency: product.currency || "GHS",
      paystackReference: reference,
    });

    return {
      success: true,
      publicKey,
      reference,
      amount: product.price,
      currency: product.currency || "GHS",
    };
  },
});

// ─── Verify Payment ──────────────────────────────────

export const verifyPayment = action({
  args: {
    reference: v.string(),
    userId: v.string(),
    purchaseType: v.optional(v.union(v.literal('product'), v.literal('credit'))),
    creditAmount: v.optional(v.number()),
    purchaseLabel: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const secretKey = await getKey(ctx, "PAYSTACK_SECRET_KEY");
    if (!secretKey) {
      return { success: false, error: "Payment verification unavailable." };
    }

    try {
      const response = await fetchWithTimeout(
        `https://api.paystack.co/transaction/verify/${args.reference}`,
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data.status && data.data?.status === "success") {
        if (args.purchaseType === 'credit') {
          const amount = Math.max(0, Math.floor(args.creditAmount ?? 0));
          const granted = amount > 0
            ? await ctx.runMutation(api.credits.grantCredits, {
                userId: args.userId,
                amount,
                source: 'paystack-credit-voucher',
                reference: args.reference,
                note: args.purchaseLabel ? `Credit voucher: ${args.purchaseLabel}` : 'Credit voucher',
              })
            : { success: false };
          if (granted.success) {
            return { success: true };
          }
          return { success: false, error: 'Could not confirm the credit voucher.' };
        }

        const completed: boolean = await ctx.runMutation(api.marketplace.completePurchase, {
          paystackReference: args.reference,
        });
        if (completed) {
          return { success: true };
        }
        return { success: false, error: "Could not update purchase record." };
      } else {
        return { success: false, error: data.data?.gateway_response || "Payment not confirmed." };
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return { success: false, error: "Verification timed out. Tap Retry." };
      }
      return { success: false, error: "Verification failed. Please try again." };
    }
  },
});

// ─── Prepare Subscription Payment ────────────────────

export const prepareSubscription = action({
  args: {
    userId: v.string(),
    email: v.string(),
    plan: v.string(),
    amount: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    publicKey: v.optional(v.string()),
    reference: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const publicKey = await getKey(ctx, "PAYSTACK_PUBLIC_KEY");
    if (!publicKey) {
      return { success: false, error: "Payment system not configured." };
    }

    const reference = `giga3_sub_${args.plan}_${Date.now()}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

    return {
      success: true,
      publicKey,
      reference,
      amount: args.amount,
      currency: "GHS",
    };
  },
});

// ─── Verify Subscription Payment ─────────────────────

export const verifySubscription = action({
  args: {
    reference: v.string(),
    userId: v.string(),
    plan: v.string(),
    amount: v.number(),
    billingPeriod: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const secretKey = await getKey(ctx, "PAYSTACK_SECRET_KEY");
    if (!secretKey) {
      return { success: false, error: "Payment verification unavailable." };
    }

    try {
      const response = await fetchWithTimeout(
        `https://api.paystack.co/transaction/verify/${args.reference}`,
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data.status && data.data?.status === "success") {
        const active: any = await ctx.runQuery(api.subscriptions.getActive, { userId: args.userId });
        if (active) {
          await ctx.runMutation(api.subscriptions.renew, {
            subscriptionId: active._id,
            paystackReference: args.reference,
            amount: args.amount,
          });
        } else {
          await ctx.runMutation(api.subscriptions.create, {
            userId: args.userId,
            plan: args.plan,
            amount: args.amount,
            currency: "GHS",
            paystackReference: args.reference,
            billingPeriod: args.billingPeriod ?? (args.plan.includes("year") ? "yearly" : "monthly"),
            entitlement: "premium",
          });
        }
        return { success: true };
      } else {
        return { success: false, error: data.data?.gateway_response || "Payment not confirmed." };
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return { success: false, error: "Verification timed out. Tap Retry." };
      }
      return { success: false, error: "Verification failed. Please try again." };
    }
  },
});

async function rewardReferralIfPresent(ctx: any, buyerId: string, buyerEmail: string | undefined, orderId: string, amount: number, currency: string) {
  if (!buyerEmail) return;
  const referral = await ctx.runQuery(internal.referrals.getReferralCodeByEmail, { email: buyerEmail });
  if (!referral?.code) return;
  await ctx.runMutation(internal.referrals.rewardReferralPurchase, {
    code: referral.code,
    purchaserId: buyerId,
    orderId,
    amount,
  });
}