import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const FREE_EDUCATIONAL_LIMIT = 8;
const PAID_GENERATION_COSTS: Record<string, number> = {
  video: 60,
  thesis: 25,
  research: 35,
  book: 45,
  document: 20,
  large_file: 15,
};

type AccessContext = {
  isPremium: boolean;
  plan?: string;
  credits: number;
  educationalUsed: number;
  educationalRemaining: number;
  canUseFreeEducational: boolean;
  canGeneratePaid: boolean;
};

function now() {
  return Date.now();
}

async function ensureWallet(ctx: any, userId: string) {
  const existing = await ctx.db
    .query("creditWallets")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;

  const walletId: Id<"creditWallets"> = await ctx.db.insert("creditWallets", {
    userId,
    balance: 0,
    lifetimePurchased: 0,
    lifetimeConsumed: 0,
    updatedAt: now(),
  });
  const wallet = await ctx.db.get(walletId);
  if (!wallet) throw new Error("Failed to initialize credit wallet");
  return wallet;
}

async function readWallet(ctx: any, userId: string) {
  return await ctx.db
    .query("creditWallets")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();
}

async function getActiveSubscription(ctx: any, userId: string) {
  const nowTs = Date.now();
  const active = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .take(20);
  return active.find((sub: any) => sub.status === "active" && sub.expiryDate > nowTs) ?? null;
}

async function getEducationalUsageCount(ctx: any, userId: string, date: string) {
  const usage = await ctx.db
    .query("educationalUsage")
    .withIndex("by_userId_and_date", (q: any) => q.eq("userId", userId).eq("date", date))
    .unique();
  return usage?.count ?? 0;
}

async function getAccessContext(ctx: any, userId: string): Promise<AccessContext> {
  const wallet = (await readWallet(ctx, userId)) ?? {
    balance: 0,
    lifetimePurchased: 0,
    lifetimeConsumed: 0,
  };
  const subscription = await getActiveSubscription(ctx, userId);
  const today = new Date().toISOString().split("T")[0];
  const educationalUsed = await getEducationalUsageCount(ctx, userId, today);
  const educationalRemaining = Math.max(0, FREE_EDUCATIONAL_LIMIT - educationalUsed);
  const isPremium = !!subscription;

  return {
    isPremium,
    plan: subscription?.plan,
    credits: wallet.balance,
    educationalUsed,
    educationalRemaining,
    canUseFreeEducational: isPremium || educationalRemaining > 0,
    canGeneratePaid: isPremium || wallet.balance > 0,
  };
}

export const getAccessStatus = query({
  args: { userId: v.string() },
  returns: v.object({
    isPremium: v.boolean(),
    plan: v.union(v.string(), v.null()),
    credits: v.number(),
    educationalUsed: v.number(),
    educationalRemaining: v.number(),
    canUseFreeEducational: v.boolean(),
    canGeneratePaid: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const access = await getAccessContext(ctx, args.userId);
    return {
      isPremium: access.isPremium,
      plan: access.plan ?? null,
      credits: access.credits,
      educationalUsed: access.educationalUsed,
      educationalRemaining: access.educationalRemaining,
      canUseFreeEducational: access.canUseFreeEducational,
      canGeneratePaid: access.canGeneratePaid,
    };
  },
});

export const getMyAccessStatus = query({
  args: { authId: v.string() },
  returns: v.union(
    v.object({
      isPremium: v.boolean(),
      plan: v.union(v.string(), v.null()),
      credits: v.number(),
      educationalUsed: v.number(),
      educationalRemaining: v.number(),
      canUseFreeEducational: v.boolean(),
      canGeneratePaid: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const access = await getAccessContext(ctx, args.authId);
    return {
      isPremium: access.isPremium,
      plan: access.plan ?? null,
      credits: access.credits,
      educationalUsed: access.educationalUsed,
      educationalRemaining: access.educationalRemaining,
      canUseFreeEducational: access.canUseFreeEducational,
      canGeneratePaid: access.canGeneratePaid,
    };
  },
});

export const getCreditTransactions = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("creditTransactions"),
      _creationTime: v.number(),
      userId: v.string(),
      type: v.union(v.literal("grant"), v.literal("consume"), v.literal("refund"), v.literal("bonus")),
      amount: v.number(),
      balanceAfter: v.number(),
      source: v.string(),
      reference: v.union(v.string(), v.null()),
      note: v.union(v.string(), v.null()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);
    const rows = await ctx.db
      .query("creditTransactions")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
    return rows.map((row: any) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      userId: row.userId,
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      source: row.source,
      reference: row.reference ?? null,
      note: row.note ?? null,
      createdAt: row.createdAt,
    }));
  },
});

