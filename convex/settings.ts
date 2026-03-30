import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

function formatOwnerName(fullName: string): string {
  return fullName
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

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

export const ensureDefaults = mutation({
  args: { ownerName: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .unique();
    const ownerName = formatOwnerName(args.ownerName);
    const companyName = `${ownerName}'s company`;

    const data = {
      userId: identity.tokenIdentifier,
      companyName,
      fiscalYearEnd: "03-31", // March 31
      currency: "CAD",
    };

    let settingsId: string;
    if (existing) {
      await ctx.db.replace(existing._id, data);
      settingsId = existing._id;
    } else {
      settingsId = await ctx.db.insert("settings", data);
    }

    // Seed default categories as part of first-run initialization.
    await ctx.runMutation(api.categories.seedDefaults, {});

    return settingsId;
  },
});
