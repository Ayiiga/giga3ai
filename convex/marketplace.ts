import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Product return shape (reusable) ─────────────────

const productReturnValidator = v.object({
  _id: v.id("marketplaceProducts"),
  _creationTime: v.number(),
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
  coverUrl: v.optional(v.union(v.string(), v.null())),
});

type ProductDoc = {
  _id: any;
  _creationTime: number;
  authorId: string;
  authorName: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  fileType: string;
  previewText?: string;
  downloads: number;
  status: string;
  verificationId?: string;
  barcodeNumber?: string;
  productCode?: string;
  copyrightOwner?: string;
  copyrightYear?: number;
  ownershipRecordId?: string;
  coverImageId?: any;
  productFileId?: any;
  fileName?: string;
  fileSize?: number;
  salesCount?: number;
};

function makeProductCode(title: string, authorId: string) {
  const clean = title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  const tail = authorId.slice(0, 6).toUpperCase();
  return `G3-${clean || 'PROD'}-${tail}-${Date.now().toString().slice(-6)}`;
}

function makeVerificationId(authorId: string) {
  return `VER-${authorId.slice(0, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function makeBarcodeNumber(productCode: string) {
  const digits = productCode.replace(/[^0-9]/g, '').padEnd(12, '0').slice(0, 12);
  return digits;
}

async function enrichProduct(ctx: any, p: ProductDoc) {
  let coverUrl: string | null | undefined = undefined;
  if (p.coverImageId) {
    coverUrl = await ctx.storage.getUrl(p.coverImageId);
  }
  return {
    _id: p._id,
    _creationTime: p._creationTime,
    authorId: p.authorId,
    authorName: p.authorName,
    title: p.title,
    description: p.description,
    category: p.category,
    price: p.price,
    currency: p.currency,
    fileType: p.fileType,
    previewText: p.previewText,
    downloads: p.downloads,
    status: p.status,
    verificationId: p.verificationId,
    barcodeNumber: p.barcodeNumber,
    productCode: p.productCode,
    copyrightOwner: p.copyrightOwner,
    copyrightYear: p.copyrightYear,
    ownershipRecordId: p.ownershipRecordId,
    coverImageId: p.coverImageId,
    productFileId: p.productFileId,
    fileName: p.fileName,
    fileSize: p.fileSize,
    salesCount: p.salesCount,
    coverUrl,
  };
}

// ─── File Storage ─────────────────────────────────────

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// ─── Product Queries ──────────────────────────────────

export const listProducts = query({
  args: {
    category: v.optional(v.string()),
    sortBy: v.optional(v.string()),
  },
  returns: v.array(productReturnValidator),
  handler: async (ctx, args) => {
    let products: any[] = [];
    if (args.category) {
      products = await ctx.db
        .query("marketplaceProducts")
        .withIndex("by_category", (q: any) => q.eq("category", args.category!))
        .take(40);
      products = products.filter((p: any) => p.status === "published");
    } else {
      products = await ctx.db
        .query("marketplaceProducts")
        .withIndex("by_status", (q: any) => q.eq("status", "published"))
        .order("desc")
        .take(40);
    }

    if (args.sortBy === "price_low") {
      products.sort((a: any, b: any) => a.price - b.price);
    } else if (args.sortBy === "price_high") {
      products.sort((a: any, b: any) => b.price - a.price);
    } else if (args.sortBy === "downloads") {
      products.sort((a: any, b: any) => b.downloads - a.downloads);
    } else {
      products.sort((a: any, b: any) => b._creationTime - a._creationTime);
    }

    const enriched: any[] = [];
    for (const p of products) {
      enriched.push(await enrichProduct(ctx, p));
    }
    return enriched;
  },
});

export const searchProducts = query({
  args: { searchTerm: v.string() },
  returns: v.array(productReturnValidator),
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("marketplaceProducts")
      .withIndex("by_status", (q: any) => q.eq("status", "published"))
      .order("desc")
      .take(40);
    const term = args.searchTerm.toLowerCase();
    const filtered = all.filter(
      (p: any) =>
        p.title.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
    );
    const enriched: any[] = [];
    for (const p of filtered.slice(0, 30)) {
      enriched.push(await enrichProduct(ctx, p));
    }
    return enriched;
  },
});

export const getProduct = query({
  args: { productId: v.id("marketplaceProducts") },
  returns: v.union(productReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.productId);
    if (!p) return null;
    return await enrichProduct(ctx, p);
  },
});

export const getCreatorProducts = query({
  args: { authorId: v.string() },
  returns: v.array(productReturnValidator),
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("marketplaceProducts")
      .withIndex("by_authorId", (q: any) => q.eq("authorId", args.authorId))
      .order("desc")
      .take(50);
    const enriched: any[] = [];
    for (const p of products) {
      enriched.push(await enrichProduct(ctx, p));
    }
    return enriched;
  },
});

export const getCreatorStats = query({
  args: { authorId: v.string() },
  returns: v.object({
    totalProducts: v.number(),
    totalDownloads: v.number(),
    totalSales: v.number(),
    totalEarnings: v.number(),
  }),
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("marketplaceProducts")
      .withIndex("by_authorId", (q: any) => q.eq("authorId", args.authorId))
      .take(50);

    let totalSales = 0;
    let totalEarnings = 0;
    for (const product of products) {
      totalSales += product.salesCount ?? 0;
      totalEarnings += (product.salesCount ?? 0) * product.price;
    }

    return {
      totalProducts: products.length,
      totalDownloads: products.reduce((s: any, p: any) => s + p.downloads, 0),
      totalSales,
      totalEarnings,
    };
  },
});

// ─── Purchase Queries ─────────────────────────────────

export const checkPurchased = query({
  args: { userId: v.string(), productId: v.id("marketplaceProducts") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_userId_and_productId", (q: any) =>
        q.eq("userId", args.userId).eq("productId", args.productId)
      )
      .first();
    return purchase !== null && purchase.status === "completed";
  },
});

export const getUserPurchases = query({
  args: { userId: v.string() },
  returns: v.array(v.object({
    _id: v.id("purchases"),
    _creationTime: v.number(),
    userId: v.string(),
    productId: v.id("marketplaceProducts"),
    price: v.number(),
    currency: v.string(),
    paystackReference: v.optional(v.string()),
    status: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .order("desc")
      .take(60);
    return purchases.map((p: any) => ({
      _id: p._id,
      _creationTime: p._creationTime,
      userId: p.userId,
      productId: p.productId,
      price: p.price,
      currency: p.currency,
      paystackReference: p.paystackReference,
      status: p.status,
    }));
  },
});

export const getUserLibrary = query({
  args: { userId: v.string() },
  returns: v.array(v.object({
    purchaseId: v.id("purchases"),
    purchasedAt: v.number(),
    product: v.union(productReturnValidator, v.null()),
    fileUrl: v.union(v.string(), v.null()),
  })),
  handler: async (ctx, args) => {
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .take(40);

    const completed = purchases.filter((p: any) => p.status === "completed");
    const results: any[] = [];
    for (const purchase of completed) {
      const product = await ctx.db.get(purchase.productId);
      let fileUrl: string | null = null;
      if (product?.productFileId) {
        fileUrl = await ctx.storage.getUrl(product.productFileId) ?? null;
      }
      results.push({
        purchaseId: purchase._id,
        purchasedAt: purchase._creationTime,
        product: product ? await enrichProduct(ctx, product) : null,
        fileUrl,
      });
    }
    return results;
  },
});

// ─── Product File Access ──────────────────────────────

export const getProductFileUrl = query({
  args: { productId: v.id("marketplaceProducts"), userId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    // Check if user purchased the product
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_userId_and_productId", (q: any) =>
        q.eq("userId", args.userId).eq("productId", args.productId)
      )
      .first();

    const product = await ctx.db.get(args.productId);
    if (!product) return null;

    // Allow access if purchased or if free
    const hasAccess = (purchase && purchase.status === "completed") || product.price === 0;
    if (!hasAccess) return null;

    if (!product.productFileId) return null;
    return await ctx.storage.getUrl(product.productFileId);
  },
});

// ─── Product Mutations ────────────────────────────────

export const createProduct = mutation({
  args: {
    authorId: v.string(),
    authorName: v.string(),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    price: v.number(),
    currency: v.string(),
    fileType: v.string(),
    previewText: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    productFileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
  },
  returns: v.id("marketplaceProducts"),
  handler: async (ctx, args) => {
    const productCode = makeProductCode(args.title, args.authorId);
    const verificationId = makeVerificationId(args.authorId);
    const barcodeNumber = makeBarcodeNumber(productCode);
    const ownershipRecordId = `OWN-${args.authorId.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    return await ctx.db.insert("marketplaceProducts", {
      ...args,
      productCode,
      verificationId,
      barcodeNumber,
      ownershipRecordId,
      copyrightOwner: args.authorName,
      copyrightYear: new Date().getFullYear(),
      downloads: 0,
      salesCount: 0,
      status: "published",
    });
  },
});

