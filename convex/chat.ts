import {
  query,
  mutation,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

declare const process: {
  env: Record<string, string | undefined>;
};

type AIProvider = "auto" | "a0" | "openai" | "anthropic" | "gemini";
type AIMode = "standard" | "fast" | "educational";

const providerValidator = v.union(
  v.literal("auto"),
  v.literal("a0"),
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("gemini")
);

const modeValidator = v.union(
  v.literal("standard"),
  v.literal("fast"),
  v.literal("educational")
);

function normalizeProvider(provider?: string): AIProvider {
  return provider === "openai" || provider === "anthropic" || provider === "gemini" || provider === "a0"
    ? provider
    : "auto";
}

function normalizeMode(mode?: string): AIMode {
  return mode === "fast" || mode === "educational" ? mode : "standard";
}

function systemPrompt(mode: AIMode) {
  const base =
    "You are Giga3 AI, a knowledgeable assistant. Be accurate, structured, and concise. " +
    "Use markdown formatting when helpful. Never fabricate sources. Say when unsure.";

  if (mode === "fast") {
    return base + " Keep answers short, direct, and action-oriented.";
  }

  if (mode === "educational") {
    return (
      base +
      " Act like a tutor. Explain step by step, keep the tone supportive, and prioritize learning over giving only the final answer. " +
      "When useful, break complex ideas into simple examples and short bullet points."
    );
  }

  return base + " Match depth to the question: brief for simple queries, detailed for complex ones.";
}

function isUnsafePrompt(text: string) {
  const prompt = text.toLowerCase();
  const blocked = [
    /make\s+a\s+bomb/,
    /build\s+a\s+weapon/,
    /credit\s+card\s+skimmer/,
    /malware/,
    /phishing/,
    /pirated\s+(book|pdf|ebook)/,
    /stolen\s+(book|ebook|pdf|document)/,
    /bypass\s+copyright/,
  ];
  return blocked.some((re) => re.test(prompt));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000) {
  const AbortCtrl = (globalThis as any).AbortController;
  const fetchFn = (globalThis as any).fetch;
  const controller = new AbortCtrl();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function convertMessages(messages: Array<{ role: string; content: string }>) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

async function callA0(messages: Array<{ role: string; content: string }>, mode: AIMode) {
  const response = await fetchWithTimeout(
    "https://api.a0.dev/ai/llm",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: systemPrompt(mode) }, ...messages],
      }),
    },
    20000
  );
  if (!response.ok) throw new Error(`a0 failed: ${response.status}`);
  const data = await response.json();
  return data.completion || "I apologize, but I could not generate a response.";
}

async function callOpenAI(
  ctx: any,
  messages: Array<{ role: string; content: string }>,
  mode: AIMode
) {
  const transcript = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  return await ctx.runAction(internal.openai.generateText, {
    systemPrompt: systemPrompt(mode),
    userPrompt: transcript,
    tier: mode === "fast" ? "light" : "heavy",
  });
}

