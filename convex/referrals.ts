import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

type ReferralEventType = "click" | "signup" | "purchase";

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function now() {
  return Date.now();
}

function makeCode(userId: string) {
  return (
    "G3" +
    userId.slice(0, 5).toUpperCase() +
    Math.random().toString(36).slice(2, 8).toUpperCase()
  );
}

export const ensureReferralCode = mutation({
  args: { userId: v.string(), email: v.optional(v.string()) },
  returns: v.object({ code: v.string(), link: v.string() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("referralCodes")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .unique();
    if (existing) return { code: existing.code, link: existing.link };

    const code = makeCode(args.userId);
    const link = `https://giga3.ai/ref/${code}`;

    await ctx.db.insert("referralCodes", {
      userId: args.userId,
      email: args.email,
      code,
      link,
      status: "active",
      clickCount: 0,
      signupCount: 0,
      purchaseCount: 0,
      commissionEarned: 0,
      bonusCreditsEarned: 0,
      updatedAt: now(),
    });

    return { code, link };
  },
});

export const recordReferralClick = mutation({
  args: { code: v.string(), visitorId: v.optional(v.string()), source: v.optional(v.string()) },
  returns: v.object({ success: v.boolean(), tracked: v.boolean() }),
  handler: async (ctx, args) => {
    const referral = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q: any) => q.eq("code", args.code))
      .unique();
    if (!referral) return { success: false, tracked: false };

    const day = todayKey();
    const clicks = await ctx.db
      .query("referralEvents")
      .withIndex("by_code_and_day", (q: any) => q.eq("code", args.code).eq("day", day))
      .take(100);

    const duplicate = clicks.some((event: any) => event.visitorId && args.visitorId && event.visitorId === args.visitorId);
    if (duplicate) return { success: true, tracked: false };

    await ctx.db.insert("referralEvents", {
      code: args.code,
      visitorId: args.visitorId,
      source: args.source ?? "link",
      type: "click",
      day,
      createdAt: now(),
    });

    await ctx.db.patch(referral._id, {
      clickCount: (referral.clickCount ?? 0) + 1,
      updatedAt: now(),
    });

    return { success: true, tracked: true };
  },
});

export const recordReferralSignup = mutation({
  args: { referralCode: v.string(), newUserId: v.string(), newUserEmail: v.optional(v.string()) },
  returns: v.object({ tracked: v.boolean(), rewarded: v.boolean() }),
  handler: async (ctx, args) => {
    const code = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q: any) => q.eq("code", args.referralCode))
      .unique();
    if (!code || code.userId === args.newUserId) return { tracked: false, rewarded: false };

    const existing = await ctx.db
      .query("referralEvents")
      .withIndex("by_newUserId", (q: any) => q.eq("newUserId", args.newUserId))
      .take(1);
    if (existing.length > 0) return { tracked: true, rewarded: false };

    await ctx.db.insert("referralEvents", {
      code: args.referralCode,
      referrerId: code.userId,
      visitorId: args.newUserId,
      newUserId: args.newUserId,
      newUserEmail: args.newUserEmail,
      source: "onboarding",
      type: "signup",
      day: todayKey(),
      createdAt: now(),
    });

    await ctx.db.patch(code._id, {
      signupCount: (code.signupCount ?? 0) + 1,
      updatedAt: now(),
    });

    await ctx.runMutation(internal.credits.grantCredits, {
      userId: code.userId,
      amount: 5,
      source: "referral_signup",
      reference: args.newUserId,
      note: `Referral signup reward from ${args.newUserEmail ?? args.newUserId}`,
    });

    return { tracked: true, rewarded: true };
  },
});

export const rewardReferralSignup = mutation({
  args: {
    code: v.string(),
    newUserId: v.string(),
    newUserEmail: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), alreadyRewarded: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    const referral = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q: any) => q.eq("code", args.code))
      .unique();
    if (!referral) return { success: false, alreadyRewarded: false, message: "Invalid referral code" };

    const selfReferral = referral.userId === args.newUserId || (referral.email && referral.email === args.newUserEmail);
    if (selfReferral) return { success: false, alreadyRewarded: false, message: "Self-referral blocked" };

    const existing = await ctx.db
      .query("referralEvents")
      .withIndex("by_newUserId", (q: any) => q.eq("newUserId", args.newUserId))
      .take(1);
    if (existing.length > 0) {
      return { success: true, alreadyRewarded: true, message: "Signup already rewarded" };
    }

    await ctx.db.insert("referralEvents", {
      code: args.code,
      referrerId: referral.userId,
      visitorId: args.newUserId,
      newUserId: args.newUserId,
      newUserEmail: args.newUserEmail,
      source: "signup",
      type: "signup",
      day: todayKey(),
      createdAt: now(),
    });

    const creditReward = 5;
    await ctx.runMutation(internal.credits.grantCredits, {
      userId: referral.userId,
      amount: creditReward,
      source: "referral_signup",
      reference: args.newUserId,
      note: `Referral signup reward from ${args.newUserEmail ?? args.newUserId}`,
    });

    await ctx.db.patch(referral._id, {
      signupCount: (referral.signupCount ?? 0) + 1,
      bonusCreditsEarned: (referral.bonusCreditsEarned ?? 0) + creditReward,
      updatedAt: now(),
    });

    return { success: true, alreadyRewarded: false, message: "Referral signup rewarded" };
  },
});

