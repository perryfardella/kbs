import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Id } from "./_generated/dataModel";
import {
  computeShareholderLoanDelta,
  expandLoanLedgerRows,
  shapeFromFields,
  toStorageFields,
} from "../lib/transactionFields";

const transactionTypeValidator = v.union(
  v.literal("personal_expense"),
  v.literal("business_expense"),
  v.literal("business_expense_personal_pay"),
  v.literal("personal_expense_business_pay"),
  v.literal("transfer_to_personal"),
  v.literal("transfer_to_business"),
  v.literal("dividend_payment"),
  v.literal("rental_income"),
  v.literal("rental_expense"),
  v.literal("business_income"),
  v.literal("personal_income")
);

const shapeArgs = {
  kind: v.union(v.literal("income"), v.literal("expense"), v.literal("transfer")),
  realm: v.optional(v.union(v.literal("personal"), v.literal("business"), v.literal("rental"))),
  account: v.optional(v.union(v.literal("personal"), v.literal("business"))),
  from: v.optional(v.union(v.literal("personal"), v.literal("business"))),
  to: v.optional(v.union(v.literal("personal"), v.literal("business"))),
  purpose: v.optional(v.literal("dividend")),
  paidDate: v.optional(v.string()),
};

// Dividends are a corp → shareholder distribution by definition — never the reverse.
function assertValidPurpose(fields: { from?: "personal" | "business"; to?: "personal" | "business"; purpose?: "dividend" }) {
  if (fields.purpose === "dividend" && !(fields.from === "business" && fields.to === "personal")) {
    throw new Error("A dividend must be a business → personal transfer");
  }
}

// A dividend can only be paid on or after the day it was declared.
function assertValidPaidDate(fields: { date: string; purpose?: "dividend"; paidDate?: string }) {
  if (fields.purpose === "dividend" && fields.paidDate !== undefined && fields.paidDate < fields.date) {
    throw new Error("Paid date can't be before the declared date");
  }
}

// paidDate only applies to a dividend transfer — clear it explicitly for every other
// shape so patching away from a dividend doesn't leave a stale value behind.
function paidDateFor(shape: { kind: string; purpose?: "dividend" }, paidDate: string | undefined) {
  return shape.kind === "transfer" && shape.purpose === "dividend" ? paidDate : undefined;
}

// A paid dividend nets to a 0 shareholderLoanDelta (the declaration and cash legs cancel),
// but it still belongs on the loan ledger — it's the whole reason the row exists. Every
// other 0-delta transaction (rental, same-account expense, etc.) is genuinely loan-inert
// and stays excluded.
function belongsOnLoanLedger(tx: { shareholderLoanDelta: number; purpose?: "dividend" }) {
  return tx.shareholderLoanDelta !== 0 || tx.purpose === "dividend";
}