async function callAnthropic(messages: Array<{ role: string; content: string }>, mode: AIMode) {
  const env = getEnv();
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic key missing");
  const model = env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
  const response = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: mode === "fast" ? 800 : 1800,
        system: systemPrompt(mode),
        messages: convertMessages(messages).filter((m) => m.role !== "system"),
      }),
    },
    20000
  );
  if (!response.ok) throw new Error(`Anthropic failed: ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text || "I apologize, but I could not generate a response.";
}

async function callGemini(messages: Array<{ role: string; content: string }>, mode: AIMode) {
  const env = getEnv();
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini key missing");
  const model = env.GEMINI_MODEL || "gemini-1.5-flash";
  const contents = convertMessages(messages)
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(mode) }] },
        contents,
      }),
    },
    20000
  );
  if (!response.ok) throw new Error(`Gemini failed: ${response.status}`);
  const data = await response.json();
  return (
    data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ||
    "I apologize, but I could not generate a response."
  );
}

async function tryProviders(
  ctx: any,
  messages: Array<{ role: string; content: string }>,
  provider: AIProvider,
  mode: AIMode
) {
  const fallbackOrder: AIProvider[] =
    provider === "auto"
      ? ["openai", "anthropic", "gemini", "a0"]
      : [provider, "openai", "anthropic", "gemini", "a0"];

  const order = Array.from(new Set(fallbackOrder));
  let lastError: unknown = null;

  for (const candidate of order) {
    try {
      if (candidate === "openai") return await callOpenAI(ctx, messages, mode);
      if (candidate === "anthropic" && process.env.ANTHROPIC_API_KEY) return await callAnthropic(messages, mode);
      if (candidate === "gemini" && process.env.GEMINI_API_KEY) return await callGemini(messages, mode);
      if (candidate === "a0") return await callA0(messages, mode);
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    console.error("All AI providers failed", lastError);
  }
  return "I apologize, but I could not generate a response right now.";
}

function getEnv() {
  return process.env;
}

export const listConversations = query({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      title: v.string(),
      lastMessageAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const convos = await ctx.db
      .query("conversations")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
    return convos.map((c: any) => ({
      _id: c._id,
      _creationTime: c._creationTime,
      title: c.title,
      lastMessageAt: c.lastMessageAt,
    }));
  },
});

export const createConversation = mutation({
  args: { userId: v.string(), title: v.string() },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("conversations", {
      userId: args.userId,
      title: args.title,
      lastMessageAt: Date.now(),
    });
  },
});

export const listMessages = query({
  args: { conversationId: v.id("conversations") },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q: any) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
    return msgs.map((m: any) => ({
      _id: m._id,
      _creationTime: m._creationTime,
      role: m.role,
      content: m.content,
    }));
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    provider: v.optional(providerValidator),
    mode: v.optional(modeValidator),
    userId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const requesterId = args.userId ?? conversation.userId;
    const access: { allowed: boolean; remaining: number; isPremium: boolean } = await ctx.runQuery(
      internal.credits.canUseFreeEducational,
      { userId: requesterId }
    );
    if (!access.allowed && !access.isPremium) {
      throw new Error("Daily free chat limit reached");
    }

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
    });
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.chat.generateAIResponseInternal, {
      conversationId: args.conversationId,
      userId: requesterId,
      provider: args.provider ?? "auto",
      mode: args.mode ?? "standard",
    });
    return null;
  },
});

export const generateAIResponseInternal = internalAction({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    provider: v.optional(providerValidator),
    mode: v.optional(modeValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const messages: Array<{ role: string; content: string }> =
      await ctx.runQuery(internal.chat.loadContext, {
        conversationId: args.conversationId,
      });

    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    if (isUnsafePrompt(latestUserMessage)) {
      await ctx.runMutation(internal.chat.writeAIResponse, {
        conversationId: args.conversationId,
        content:
          "I can't help with harmful, illegal, or copyright-violating requests. I can help you with safe educational or creative alternatives instead.",
      });
      return null;
    }

    const content = await tryProviders(ctx, messages, normalizeProvider(args.provider), normalizeMode(args.mode));

    await ctx.runMutation(internal.credits.recordSubstantialEducationalUse, {
      userId: args.userId,
      content,
    });

    await ctx.runMutation(internal.chat.writeAIResponse, {
      conversationId: args.conversationId,
      content,
    });
    return null;
  },
});

export const loadContext = internalQuery({
  args: { conversationId: v.id("conversations") },
  returns: v.array(
    v.object({
      role: v.string(),
      content: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q: any) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .take(12);
    return messages.reverse().map((m: any) => ({
      role: m.role,
      content: m.content,
    }));
  },
});

export const writeAIResponse = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: args.content,
    });
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    });
    return null;
  },
});

export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q: any) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    await ctx.db.delete(args.conversationId);
    return null;
  },
});