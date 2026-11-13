import { internalMutation, mutation, query } from "./_generated/server";
import { format, subDays } from "date-fns";
import { computeOccurrences } from "../lib/recurrence";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  computeShareholderLoanDelta,
  scrubTaxFields,
  shapeFromFields,
  toStorageFields,
} from "../lib/transactionFields";

const shapeArgs = {
  kind: v.union(
    v.literal("income"),
    v.literal("expense"),
    v.literal("transfer"),
    v.literal("tax_payment"),
    v.literal("tax_refund")
  ),
  realm: v.optional(v.union(v.literal("personal"), v.literal("business"), v.literal("rental"))),
  account: v.optional(v.union(v.literal("personal"), v.literal("business"))),
  from: v.optional(v.union(v.literal("personal"), v.literal("business"))),
  to: v.optional(v.union(v.literal("personal"), v.literal("business"))),
  // A recurring dividend rule never carries a paid state — every generated occurrence
  // always starts declared-only; a paid date is added later by editing that occurrence's
  // own transaction (shapeFromFields sees no paidDate here, so dividendPaid is always false).
  purpose: v.optional(v.literal("dividend")),
};

// Dividends are a corp → shareholder distribution by definition — never the reverse.
function assertValidPurpose(fields: { from?: "personal" | "business"; to?: "personal" | "business"; purpose?: "dividend" }) {
  if (fields.purpose === "dividend" && !(fields.from === "business" && fields.to === "personal")) {
    throw new Error("A dividend must be a business → personal transfer");
  }
}

// The form's zod schema checks this too, but a direct API call must not store a NaN/out-of-range
// day: it would make computeOccurrences throw inside autoApplyDue and abort the cron for everyone.
function assertValidAnchorDay(f: { frequency: string; anchorDay?: number }) {
  if (f.anchorDay === undefined) return;
  const [min, max] = f.frequency === "weekly" ? [0, 6] : [1, 31];
  if (!Number.isInteger(f.anchorDay) || f.anchorDay < min || f.anchorDay > max) {
    throw new Error(`anchorDay must be a whole number from ${min} to ${max}`);
  }
}

// A rule carries no taxYear (each applied occurrence gets its own, from its date) — only the
// category/property scrub applies.
function ruleScrub(
  shape: Parameters<typeof scrubTaxFields>[0],
  f: { categoryId?: Id<"categories">; propertyId?: Id<"properties"> }
) {
  const { categoryId, propertyId } = scrubTaxFields(shape, { ...f, date: "2000-01-01" });
  return { categoryId, propertyId };
}

const recurringArgs = {
  description: v.string(),
  amount: v.number(),
  ...shapeArgs,
  categoryId: v.optional(v.id("categories")),
  propertyId: v.optional(v.id("properties")),
  notes: v.optional(v.string()),
  frequency: v.union(
    v.literal("weekly"),
    v.literal("biweekly"),
    v.literal("monthly"),
    v.literal("quarterly"),
    v.literal("yearly")
  ),
  anchorDay: v.optional(v.number()),
  anchorDate: v.optional(v.string()),
  startDate: v.string(),
  endDate: v.optional(v.string()),
};