export const create = mutation({
  args: {
    date: v.string(),
    amount: v.number(),
    description: v.string(),
    notes: v.optional(v.string()),
    ...shapeArgs,
    categoryId: v.optional(v.id("categories")),
    propertyId: v.optional(v.id("properties")),
    receiptStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    assertValidPurpose(args);
    assertValidPaidDate(args);
    const shape = shapeFromFields(args);
    const shareholderLoanDelta = computeShareholderLoanDelta(shape, args.amount);
    return await ctx.db.insert("transactions", {
      userId: identity.tokenIdentifier,
      date: args.date,
      amount: args.amount,
      description: args.description,
      notes: args.notes,
      ...toStorageFields(shape),
      paidDate: paidDateFor(shape, args.paidDate),
      categoryId: args.categoryId,
      propertyId: args.propertyId,
      receiptStorageIds: args.receiptStorageIds,
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
    ...shapeArgs,
    categoryId: v.optional(v.id("categories")),
    propertyId: v.optional(v.id("properties")),
    receiptStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const tx = await ctx.db.get(args.transactionId);
    if (!tx) throw new Error("Transaction not found");
    if (tx.userId !== identity.tokenIdentifier) throw new Error("Unauthorized");
    assertValidPurpose(args);
    assertValidPaidDate(args);
    const shape = shapeFromFields(args);
    const shareholderLoanDelta = computeShareholderLoanDelta(shape, args.amount);
    await ctx.db.patch(args.transactionId, {
      date: args.date,
      amount: args.amount,
      description: args.description,
      notes: args.notes,
      ...toStorageFields(shape),
      paidDate: paidDateFor(shape, args.paidDate),
      categoryId: args.categoryId,
      propertyId: args.propertyId,
      receiptStorageIds: args.receiptStorageIds,
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
    propertyId: v.optional(v.id("properties")),
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

    if (args.propertyId) {
      return await ctx.db
        .query("transactions")
        .withIndex("by_user_property_date", (q) => {
          const base = q
            .eq("userId", identity.tokenIdentifier)
            .eq("propertyId", args.propertyId!);
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
    const rows = expandLoanLedgerRows(txns.filter(belongsOnLoanLedger));
    let runningBalance = 0;
    const ledger = [];
    for (const row of rows) {
      runningBalance += row.shareholderLoanDelta;
      ledger.push({ ...row, runningBalance });
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
    let totalPersonalIncome = 0;
    let totalBusinessIncome = 0;
    let totalTransferToPersonal = 0;
    let totalTransferToBusiness = 0;
    let netShareholderLoanChange = 0;
    for (const tx of txns) {
      netShareholderLoanChange += tx.shareholderLoanDelta;
      if (tx.kind === "expense") {
        if (tx.realm === "personal") totalPersonalExpenses += tx.amount;
        else if (tx.realm === "business") totalBusinessExpenses += tx.amount;
      } else if (tx.kind === "income") {
        if (tx.realm === "personal") totalPersonalIncome += tx.amount;
        else if (tx.realm === "business") totalBusinessIncome += tx.amount;
      } else if (tx.kind === "transfer") {
        // A dividend is a business→personal transfer that also counts as
        // personal income (its whole point, per the domain model).
        if (tx.purpose === "dividend") totalPersonalIncome += tx.amount;
        else if (tx.to === "personal") totalTransferToPersonal += tx.amount;
        else if (tx.to === "business") totalTransferToBusiness += tx.amount;
      }
    }
    return {
      totalPersonalExpenses,
      totalBusinessExpenses,
      totalPersonalIncome,
      totalBusinessIncome,
      netPersonal: totalPersonalIncome - totalPersonalExpenses,
      netBusiness: totalBusinessIncome - totalBusinessExpenses,
      totalTransferToPersonal,
      totalTransferToBusiness,
      netShareholderLoanChange,
      transactionCount: txns.length,
    };
  },
});

async function joinCategoryNames<T extends { categoryId?: Id<"categories"> }>(
  ctx: QueryCtx,
  userId: string,
  txns: T[]
): Promise<(T & { categoryName: string | null })[]> {
  const categories = await ctx.db
    .query("categories")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const categoryNames = new Map(categories.map((c) => [c._id, c.name]));
  return txns.map((tx) => ({
    ...tx,
    categoryName: tx.categoryId ? (categoryNames.get(tx.categoryId) ?? null) : null,
  }));
}

export const getExpenseBreakdown = query({
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
      .order("asc")
      .take(2000);

    const personalTxns = txns.filter((tx) => tx.kind === "expense" && tx.realm === "personal");
    const businessTxns = txns.filter((tx) => tx.kind === "expense" && tx.realm === "business");
    const personalIncomeTxns = txns.filter(
      (tx) => (tx.kind === "income" && tx.realm === "personal") || (tx.kind === "transfer" && tx.purpose === "dividend")
    );
    const businessIncomeTxns = txns.filter((tx) => tx.kind === "income" && tx.realm === "business");

    const personalRows = await joinCategoryNames(ctx, identity.tokenIdentifier, personalTxns);
    const businessRows = await joinCategoryNames(ctx, identity.tokenIdentifier, businessTxns);
    // Dividends have no categoryId (they're transfers, not categorized expenses/income) —
    // give them a synthetic category label so they group into their own "Dividend Income"
    // row in the breakdown rather than falling into "Uncategorized".
    const personalIncomeRows = (await joinCategoryNames(ctx, identity.tokenIdentifier, personalIncomeTxns)).map((tx) =>
      tx.purpose === "dividend" ? { ...tx, categoryName: "Dividend Income" } : tx
    );
    const businessIncomeRows = await joinCategoryNames(ctx, identity.tokenIdentifier, businessIncomeTxns);

    return {
      personal: summarizeByCategory(personalRows),
      business: summarizeByCategory(businessRows),
      personalIncome: summarizeByCategory(personalIncomeRows),
      businessIncome: summarizeByCategory(businessIncomeRows),
    };
  },
});

function summarizeByCategory<
  T extends { categoryId?: Id<"categories">; categoryName: string | null; amount: number },
>(rows: T[]) {
  const byCategoryMap = new Map<string, { categoryId: Id<"categories"> | null; name: string; amount: number }>();
  let total = 0;
  for (const row of rows) {
    total += row.amount;
    const key = row.categoryId ?? row.categoryName ?? "uncategorized";
    const name = row.categoryName ?? "Uncategorized";
    const existing = byCategoryMap.get(key);
    if (existing) {
      existing.amount += row.amount;
    } else {
      byCategoryMap.set(key, { categoryId: row.categoryId ?? null, name, amount: row.amount });
    }
  }
  const byCategory = Array.from(byCategoryMap.values()).sort((a, b) => b.amount - a.amount);
  return { total, byCategory, rows };
}

export const getLoanLedgerRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("asc")
      .collect();
    const rows = expandLoanLedgerRows(txns.filter(belongsOnLoanLedger));

    let runningBalance = 0;
    let openingBalance = 0;
    const entries = [];
    for (const row of rows) {
      const isBeforeRange = row.date < args.startDate;
      runningBalance += row.shareholderLoanDelta;
      if (isBeforeRange) {
        openingBalance = runningBalance;
      } else if (row.date <= args.endDate) {
        entries.push({ ...row, runningBalance });
      }
    }
    const closingBalance = entries.length > 0
      ? entries[entries.length - 1].runningBalance
      : openingBalance;

    return { openingBalance, closingBalance, entries };
  },
});
