import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const getCategory = query({
  args: { userId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId as any);
    return user?.category ?? null;
  },
});

export const setCategory = mutation({
  args: { userId: v.string(), category: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId as any);
    if (user) {
      await ctx.db.patch(user._id, { category: args.category });
    }
    return null;
  },
});

export const getMyProfile = query({
  args: { authId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("accountProfiles"),
      _creationTime: v.number(),
      authId: v.string(),
      name: v.union(v.string(), v.null()),
      email: v.union(v.string(), v.null()),
      phone: v.union(v.string(), v.null()),
      photoStorageId: v.union(v.id("_storage"), v.null()),
      photoUrl: v.union(v.string(), v.null()),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("accountProfiles")
      .withIndex("by_authId", (q: any) => q.eq("authId", args.authId))
      .unique();
    if (!profile) return null;
    return {
      _id: profile._id,
      _creationTime: profile._creationTime,
      authId: profile.authId,
      name: profile.name ?? null,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      photoStorageId: profile.photoStorageId ?? null,
      photoUrl: profile.photoStorageId ? await ctx.storage.getUrl(profile.photoStorageId) : null,
      updatedAt: profile.updatedAt,
    };
  },
});

export const upsertMyProfile = mutation({
  args: {
    authId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("accountProfiles"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("accountProfiles")
      .withIndex("by_authId", (q: any) => q.eq("authId", args.authId))
      .unique();
    const clean = {
      name: args.name?.trim() || undefined,
      email: args.email?.trim().toLowerCase() || undefined,
      phone: args.phone?.trim() || undefined,
      photoStorageId: args.photoStorageId,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, clean);
      return existing._id;
    }

    return await ctx.db.insert("accountProfiles", {
      authId: args.authId,
      ...clean,
      updatedAt: Date.now(),
    });
  },
});

export const createOrUpdateUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    referralCode: v.optional(v.string()),
    userId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q: any) => q.eq("email", args.email))
      .unique();

    let userId = existing?._id;
    if (!userId) {
      userId = await ctx.db.insert("users", {
        email: args.email,
        name: args.name,
        image: args.image,
      });
    } else {
      await ctx.db.patch(userId, {
        name: args.name ?? existing.name,
        image: args.image ?? existing.image,
      });
    }

    if (args.referralCode) {
      await ctx.runMutation(api.referrals.rewardReferralSignup, {
        code: args.referralCode,
        newUserId: args.userId,
        newUserEmail: args.email,
      });
    }

    return { userId };
  },
});