export const create = mutation({
  args: recurringArgs,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    assertValidPurpose(args);
    assertValidAnchorDay(args);
    const shape = shapeFromFields(args);
    return await ctx.db.insert("recurringTransactions", {
      userId: identity.tokenIdentifier,
      ...args,
      ...toStorageFields(shape),
      ...ruleScrub(shape, args),
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    recurringTransactionId: v.id("recurringTransactions"),
    ...recurringArgs,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const rule = await ctx.db.get(args.recurringTransactionId);
    if (!rule || rule.userId !== identity.tokenIdentifier) throw new Error("Not found");
    const { recurringTransactionId, ...fields } = args;
    assertValidPurpose(fields);
    assertValidAnchorDay(fields);
    const shape = shapeFromFields(fields);
    await ctx.db.patch(recurringTransactionId, {
      ...fields,
      ...toStorageFields(shape),
      ...ruleScrub(shape, fields),
    });
  },
});

export const deactivate = mutation({
  args: { recurringTransactionId: v.id("recurringTransactions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const rule = await ctx.db.get(args.recurringTransactionId);
    if (!rule || rule.userId !== identity.tokenIdentifier) throw new Error("Not found");
    await ctx.db.patch(args.recurringTransactionId, { isActive: false });
  },
});

export const remove = mutation({
  args: { recurringTransactionId: v.id("recurringTransactions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const rule = await ctx.db.get(args.recurringTransactionId);
    if (!rule || rule.userId !== identity.tokenIdentifier) throw new Error("Not found");
    // Delete all occurrence records for this rule
    const occurrences = await ctx.db
      .query("recurringOccurrences")
      .withIndex("by_recurring", (q) =>
        q.eq("recurringTransactionId", args.recurringTransactionId)
      )
      .collect();
    await Promise.all(occurrences.map((o) => ctx.db.delete(o._id)));
    await ctx.db.delete(args.recurringTransactionId);
  },
});

export const applyOccurrence = mutation({
  args: {
    recurringTransactionId: v.id("recurringTransactions"),
    scheduledDate: v.string(),
    amount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const rule = await ctx.db.get(args.recurringTransactionId);
    if (!rule || rule.userId !== identity.tokenIdentifier) throw new Error("Not found");

    // Idempotency check — prevent double-applying the same occurrence
    const existing = await ctx.db
      .query("recurringOccurrences")
      .withIndex("by_recurring_date", (q) =>
        q
          .eq("recurringTransactionId", args.recurringTransactionId)
          .eq("scheduledDate", args.scheduledDate)
      )
      .unique();
    if (existing) throw new Error("This occurrence has already been applied");

    const shape = shapeFromFields(rule);
    const shareholderLoanDelta = computeShareholderLoanDelta(shape, args.amount);

    const transactionId = await ctx.db.insert("transactions", {
      userId: identity.tokenIdentifier,
      date: args.scheduledDate,
      amount: args.amount,
      description: rule.description,
      notes: args.notes ?? rule.notes,
      ...toStorageFields(shape),
      ...scrubTaxFields(shape, { categoryId: rule.categoryId, propertyId: rule.propertyId, date: args.scheduledDate }),
      shareholderLoanDelta,
    });

    await ctx.db.insert("recurringOccurrences", {
      userId: identity.tokenIdentifier,
      recurringTransactionId: args.recurringTransactionId,
      scheduledDate: args.scheduledDate,
      appliedTransactionId: transactionId,
      appliedAt: Date.now(),
    });

    return transactionId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const rules = await ctx.db
      .query("recurringTransactions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("isActive", true)
      )
      .collect();
    const result = [];
    for (const rule of rules) {
      let categoryName: string | null = null;
      if (rule.categoryId) {
        const cat = await ctx.db.get(rule.categoryId);
        categoryName = cat?.name ?? null;
      }
      result.push({ ...rule, categoryName });
    }
    return result;
  },
});

export const get = query({
  args: { recurringTransactionId: v.id("recurringTransactions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const rule = await ctx.db.get(args.recurringTransactionId);
    if (!rule || rule.userId !== identity.tokenIdentifier) return null;
    let categoryName: string | null = null;
    if (rule.categoryId) {
      const cat = await ctx.db.get(rule.categoryId);
      categoryName = cat?.name ?? null;
    }
    return { ...rule, categoryName };
  },
});

export const listAllAppliedOccurrences = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("recurringOccurrences")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();
  },
});

// Called by the daily cron — no auth context available
export const autoApplyDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = format(new Date(), "yyyy-MM-dd");

    const rules = await ctx.db
      .query("recurringTransactions")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Only look back 60 days to avoid reprocessing the entire history on every run
    const lookbackStart = format(subDays(new Date(), 60), "yyyy-MM-dd");

    for (const rule of rules) {
      const fromDate = rule.startDate > lookbackStart ? rule.startDate : lookbackStart;
      const occurrences = computeOccurrences(rule, fromDate, 100);
      const due = occurrences.filter((o) => o.date <= today);

      for (const occ of due) {
        const existing = await ctx.db
          .query("recurringOccurrences")
          .withIndex("by_recurring_date", (q) =>
            q.eq("recurringTransactionId", rule._id).eq("scheduledDate", occ.date)
          )
          .unique();

        if (existing) continue;
        if (!rule.kind) continue; // shouldn't happen — every rule carries a kind post-migration

        const shape = shapeFromFields(rule);
        const shareholderLoanDelta = computeShareholderLoanDelta(shape, rule.amount);

        const transactionId = await ctx.db.insert("transactions", {
          userId: rule.userId,
          date: occ.date,
          amount: rule.amount,
          description: rule.description,
          notes: rule.notes,
          ...toStorageFields(shape),
          ...scrubTaxFields(shape, { categoryId: rule.categoryId, propertyId: rule.propertyId, date: occ.date }),
          shareholderLoanDelta,
        });

        await ctx.db.insert("recurringOccurrences", {
          userId: rule.userId,
          recurringTransactionId: rule._id,
          scheduledDate: occ.date,
          appliedTransactionId: transactionId,
          appliedAt: Date.now(),
        });
      }
    }
  },
});
