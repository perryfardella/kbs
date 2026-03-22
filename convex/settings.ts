import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    ownerName: v.string(),
    companyName: v.string(),
    fiscalYearEnd: v.string(),
    currency: v.optional(v.string()),
    loanAlertThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .unique();

    const data = {
      userId: identity.tokenIdentifier,
      ownerName: args.ownerName,
      companyName: args.companyName,
      fiscalYearEnd: args.fiscalYearEnd,
      currency: args.currency ?? "CAD",
      loanAlertThreshold: args.loanAlertThreshold,
    };

    if (existing) {
      await ctx.db.replace(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("settings", data);
    }
  },
});
