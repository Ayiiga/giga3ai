import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Queries ─────────────────────────────────────────────────

export const getEarningsSummary = query({
  args: { userId: v.string() },
  returns: v.object({
    total: v.number(),
    today: v.number(),
    weekly: v.number(),
    monthly: v.number(),
  }),
  handler: async (ctx, args) => {
    const allEarnings = await ctx.db
      .query("earnings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const today = getTodayStr();
    const weekAgo = getDateNDaysAgo(7);
    const monthAgo = getDateNDaysAgo(30);

    let total = 0;
    let todayTotal = 0;
    let weeklyTotal = 0;
    let monthlyTotal = 0;

    for (const e of allEarnings) {
      total += e.amount;
      if (e.date >= today) todayTotal += e.amount;
      if (e.date >= weekAgo) weeklyTotal += e.amount;
      if (e.date >= monthAgo) monthlyTotal += e.amount;
    }

    return { total, today: todayTotal, weekly: weeklyTotal, monthly: monthlyTotal };
  },
});

export const getReferralInfo = query({
  args: { userId: v.string() },
  returns: v.union(
    v.object({
      code: v.string(),
      link: v.string(),
      referralCount: v.number(),
      referralEarnings: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const referralCode = await ctx.db
      .query("referralCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!referralCode) return null;

    const allEarnings = await ctx.db
      .query("earnings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const refEarnings = allEarnings.filter((e) => e.type === "referral");

    return {
      code: referralCode.code,
      link: referralCode.link,
      referralCount: refEarnings.length,
      referralEarnings: refEarnings.reduce((sum, e) => sum + e.amount, 0),
    };
  },
});

export const getDailyTasksStatus = query({
  args: { userId: v.string(), date: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const completions = await ctx.db
      .query("dailyTaskCompletions")
      .withIndex("by_userId_and_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date)
      )
      .collect();

    return completions.map((c) => c.taskId);
  },
});

export const getWithdrawalRequests = query({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("withdrawalRequests"),
      amount: v.number(),
      method: v.string(),
      status: v.string(),
      _creationTime: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("withdrawalRequests")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(20);

    return requests.map((r) => ({
      _id: r._id,
      amount: r.amount,
      method: r.method,
      status: r.status,
      _creationTime: r._creationTime,
    }));
  },
});

// ── Mutations ───────────────────────────────────────────────

export const ensureReferralCode = mutation({
  args: { userId: v.string() },
  returns: v.object({ code: v.string(), link: v.string() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("referralCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      return { code: existing.code, link: existing.link };
    }

    const code =
      "G3" +
      args.userId.substring(0, 4).toUpperCase() +
      Math.random().toString(36).substring(2, 7).toUpperCase();
    const link = `https://giga3.ai/ref/${code}`;

    await ctx.db.insert("referralCodes", {
      userId: args.userId,
      code,
      link,
    });

    return { code, link };
  },
});

export const completeDailyTask = mutation({
  args: {
    userId: v.string(),
    taskId: v.string(),
    amount: v.number(),
    description: v.string(),
    date: v.string(),
  },
  returns: v.object({ success: v.boolean(), alreadyCompleted: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyTaskCompletions")
      .withIndex("by_userId_and_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date)
      )
      .collect();

    if (existing.some((e) => e.taskId === args.taskId)) {
      return { success: false, alreadyCompleted: true };
    }

    await ctx.db.insert("dailyTaskCompletions", {
      userId: args.userId,
      taskId: args.taskId,
      date: args.date,
      amount: args.amount,
    });

    await ctx.db.insert("earnings", {
      userId: args.userId,
      type: "task",
      amount: args.amount,
      description: `Daily task: ${args.description}`,
      date: args.date,
    });

    return { success: true, alreadyCompleted: false };
  },
});

export const recordReferral = mutation({
  args: {
    referrerCode: v.string(),
    newUserId: v.string(),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    const referralCode = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", args.referrerCode))
      .unique();

    if (!referralCode) {
      return { success: false, message: "Invalid referral code" };
    }

    const rewardAmount = 5.0;
    const date = getTodayStr();

    await ctx.db.insert("earnings", {
      userId: referralCode.userId,
      type: "referral",
      amount: rewardAmount,
      description: "Referral reward for new signup",
      date,
    });

    return { success: true, message: "Referral recorded" };
  },
});

export const requestWithdrawal = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    method: v.string(),
    accountDetails: v.string(),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    if (args.amount < 50) {
      return { success: false, message: "Minimum withdrawal is GHS 50" };
    }

    const allEarnings = await ctx.db
      .query("earnings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const totalEarned = allEarnings.reduce((sum, e) => sum + e.amount, 0);

    const existingWithdrawals = await ctx.db
      .query("withdrawalRequests")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const totalWithdrawn = existingWithdrawals
      .filter((w) => w.status !== "rejected")
      .reduce((sum, w) => sum + w.amount, 0);

    const available = totalEarned - totalWithdrawn;

    if (args.amount > available) {
      return { success: false, message: "Insufficient balance" };
    }

    await ctx.db.insert("withdrawalRequests", {
      userId: args.userId,
      amount: args.amount,
      method: args.method,
      status: "pending",
      accountDetails: args.accountDetails,
    });

    return {
      success: true,
      message:
        "Withdrawal request submitted. Payouts will be processed when MoMo and PayPal integrations go live.",
    };
  },
});
