import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listSavedItems = query({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("savedItems"),
      _creationTime: v.number(),
      messageContent: v.string(),
      conversationTitle: v.string(),
      note: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("savedItems")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(100);
    return items.map((item) => ({
      _id: item._id,
      _creationTime: item._creationTime,
      messageContent: item.messageContent,
      conversationTitle: item.conversationTitle,
      note: item.note,
    }));
  },
});

export const saveItem = mutation({
  args: {
    userId: v.string(),
    messageContent: v.string(),
    conversationTitle: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.id("savedItems"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("savedItems", {
      userId: args.userId,
      messageContent: args.messageContent,
      conversationTitle: args.conversationTitle,
      note: args.note,
    });
  },
});

export const deleteSavedItem = mutation({
  args: { itemId: v.id("savedItems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.itemId);
    return null;
  },
});