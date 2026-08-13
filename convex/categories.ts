import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const DEFAULT_CATEGORIES: Array<{
  name: string;
  realm: "personal" | "business" | "both" | "rental";
  isIncome?: boolean;
}> = [
  // Business (13)
  { name: "Medical Supplies & Equipment", realm: "business" },
  { name: "Professional Development / CME", realm: "business" },
  { name: "Insurance", realm: "business" },
  { name: "Professional Fees (accounting, legal)", realm: "business" },
  { name: "Office & Admin Supplies", realm: "business" },
  { name: "Software & Subscriptions", realm: "business" },
  { name: "Phone & Internet (business portion)", realm: "business" },
  { name: "Travel & Transportation (business)", realm: "business" },
  { name: "Meals & Entertainment (business)", realm: "business" },
  { name: "Home Office", realm: "business" },
  { name: "Marketing", realm: "business" },
  { name: "Bank Fees (business)", realm: "business" },
  { name: "Other Business", realm: "business" },
  // Personal (10)
  { name: "Groceries", realm: "personal" },
  { name: "Dining & Restaurants", realm: "personal" },
  { name: "Transportation & Gas", realm: "personal" },
  { name: "Housing & Utilities", realm: "personal" },
  { name: "Health & Wellness", realm: "personal" },
  { name: "Clothing & Personal", realm: "personal" },
  { name: "Entertainment & Subscriptions", realm: "personal" },
  { name: "Travel (personal)", realm: "personal" },
  { name: "Bank Fees (personal)", realm: "personal" },
  { name: "Other Personal", realm: "personal" },
  // Rental (7) — mirrors common rental-property tax deductions
  { name: "Mortgage Interest", realm: "rental" },
  { name: "Property Tax", realm: "rental" },
  { name: "Insurance (rental)", realm: "rental" },
  { name: "Repairs & Maintenance", realm: "rental" },
  { name: "Property Management", realm: "rental" },
  { name: "Utilities (rental)", realm: "rental" },
  { name: "Other Rental", realm: "rental" },
  // Business Income (3)
  { name: "Client Fees / Consulting", realm: "business", isIncome: true },
  { name: "Contract Work", realm: "business", isIncome: true },
  { name: "Other Business Income", realm: "business", isIncome: true },
  // Personal Income (3)
  { name: "Employment Income", realm: "personal", isIncome: true },
  { name: "Freelance/Side Income", realm: "personal", isIncome: true },
  { name: "Other Personal Income", realm: "personal", isIncome: true },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("categories")
      .withIndex("by_user_and_isArchived", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("isArchived", false)
      )
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    realm: v.union(
      v.literal("personal"),
      v.literal("business"),
      v.literal("both"),
      v.literal("rental")
    ),
    isIncome: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await ctx.db.insert("categories", {
      userId: identity.tokenIdentifier,
      name: args.name,
      realm: args.realm,
      isIncome: args.isIncome ?? false,
      isDefault: false,
      isArchived: false,
    });
  },
});

export const archive = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");
    if (category.userId !== identity.tokenIdentifier)
      throw new Error("Unauthorized");
    await ctx.db.patch(args.categoryId, { isArchived: true });
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");
    if (category.userId !== identity.tokenIdentifier)
      throw new Error("Unauthorized");
    if (category.isDefault)
      throw new Error("Default categories cannot be deleted");
    await ctx.db.delete(args.categoryId);
  },
});

// One-time backfill: give every existing user the default `rental` categories.
// New users receive them via seedDefaults; this covers accounts created before
// the rental realm existed. Idempotent — skips users that already have any.
// Run once after deploy: `pnpm dlx convex run categories:backfillRentalCategories`
export const backfillRentalCategories = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rentalDefaults = DEFAULT_CATEGORIES.filter((c) => c.realm === "rental");
    const all = await ctx.db.query("categories").collect();
    const userIds = new Set(all.map((c) => c.userId));

    let usersUpdated = 0;
    let inserted = 0;
    for (const userId of userIds) {
      const hasRental = all.some(
        (c) => c.userId === userId && c.realm === "rental"
      );
      if (hasRental) continue;
      for (const cat of rentalDefaults) {
        await ctx.db.insert("categories", {
          userId,
          name: cat.name,
          realm: cat.realm,
          isDefault: true,
          isArchived: false,
        });
        inserted++;
      }
      usersUpdated++;
    }
    return { usersUpdated, inserted };
  },
});

// One-time backfill: give every existing user the default income categories.
// New users receive them via seedDefaults; this covers accounts created before
// income categories existed. Idempotent — skips users that already have any.
// Run once after deploy: `pnpm dlx convex run categories:backfillIncomeCategories`
export const backfillIncomeCategories = internalMutation({
  args: {},
  handler: async (ctx) => {
    const incomeDefaults = DEFAULT_CATEGORIES.filter((c) => c.isIncome);
    const all = await ctx.db.query("categories").collect();
    const userIds = new Set(all.map((c) => c.userId));

    let usersUpdated = 0;
    let inserted = 0;
    for (const userId of userIds) {
      const hasIncome = all.some((c) => c.userId === userId && c.isIncome);
      if (hasIncome) continue;
      for (const cat of incomeDefaults) {
        await ctx.db.insert("categories", {
          userId,
          name: cat.name,
          realm: cat.realm,
          isIncome: true,
          isDefault: true,
          isArchived: false,
        });
        inserted++;
      }
      usersUpdated++;
    }
    return { usersUpdated, inserted };
  },
});

export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Only seed if no categories exist for this user
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .take(1);
    if (existing.length > 0) return;

    for (const cat of DEFAULT_CATEGORIES) {
      await ctx.db.insert("categories", {
        userId: identity.tokenIdentifier,
        name: cat.name,
        realm: cat.realm,
        isIncome: cat.isIncome ?? false,
        isDefault: true,
        isArchived: false,
      });
    }
  },
});
