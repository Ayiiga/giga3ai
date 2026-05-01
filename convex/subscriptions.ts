import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const BILLING_DAYS: Record<string, number> = {
  monthly: 30,
  yearly: 365,
};

function billingWindowMs(plan: string) {
  const days = BILLING_DAYS[plan] ?? 30;
  return days * 24 * 60 * 60 * 1000;
}

// ─── Get active subscription for a user ──────────────

export const getActive = query({
  args: { userId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("subscriptions"),
      plan: v.string(),
      amount: v.number(),
      currency: v.string(),
      status: v.string(),
      startDate: v.number(),
      expiryDate: v.number(),
      billingPeriod: v.union(v.string(), v.null()),
      renewalCount: v.number(),
      nextBillingAt: v.union(v.number(), v.null()),
      entitlement: v.union(v.string(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .collect();

    const active = subs.find((s: any) => s.status === "active" && s.expiryDate > now);
    if (!active) return null;

    return {
      _id: active._id,
      plan: active.plan,
      amount: active.amount,
      currency: active.currency,
      status: active.status,
      startDate: active.startDate,
      expiryDate: active.expiryDate,
      billingPeriod: active.billingPeriod ?? null,
      renewalCount: active.renewalCount ?? 0,
      nextBillingAt: active.nextBillingAt ?? null,
      entitlement: active.entitlement ?? null,
    };
  },
});

// ─── Create subscription after payment ───────────────

export const create = mutation({
  args: {
    userId: v.string(),
    plan: v.string(),
    amount: v.number(),
    currency: v.string(),
    paystackReference: v.string(),
    billingPeriod: v.optional(v.string()),
    entitlement: v.optional(v.string()),
  },
  returns: v.id("subscriptions"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const period = args.billingPeriod ?? "monthly";
    const expiryDate = now + billingWindowMs(period);

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .collect();
    for (const sub of existing) {
      if (sub.status === "active") {
        await ctx.db.patch(sub._id, { status: "expired" });
      }
    }

    return await ctx.db.insert("subscriptions", {
      userId: args.userId,
      plan: args.plan,
      amount: args.amount,
      currency: args.currency,
      paystackReference: args.paystackReference,
      status: "active",
      startDate: now,
      expiryDate,
      billingPeriod: period,
      renewalCount: 0,
      nextBillingAt: expiryDate,
      entitlement: args.entitlement ?? args.plan,
    });
  },
});

// ─── Renew subscription ─────────────────────────────

export const renew = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    paystackReference: v.string(),
    amount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub) return null;
    const now = Date.now();
    const period = sub.billingPeriod ?? "monthly";
    const baseExpiry = sub.expiryDate > now ? sub.expiryDate : now;
    const nextExpiry = baseExpiry + billingWindowMs(period);

    await ctx.db.patch(sub._id, {
      status: "active",
      paystackReference: args.paystackReference,
      amount: args.amount,
      expiryDate: nextExpiry,
      nextBillingAt: nextExpiry,
      renewalCount: (sub.renewalCount ?? 0) + 1,
    });
    return null;
  },
});

// ─── Expire due subscriptions ───────────────────────

export const expireDue = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const subs = await ctx.db.query("subscriptions").take(100);
    let expired = 0;
    for (const sub of subs) {
      if (sub.status === "active" && sub.expiryDate <= now) {
        await ctx.db.patch(sub._id, { status: "expired" });
        expired += 1;
      }
    }
    return expired;
  },
});

// ─── Cancel subscription ─────────────────────────────

export const cancel = mutation({
  args: { subscriptionId: v.id("subscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subscriptionId, { status: "cancelled" });
    return null;
  },
});

// ─── Verify by reference (after payment) ─────────────

export const getByReference = query({
  args: { reference: v.string() },
  returns: v.union(v.id("subscriptions"), v.null()),
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_reference", (q: any) => q.eq("paystackReference", args.reference))
      .first();
    return sub?._id ?? null;
  },
});