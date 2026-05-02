import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listProjects = query({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      title: v.string(),
      type: v.string(),
      description: v.optional(v.string()),
      status: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
    return projects.map((p) => ({
      _id: p._id,
      _creationTime: p._creationTime,
      title: p.title,
      type: p.type,
      description: p.description,
      status: p.status,
    }));
  },
});

export const createProject = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("projects", {
      userId: args.userId,
      title: args.title,
      type: args.type,
      description: args.description,
      status: "active",
      notes: "",
    });
  },
});

export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { projectId, ...updates } = args;
    const cleanUpdates: Record<string, string> = {};
    if (updates.title !== undefined) cleanUpdates.title = updates.title;
    if (updates.description !== undefined) cleanUpdates.description = updates.description;
    if (updates.notes !== undefined) cleanUpdates.notes = updates.notes;
    if (updates.status !== undefined) cleanUpdates.status = updates.status;
    await ctx.db.patch(projectId, cleanUpdates);
    return null;
  },
});

export const deleteProject = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.projectId);
    return null;
  },
});