export const canUseFreeEducational = internalQuery({
  args: { userId: v.string() },
  returns: v.object({ allowed: v.boolean(), remaining: v.number(), isPremium: v.boolean() }),
  handler: async (ctx, args) => {
    const access = await getAccessContext(ctx, args.userId);
    return {
      allowed: access.canUseFreeEducational,
      remaining: access.educationalRemaining,
      isPremium: access.isPremium,
    };
  },
});

export const recordSubstantialEducationalUse = internalMutation({
  args: { userId: v.string(), content: v.string() },
  returns: v.object({ success: v.boolean(), counted: v.boolean(), remaining: v.number() }),
  handler: async (ctx, args) => {
    const text = args.content.trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    const substantial = text.length >= 240 || words >= 40;
    if (!substantial) {
      const access = await getAccessContext(ctx, args.userId);
      return { success: true, counted: false, remaining: access.educationalRemaining };
    }

    const subscription = await getActiveSubscription(ctx, args.userId);
    if (subscription) {
      return { success: true, counted: false, remaining: Number.MAX_SAFE_INTEGER };
    }

    const today = new Date().toISOString().split("T")[0];
    const existing = await ctx.db
      .query("educationalUsage")
      .withIndex("by_userId_and_date", (q: any) => q.eq("userId", args.userId).eq("date", today))
      .unique();

    const count = (existing?.count ?? 0) + 1;
    if (count > FREE_EDUCATIONAL_LIMIT) {
      return { success: false, counted: false, remaining: 0 };
    }

    if (existing) {
      await ctx.db.patch(existing._id, { count });
    } else {
      await ctx.db.insert("educationalUsage", { userId: args.userId, date: today, count });
    }

    return { success: true, counted: true, remaining: Math.max(0, FREE_EDUCATIONAL_LIMIT - count) };
  },
});

export const getCreditBalance = query({
  args: { userId: v.string() },
  returns: v.object({
    userId: v.string(),
    balance: v.number(),
    lifetimePurchased: v.number(),
    lifetimeConsumed: v.number(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const wallet = await readWallet(ctx, args.userId);
    return wallet ?? { userId: args.userId, balance: 0, lifetimePurchased: 0, lifetimeConsumed: 0, updatedAt: now() };
  },
});

export const grantCredits = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    source: v.string(),
    reference: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), balance: v.number() }),
  handler: async (ctx, args) => {
    if (args.amount <= 0) return { success: false, balance: 0 };
    const wallet = await ensureWallet(ctx, args.userId);
    const balanceAfter = wallet.balance + args.amount;
    await ctx.db.patch(wallet._id, {
      balance: balanceAfter,
      lifetimePurchased: wallet.lifetimePurchased + args.amount,
      updatedAt: now(),
    });
    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      type: "grant",
      amount: args.amount,
      balanceAfter,
      source: args.source,
      reference: args.reference,
      note: args.note,
      createdAt: now(),
    });
    return { success: true, balance: balanceAfter };
  },
});

async function consumeCreditsInternal(
  ctx: any,
  args: { userId: string; amount: number; source: string; reference?: string; note?: string }
) {
  if (args.amount <= 0) {
    const wallet = await ensureWallet(ctx, args.userId);
    return { success: false, balance: wallet.balance, remaining: wallet.balance };
  }
  const wallet = await ensureWallet(ctx, args.userId);
  if (wallet.balance < args.amount) {
    return { success: false, balance: wallet.balance, remaining: wallet.balance };
  }
  const balanceAfter = wallet.balance - args.amount;
  await ctx.db.patch(wallet._id, {
    balance: balanceAfter,
    lifetimeConsumed: wallet.lifetimeConsumed + args.amount,
    updatedAt: now(),
  });
  await ctx.db.insert("creditTransactions", {
    userId: args.userId,
    type: "consume",
    amount: args.amount,
    balanceAfter,
    source: args.source,
    reference: args.reference,
    note: args.note,
    createdAt: now(),
  });
  return { success: true, balance: balanceAfter, remaining: balanceAfter };
}

export const consumeCredits = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    source: v.string(),
    reference: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), balance: v.number(), remaining: v.number() }),
  handler: async (ctx, args) => {
    return await consumeCreditsInternal(ctx, args);
  },
});

