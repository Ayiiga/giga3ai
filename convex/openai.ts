"use node";

import { action } from './_generated/server';
import { v } from 'convex/values';

const tierValidator = v.union(v.literal('light'), v.literal('heavy'));

function getSystemPrompt(systemPrompt: string, maxOutput?: string) {
  return maxOutput ? `${systemPrompt}\n\n${maxOutput}` : systemPrompt;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000) {
  const AbortControllerImpl = (globalThis as any).AbortController;
  const controller = new AbortControllerImpl();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const generateText = action({
  args: {
    systemPrompt: v.string(),
    userPrompt: v.string(),
    tier: v.optional(tierValidator),
    maxOutput: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (_ctx, args) => {
    const env = (globalThis as any).process?.env ?? {};
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured on the server.');
    }

    const model = env.OPENAI_MODEL || 'gpt-4o-mini';
    const timeoutMs = args.tier === 'light' ? 15000 : 30000;
    const response = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: getSystemPrompt(args.systemPrompt, args.maxOutput) },
            { role: 'user', content: args.userPrompt.trim() },
          ],
          temperature: 0.7,
        }),
      },
      timeoutMs
    );

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('OpenAI returned an empty completion.');
    }
    return text;
  },
});