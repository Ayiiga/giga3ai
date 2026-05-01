import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const logActivity = mutation({
  args: {
    userId: v.string(),
    action: v.string(),
    toolId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("activityLog", {
      userId: args.userId,
      action: args.action,
      toolId: args.toolId,
      date: getTodayStr(),
    });
    return null;
  },
});

export const getProfileStats = query({
  args: { userId: v.string() },
  returns: v.object({
    studyStreak: v.number(),
    toolsUsed: v.number(),
    quizzesCompleted: v.number(),
    projectsCreated: v.number(),
  }),
  handler: async (ctx, args) => {
    const allActivity = await ctx.db
      .query("activityLog")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Unique dates for streak calculation
    const uniqueDates = [...new Set(allActivity.map((a) => a.date))].sort().reverse();
    let streak = 0;
    const today = getTodayStr();
    const msPerDay = 86400000;

    for (let i = 0; i < uniqueDates.length; i++) {
      const expected = new Date(new Date(today).getTime() - i * msPerDay);
      const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`;
      if (uniqueDates[i] === expectedStr) {
        streak++;
      } else {
        break;
      }
    }

    const toolsUsed = allActivity.filter((a) => a.action === "tool_used").length;
    const quizzesCompleted = allActivity.filter((a) => a.action === "quiz_completed").length;

    // Count projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return {
      studyStreak: streak,
      toolsUsed,
      quizzesCompleted,
      projectsCreated: projects.length,
    };
  },
});
