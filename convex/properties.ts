import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
