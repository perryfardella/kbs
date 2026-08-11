import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Transaction types that count as an expense against a property's P&L.
// rental_income is the only "income" type; everything else tagged to a
// property is treated as an expense (rental_expense plus the personal/business
// expense types, which is how the "corp paid a property bill" case shows up).
const EXPENSE_TYPES = new Set([
  "rental_expense",
  "personal_expense",
  "business_expense",
  "personal_expense_business_pay",
  "business_expense_personal_pay",
]);

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("properties")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("isActive", true)
      )
      .collect();
  },
});

export const get = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const property = await ctx.db.get(args.propertyId);
    if (!property || property.userId !== identity.tokenIdentifier) return null;
    return property;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await ctx.db.insert("properties", {
      userId: identity.tokenIdentifier,
      name: args.name,
      address: args.address,
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    propertyId: v.id("properties"),
    name: v.string(),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.userId !== identity.tokenIdentifier)
      throw new Error("Unauthorized");
    await ctx.db.patch(args.propertyId, {
      name: args.name,
      address: args.address,
    });
  },
});

export const archive = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.userId !== identity.tokenIdentifier)
      throw new Error("Unauthorized");
    await ctx.db.patch(args.propertyId, { isActive: false });
  },
});

export const remove = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.userId !== identity.tokenIdentifier)
      throw new Error("Unauthorized");
    // Refuse to delete a property that still has transactions tagged to it —
    // archive instead so the historical P&L is preserved.
    const tagged = await ctx.db
      .query("transactions")
      .withIndex("by_user_property_date", (q) =>
        q
          .eq("userId", identity.tokenIdentifier)
          .eq("propertyId", args.propertyId)
      )
      .take(1);
    if (tagged.length > 0) {
      throw new Error(
        "This property has transactions. Archive it instead of deleting."
      );
    }
    await ctx.db.delete(args.propertyId);
  },
});

// Portfolio-wide rental net for a date range (used by the dashboard card).
export const getRentalSummary = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", (q) =>
        q
          .eq("userId", identity.tokenIdentifier)
          .gte("date", args.startDate)
          .lte("date", args.endDate)
      )
      .collect();

    let income = 0;
    let expenses = 0;
    for (const tx of txns) {
      if (tx.type === "rental_income") income += tx.amount;
      else if (tx.propertyId && EXPENSE_TYPES.has(tx.type)) expenses += tx.amount;
    }
    return { income, expenses, net: income - expenses };
  },
});

// Per-property breakdown for the Reports Rental tab. Reconciles with
// getRentalSummary/getPropertySummary above: income = rental_income
// (regardless of property tag), expenses = anything tagged to a property
// whose type is in EXPENSE_TYPES (so a business_expense billed against a
// property counts here too, and also on the Business tab in Reports).
export const getRentalBreakdown = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("isActive", true)
      )
      .collect();
    const propertyNames = new Map(properties.map((p) => [p._id, p.name]));

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();
    const categoryNames = new Map(categories.map((c) => [c._id, c.name]));

    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", (q) =>
        q
          .eq("userId", identity.tokenIdentifier)
          .gte("date", args.startDate)
          .lte("date", args.endDate)
      )
      .order("asc")
      .collect();

    const byPropertyMap = new Map<
      Id<"properties">,
      { propertyId: Id<"properties">; name: string; income: number; expenses: number }
    >();
    for (const property of properties) {
      byPropertyMap.set(property._id, {
        propertyId: property._id,
        name: property.name,
        income: 0,
        expenses: 0,
      });
    }

    let totalIncome = 0;
    let totalExpenses = 0;
    const rows = [];

    for (const tx of txns) {
      const isIncome = tx.type === "rental_income";
      const isExpense = tx.propertyId != null && EXPENSE_TYPES.has(tx.type);
      if (!isIncome && !isExpense) continue;

      rows.push({
        ...tx,
        categoryName: tx.categoryId ? (categoryNames.get(tx.categoryId) ?? null) : null,
        propertyName: tx.propertyId ? (propertyNames.get(tx.propertyId) ?? null) : null,
      });

      if (isIncome) {
        totalIncome += tx.amount;
        const bucket = tx.propertyId ? byPropertyMap.get(tx.propertyId) : undefined;
        if (bucket) bucket.income += tx.amount;
      }
      if (isExpense) {
        totalExpenses += tx.amount;
        const bucket = byPropertyMap.get(tx.propertyId!);
        if (bucket) bucket.expenses += tx.amount;
      }
    }

    const byProperty = Array.from(byPropertyMap.values()).map((p) => ({
      ...p,
      net: p.income - p.expenses,
    }));

    return {
      total: { income: totalIncome, expenses: totalExpenses, net: totalIncome - totalExpenses },
      byProperty,
      rows,
    };
  },
});

export const getPropertySummary = query({
  args: {
    propertyId: v.id("properties"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const property = await ctx.db.get(args.propertyId);
    if (!property || property.userId !== identity.tokenIdentifier) return null;

    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_user_property_date", (q) => {
        const base = q
          .eq("userId", identity.tokenIdentifier)
          .eq("propertyId", args.propertyId);
        if (args.startDate && args.endDate) {
          return base.gte("date", args.startDate).lte("date", args.endDate);
        } else if (args.startDate) {
          return base.gte("date", args.startDate);
        } else if (args.endDate) {
          return base.lte("date", args.endDate);
        }
        return base;
      })
      .collect();

    let income = 0;
    let expenses = 0;
    for (const tx of txns) {
      if (tx.type === "rental_income") income += tx.amount;
      else if (EXPENSE_TYPES.has(tx.type)) expenses += tx.amount;
    }
    return {
      income,
      expenses,
      net: income - expenses,
      count: txns.length,
    };
  },
});