export const updateProduct = mutation({
  args: {
    productId: v.id("marketplaceProducts"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    price: v.optional(v.number()),
    previewText: v.optional(v.string()),
    status: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    productFileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { productId, ...updates } = args;
    const clean: Record<string, any> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) clean[k] = val;
    }
    if (Object.keys(clean).length > 0) {
      await ctx.db.patch(productId, clean);
    }
    return null;
  },
});

export const deleteProduct = mutation({
  args: { productId: v.id("marketplaceProducts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (product) {
      // Clean up storage files
      if (product.coverImageId) {
        await ctx.storage.delete(product.coverImageId);
      }
      if (product.productFileId) {
        await ctx.storage.delete(product.productFileId);
      }
      await ctx.db.delete(args.productId);
    }
    return null;
  },
});

// ─── Purchase Mutations ───────────────────────────────

export const createPendingPurchase = mutation({
  args: {
    userId: v.string(),
    productId: v.id("marketplaceProducts"),
    price: v.number(),
    currency: v.string(),
    paystackReference: v.string(),
  },
  returns: v.id("purchases"),
  handler: async (ctx, args) => {
    // Check for existing pending purchase with same reference
    return await ctx.db.insert("purchases", {
      userId: args.userId,
      productId: args.productId,
      price: args.price,
      currency: args.currency,
      paystackReference: args.paystackReference,
      status: "pending",
    });
  },
});

