import { internalMutation, mutation, query } from "./_generated/server";
import { format, subDays } from "date-fns";
import { computeOccurrences } from "../lib/recurrence";
import { v } from "convex/values";

const transactionTypeValidator = v.union(
  v.literal("personal_expense"),
  v.literal("business_expense"),
  v.literal("business_expense_personal_pay"),
  v.literal("personal_expense_business_pay"),
  v.literal("transfer_to_personal"),
  v.literal("transfer_to_business"),
  v.literal("dividend_payment")
);

type TransactionType =
  | "personal_expense"
  | "business_expense"
  | "business_expense_personal_pay"
  | "personal_expense_business_pay"
  | "transfer_to_personal"
  | "transfer_to_business"
  | "dividend_payment";

function computeDelta(type: TransactionType, amount: number): number {
  switch (type) {
    case "business_expense_personal_pay":
    case "transfer_to_business":
      return amount;
    case "personal_expense_business_pay":
    case "transfer_to_personal":
    case "dividend_payment":
      return -amount;
    default:
      return 0;
  }
}

const recurringArgs = {
  description: v.string(),
  amount: v.number(),
  type: transactionTypeValidator,
  categoryId: v.optional(v.id("categories")),
  notes: v.optional(v.string()),
  frequency: v.union(
    v.literal("weekly"),
    v.literal("biweekly"),
    v.literal("monthly"),
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
    return await ctx.db.insert("recurringTransactions", {
      userId: identity.tokenIdentifier,
      ...args,
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
    await ctx.db.patch(recurringTransactionId, fields);
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

    const shareholderLoanDelta = computeDelta(rule.type, args.amount);

    const transactionId = await ctx.db.insert("transactions", {
      userId: identity.tokenIdentifier,
      date: args.scheduledDate,
      amount: args.amount,
      description: rule.description,
      notes: args.notes ?? rule.notes,
      type: rule.type,
      categoryId: rule.categoryId,
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

        const shareholderLoanDelta = computeDelta(rule.type as TransactionType, rule.amount);

        const transactionId = await ctx.db.insert("transactions", {
          userId: rule.userId,
          date: occ.date,
          amount: rule.amount,
          description: rule.description,
          notes: rule.notes,
          type: rule.type,
          categoryId: rule.categoryId,
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
