import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const schema = defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    category: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  accountProfiles: defineTable({
    authId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    updatedAt: v.number(),
  })
    .index("by_authId", ["authId"])
    .index("by_email", ["email"]),

  conversations: defineTable({
    userId: v.string(),
    title: v.string(),
    lastMessageAt: v.number(),
  }).index("by_userId", ["userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  }).index("by_conversationId", ["conversationId"]),

  savedItems: defineTable({
    userId: v.string(),
    messageContent: v.string(),
    conversationTitle: v.string(),
    note: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  // ── Earning System ──────────────────────────────────
  referralCodes: defineTable({
    userId: v.string(),
    email: v.optional(v.string()),
    code: v.string(),
    link: v.string(),
    status: v.optional(v.string()),
    clickCount: v.optional(v.number()),
    signupCount: v.optional(v.number()),
    purchaseCount: v.optional(v.number()),
    commissionEarned: v.optional(v.number()),
    bonusCreditsEarned: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_code", ["code"])
    .index("by_email", ["email"]),

  referralEvents: defineTable({
    code: v.string(),
    referrerId: v.optional(v.string()),
    visitorId: v.optional(v.string()),
    newUserId: v.optional(v.string()),
    newUserEmail: v.optional(v.string()),
    source: v.string(),
    type: v.union(v.literal("click"), v.literal("signup"), v.literal("purchase")),
    day: v.string(),
    orderId: v.optional(v.string()),
    amount: v.optional(v.number()),
    commission: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_code_and_day", ["code", "day"])
    .index("by_newUserId", ["newUserId"])
    .index("by_orderId", ["orderId"])
    .index("by_referrerId", ["referrerId"]),

  earnings: defineTable({
    userId: v.string(),
    type: v.string(),
    amount: v.number(),
    description: v.string(),
    date: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_date", ["userId", "date"]),

  dailyTaskCompletions: defineTable({
    userId: v.string(),
    taskId: v.string(),
    date: v.string(),
    amount: v.number(),
  }).index("by_userId_and_date", ["userId", "date"]),

  withdrawalRequests: defineTable({
    userId: v.string(),
    amount: v.number(),
    method: v.string(),
    status: v.string(),
    accountDetails: v.string(),
  }).index("by_userId", ["userId"]),

  // ── Activity Tracking ───────────────────────────────
  activityLog: defineTable({
    userId: v.string(),
    action: v.string(),
    toolId: v.optional(v.string()),
    date: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_date", ["userId", "date"]),

  // ── Projects ────────────────────────────────────────
  projects: defineTable({
    userId: v.string(),
    title: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    notes: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  // ── Marketplace ─────────────────────────────────────
  marketplaceProducts: defineTable({
    authorId: v.string(),
    authorName: v.string(),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    price: v.number(),
    currency: v.string(),
    fileType: v.string(),
    previewText: v.optional(v.string()),
    downloads: v.number(),
    status: v.string(),
    verificationId: v.optional(v.string()),
    barcodeNumber: v.optional(v.string()),
    productCode: v.optional(v.string()),
    copyrightOwner: v.optional(v.string()),
    copyrightYear: v.optional(v.number()),
    ownershipRecordId: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    productFileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    salesCount: v.optional(v.number()),
  })
    .index("by_authorId", ["authorId"])
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .index("by_verificationId", ["verificationId"])
    .index("by_barcodeNumber", ["barcodeNumber"])
    .index("by_productCode", ["productCode"]),

  purchases: defineTable({
    userId: v.string(),
    productId: v.id("marketplaceProducts"),
    price: v.number(),
    currency: v.string(),
    paystackReference: v.optional(v.string()),
    status: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_productId", ["userId", "productId"]),

  // ── Monetization / Credits ──────────────────────────
  creditWallets: defineTable({
    userId: v.string(),
    balance: v.number(),
    lifetimePurchased: v.number(),
    lifetimeConsumed: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  creditTransactions: defineTable({
    userId: v.string(),
    type: v.union(
      v.literal("grant"),
      v.literal("consume"),
      v.literal("refund"),
      v.literal("bonus")
    ),
    amount: v.number(),
    balanceAfter: v.number(),
    source: v.string(),
    reference: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  generationLogs: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_toolId", ["userId", "toolId"]),

  educationalUsage: defineTable({
    userId: v.string(),
    date: v.string(),
    count: v.number(),
  }).index("by_userId_and_date", ["userId", "date"]),

  // ── Platform Settings (server-side only) ────────────
  platformSettings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  // ── Subscriptions ───────────────────────────────────
  subscriptions: defineTable({
    userId: v.string(),
    plan: v.string(),            // "starter" | "standard" | "premium"
    amount: v.number(),
    currency: v.string(),
    paystackReference: v.string(),
    status: v.string(),          // "active" | "expired" | "cancelled"
    startDate: v.number(),
    expiryDate: v.number(),
    billingPeriod: v.optional(v.string()),
    renewalCount: v.optional(v.number()),
    nextBillingAt: v.optional(v.number()),
    entitlement: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_reference", ["paystackReference"]),
});

export default schema;