export const recordReferralPurchase = mutation({
  args: {
    referralCode: v.string(),
    buyerId: v.string(),
    orderId: v.string(),
    amount: v.number(),
    currency: v.string(),
  },
  returns: v.object({ tracked: v.boolean(), rewarded: v.boolean() }),
  handler: async (ctx, args) => {
    const code = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q: any) => q.eq("code", args.referralCode))
      .unique();
    if (!code || code.userId === args.buyerId) return { tracked: false, rewarded: false };

    const existing = await ctx.db
      .query("referralEvents")
      .withIndex("by_orderId", (q: any) => q.eq("orderId", args.orderId))
      .unique();
    if (existing) return { tracked: true, rewarded: false };

    const commission = Math.max(1, Math.round(args.amount * 0.1));

    await ctx.db.insert("referralEvents", {
      code: args.referralCode,
      referrerId: code.userId,
      visitorId: args.buyerId,
      newUserId: args.buyerId,
      source: "purchase",
      type: "purchase",
      day: todayKey(),
      orderId: args.orderId,
      amount: args.amount,
      commission,
      createdAt: now(),
    });

    await ctx.db.patch(code._id, {
      purchaseCount: (code.purchaseCount ?? 0) + 1,
      commissionEarned: (code.commissionEarned ?? 0) + commission,
      updatedAt: now(),
    });

    await ctx.runMutation(internal.credits.grantCredits, {
      userId: code.userId,
      amount: commission,
      source: "referral_purchase",
      reference: args.orderId,
      note: `Affiliate commission from purchase ${args.orderId}`,
    });

    return { tracked: true, rewarded: true };
  },
});

export const rewardReferralPurchase = mutation({
  args: {
    code: v.string(),
    purchaserId: v.string(),
    orderId: v.string(),
    amount: v.number(),
  },
  returns: v.object({ success: v.boolean(), alreadyRewarded: v.boolean() }),
  handler: async (ctx, args) => {
    const referral = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q: any) => q.eq("code", args.code))
      .unique();
    if (!referral) return { success: false, alreadyRewarded: false };

    const duplicate = await ctx.db
      .query("referralEvents")
      .withIndex("by_orderId", (q: any) => q.eq("orderId", args.orderId))
      .take(1);
    if (duplicate.length > 0) return { success: true, alreadyRewarded: true };

    const commission = Math.max(1, Math.round(args.amount * 0.1));
    await ctx.db.insert("referralEvents", {
      code: args.code,
      referrerId: referral.userId,
      visitorId: args.purchaserId,
      newUserId: args.purchaserId,
      source: "purchase",
      type: "purchase",
      day: todayKey(),
      orderId: args.orderId,
      amount: args.amount,
      commission,
      createdAt: now(),
    });

    await ctx.runMutation(internal.credits.grantCredits, {
      userId: referral.userId,
      amount: commission,
      source: "referral_purchase",
      reference: args.orderId,
      note: `Affiliate commission from purchase ${args.orderId}`,
    });

    await ctx.db.patch(referral._id, {
      purchaseCount: (referral.purchaseCount ?? 0) + 1,
      commissionEarned: (referral.commissionEarned ?? 0) + commission,
      updatedAt: now(),
    });

    return { success: true, alreadyRewarded: false };
  },
});

export const getReferralCodeByEmail = query({
  args: { email: v.string() },
  returns: v.union(
    v.object({ code: v.string(), link: v.string(), userId: v.string() }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const referral = await ctx.db
      .query("referralCodes")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .unique();
    if (!referral) return null;
    return { code: referral.code, link: referral.link, userId: referral.userId };
  },
});

export const getReferralSummary = query({
  args: { userId: v.string() },
  returns: v.union(
    v.object({
      code: v.string(),
      link: v.string(),
      clickCount: v.number(),
      signupCount: v.number(),
      purchaseCount: v.number(),
      commissionEarned: v.number(),
      bonusCreditsEarned: v.number(),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const referral = await ctx.db
      .query("referralCodes")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .unique();
    if (!referral) return null;

    return {
      code: referral.code,
      link: referral.link,
      clickCount: referral.clickCount ?? 0,
      signupCount: referral.signupCount ?? 0,
      purchaseCount: referral.purchaseCount ?? 0,
      commissionEarned: referral.commissionEarned ?? 0,
      bonusCreditsEarned: referral.bonusCreditsEarned ?? 0,
      status: referral.status ?? "active",
    };
  },
});