export const refundCredits = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    source: v.string(),
    reference: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), balance: v.number() }),
  handler: async (ctx, args) => {
    if (args.amount <= 0) return { success: false, balance: 0 };
    const wallet = await ensureWallet(ctx, args.userId);
    const balanceAfter = wallet.balance + args.amount;
    await ctx.db.patch(wallet._id, {
      balance: balanceAfter,
      updatedAt: now(),
    });
    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      type: "refund",
      amount: args.amount,
      balanceAfter,
      source: args.source,
      reference: args.reference,
      note: args.note,
      createdAt: now(),
    });
    return { success: true, balance: balanceAfter };
  },
});

export const logGeneration = mutation({
  args: {
    userId: v.string(),
    toolId: v.string(),
    title: v.string(),
    kind: v.string(),
    provider: v.optional(v.string()),
    mode: v.optional(v.string()),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    creditsUsed: v.number(),
    prompt: v.string(),
    resultPreview: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
  },
  returns: v.id("generationLogs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("generationLogs", { ...args, createdAt: now() });
  },
});

export const getGenerationHistory = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("generationLogs"),
      _creationTime: v.number(),
      toolId: v.string(),
      title: v.string(),
      kind: v.string(),
      provider: v.optional(v.string()),
      mode: v.optional(v.string()),
      status: v.string(),
      creditsUsed: v.number(),
      prompt: v.string(),
      resultPreview: v.optional(v.string()),
      fileUrl: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const items = await ctx.db
      .query("generationLogs")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
    return items.map((item: any) => ({
      _id: item._id,
      _creationTime: item._creationTime,
      toolId: item.toolId,
      title: item.title,
      kind: item.kind,
      provider: item.provider,
      mode: item.mode,
      status: item.status,
      creditsUsed: item.creditsUsed,
      prompt: item.prompt,
      resultPreview: item.resultPreview,
      fileUrl: item.fileUrl,
      createdAt: item.createdAt,
    }));
  },
});

export const getEducationalUsage = query({
  args: { userId: v.string(), date: v.string() },
  returns: v.object({ userId: v.string(), date: v.string(), count: v.number() }),
  handler: async (ctx, args) => {
    const usage = await ctx.db
      .query("educationalUsage")
      .withIndex("by_userId_and_date", (q: any) => q.eq("userId", args.userId).eq("date", args.date))
      .unique();
    return usage ?? { userId: args.userId, date: args.date, count: 0 };
  },
});

export const incrementEducationalUsage = mutation({
  args: { userId: v.string(), date: v.string() },
  returns: v.object({ success: v.boolean(), count: v.number() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("educationalUsage")
      .withIndex("by_userId_and_date", (q: any) => q.eq("userId", args.userId).eq("date", args.date))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { count: existing.count + 1 });
      return { success: true, count: existing.count + 1 };
    }
    const id = await ctx.db.insert("educationalUsage", { userId: args.userId, date: args.date, count: 1 });
    const row = await ctx.db.get(id);
    return { success: true, count: row?.count ?? 1 };
  },
});

export const logEducationalUse = mutation({
  args: { userId: v.string() },
  returns: v.object({ success: v.boolean(), remaining: v.number() }),
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const subscription = await getActiveSubscription(ctx, args.userId);
    if (subscription) {
      return { success: true, remaining: Number.MAX_SAFE_INTEGER };
    }

    const existing = await ctx.db
      .query("educationalUsage")
      .withIndex("by_userId_and_date", (q: any) => q.eq("userId", args.userId).eq("date", today))
      .unique();

    const count = (existing?.count ?? 0) + 1;
    if (count > FREE_EDUCATIONAL_LIMIT) {
      return { success: false, remaining: 0 };
    }

    if (existing) {
      await ctx.db.patch(existing._id, { count });
    } else {
      await ctx.db.insert("educationalUsage", { userId: args.userId, date: today, count });
    }

    return { success: true, remaining: Math.max(0, FREE_EDUCATIONAL_LIMIT - count) };
  },
});

export const chargeGeneration = mutation({
  args: {
    userId: v.string(),
    kind: v.string(),
    source: v.string(),
    reference: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), balance: v.number(), cost: v.number() }),
  handler: async (ctx, args) => {
    const cost = PAID_GENERATION_COSTS[args.kind] ?? 10;
    const access = await getAccessContext(ctx, args.userId);
    if (access.isPremium) {
      return { success: true, balance: access.credits, cost: 0 };
    }
    if (access.credits < cost) {
      return { success: false, balance: access.credits, cost };
    }

    const result = await consumeCreditsInternal(ctx, {
      userId: args.userId,
      amount: cost,
      source: args.source,
      reference: args.reference,
      note: args.note,
    });
    return { success: result.success, balance: result.balance, cost };
  },
});