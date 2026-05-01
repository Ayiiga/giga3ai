import { mutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Set a platform setting (one-time setup) ─────────

export const setSetting = mutation({
  args: { key: v.string(), value: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("platformSettings", { key: args.key, value: args.value });
    }
    return null;
  },
});

// ─── Get a setting (internal only — server-side access) ──

export const getSetting = internalQuery({
  args: { key: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return row?.value ?? null;
  },
});

// ─── Get Paystack public key (safe to expose — it's a public key) ──

export const getPaystackPublicKey = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "PAYSTACK_PUBLIC_KEY"))
      .first();
    return row?.value ?? null;
  },
});