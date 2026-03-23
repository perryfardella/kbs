import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

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

export const create = mutation({
  args: {
    date: v.string(),
    amount: v.number(),
    description: v.string(),
    notes: v.optional(v.string()),
    type: transactionTypeValidator,
    categoryId: v.optional(v.id("categories")),
    receiptStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const shareholderLoanDelta = computeDelta(args.type, args.amount);
    return await ctx.db.insert("transactions", {
      userId: identity.tokenIdentifier,
      date: args.date,
      amount: args.amount,
      description: args.description,
      notes: args.notes,
      type: args.type,
      categoryId: args.categoryId,
      receiptStorageId: args.receiptStorageId,
      shareholderLoanDelta,
    });
  },
});

export const update = mutation({
  args: {
    transactionId: v.id("transactions"),
    date: v.string(),
    amount: v.number(),
    description: v.string(),
    notes: v.optional(v.string()),
    type: transactionTypeValidator,
    categoryId: v.optional(v.id("categories")),
    receiptStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const tx = await ctx.db.get(args.transactionId);
    if (!tx) throw new Error("Transaction not found");
    if (tx.userId !== identity.tokenIdentifier) throw new Error("Unauthorized");
    const shareholderLoanDelta = computeDelta(args.type, args.amount);
    await ctx.db.patch(args.transactionId, {
      date: args.date,
      amount: args.amount,
      description: args.description,
      notes: args.notes,
      type: args.type,
      categoryId: args.categoryId,
      receiptStorageId: args.receiptStorageId,
      shareholderLoanDelta,
    });
  },
});

export const remove = mutation({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const tx = await ctx.db.get(args.transactionId);
    if (!tx) throw new Error("Transaction not found");
    if (tx.userId !== identity.tokenIdentifier) throw new Error("Unauthorized");
    await ctx.db.delete(args.transactionId);
  },
});

export const get = query({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const tx = await ctx.db.get(args.transactionId);
    if (!tx || tx.userId !== identity.tokenIdentifier) return null;
    let categoryName: string | null = null;
    if (tx.categoryId) {
      const category = await ctx.db.get(tx.categoryId);
      categoryName = category?.name ?? null;
    }
    return { ...tx, categoryName };
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    type: v.optional(transactionTypeValidator),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: "" };

    if (args.search) {
      return await ctx.db
        .query("transactions")
        .withSearchIndex("search_description", (q) =>
          q.search("description", args.search!).eq("userId", identity.tokenIdentifier)
        )
        .paginate(args.paginationOpts);
    }

    if (args.type) {
      return await ctx.db
        .query("transactions")
        .withIndex("by_user_type_date", (q) => {
          const base = q
            .eq("userId", identity.tokenIdentifier)
            .eq("type", args.type!);
          if (args.startDate && args.endDate) {
            return base.gte("date", args.startDate).lte("date", args.endDate);
          } else if (args.startDate) {
            return base.gte("date", args.startDate);
          } else if (args.endDate) {
            return base.lte("date", args.endDate);
          }
          return base;
        })
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("transactions")
      .withIndex("by_user_date", (q) => {
        const base = q.eq("userId", identity.tokenIdentifier);
        if (args.startDate && args.endDate) {
          return base.gte("date", args.startDate).lte("date", args.endDate);
        } else if (args.startDate) {
          return base.gte("date", args.startDate);
        } else if (args.endDate) {
          return base.lte("date", args.endDate);
        }
        return base;
      })
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getShareholderLoanBalance = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();
    return txns.reduce((sum, tx) => sum + tx.shareholderLoanDelta, 0);
  },
});

export const getShareholderLoanLedger = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("asc")
      .collect();
    let runningBalance = 0;
    const ledger = [];
    for (const tx of txns) {
      if (tx.shareholderLoanDelta !== 0) {
        runningBalance += tx.shareholderLoanDelta;
        ledger.push({ ...tx, runningBalance });
      }
    }
    return ledger;
  },
});

export const getSummary = query({
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
    let totalPersonalExpenses = 0;
    let totalBusinessExpenses = 0;
    let totalTransferToPersonal = 0;
    let totalTransferToBusiness = 0;
    let netShareholderLoanChange = 0;
    for (const tx of txns) {
      netShareholderLoanChange += tx.shareholderLoanDelta;
      switch (tx.type) {
        case "personal_expense":
        case "personal_expense_business_pay":
          totalPersonalExpenses += tx.amount;
          break;
        case "business_expense":
        case "business_expense_personal_pay":
          totalBusinessExpenses += tx.amount;
          break;
        case "transfer_to_personal":
          totalTransferToPersonal += tx.amount;
          break;
        case "transfer_to_business":
          totalTransferToBusiness += tx.amount;
          break;
      }
    }
    return {
      totalPersonalExpenses,
      totalBusinessExpenses,
      totalTransferToPersonal,
      totalTransferToBusiness,
      netShareholderLoanChange,
      transactionCount: txns.length,
    };
  },
});

export const getForExport = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", (q) =>
        q
          .eq("userId", identity.tokenIdentifier)
          .gte("date", args.startDate)
          .lte("date", args.endDate)
      )
      .order("asc")
      .take(2000);
    const result = [];
    for (const tx of txns) {
      let categoryName: string | null = null;
      if (tx.categoryId) {
        const category = await ctx.db.get(tx.categoryId);
        categoryName = category?.name ?? null;
      }
      result.push({ ...tx, categoryName });
    }
    return result;
  },
});