export const completePurchase = mutation({
  args: {
    paystackReference: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_reference", (q: any) => q.eq("paystackReference", args.paystackReference))
      .first();
    if (!purchase || purchase.status !== "pending") return false;

    await ctx.db.patch(purchase._id, { status: "completed" });

    const product = await ctx.db.get(purchase.productId);
    if (product) {
      await ctx.db.patch(purchase.productId, {
        salesCount: (product.salesCount ?? 0) + 1,
        downloads: product.downloads + 1,
      });
    }

    return true;
  },
});

export const recordFreePurchase = mutation({
  args: {
    userId: v.string(),
    productId: v.id("marketplaceProducts"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || product.price !== 0) return false;

    // Check if already "purchased"
    const existing = await ctx.db
      .query("purchases")
      .withIndex("by_userId_and_productId", (q: any) =>
        q.eq("userId", args.userId).eq("productId", args.productId)
      )
      .first();
    if (existing) return true; // Already have it

    await ctx.db.insert("purchases", {
      userId: args.userId,
      productId: args.productId,
      price: 0,
      currency: product.currency,
      paystackReference: `free_${Date.now()}`,
      status: "completed",
    });

    await ctx.db.patch(args.productId, {
      downloads: product.downloads + 1,
    });

    return true;
  },
});

export const incrementDownloads = mutation({
  args: { productId: v.id("marketplaceProducts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (product) {
      await ctx.db.patch(args.productId, {
        downloads: product.downloads + 1,
      });
    }
    return null;
  },
});