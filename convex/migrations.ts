import { internalMutation, internalQuery } from "./_generated/server";
import {
  LEGACY_TYPE_TO_SHAPE,
  computeShareholderLoanDelta,
  toStorageFields,
} from "../lib/transactionFields";

// NOTE: this uses a plain internalMutation rather than the @convex-dev/migrations
// component. That component requires convex@^1.42.0 (calls ctx.meta.getFunctionMetadata,
// which doesn't exist on the convex@1.34.0 pinned in this repo) — its runner() threw
// "Cannot read properties of undefined (reading 'getFunctionMetadata')" against this
// deployment. Upgrading the core `convex` package is a separate, bigger decision than
// this migration, so this instead follows the "small table shortcut" documented by the
// convex-migration-helper skill: a single internalMutation, safe at this dataset's scale
// (hundreds of rows, well within one mutation's read/write limits).

/**
 * Read-only, full-dataset review of what runTransactionMigration would do.
 * This is the actual human checkpoint before running the real migration —
 * run it and review the output before calling runTransactionMigration.
 */
export const previewTransactionMigration = internalQuery({
  args: {},
  handler: async (ctx) => {
    const txns = await ctx.db.query("transactions").collect();

    let alreadyMigrated = 0;
    let missingType = 0;
    const countsByLegacyType: Record<string, number> = {};
    const deltaMismatches: Array<{
      _id: string;
      type: string;
      amount: number;
      storedDelta: number;
      computedDelta: number;
    }> = [];
    const rows: Array<{
      _id: string;
      date: string;
      type: string;
      amount: number;
      storedDelta: number;
      computedDelta: number;
      derivedShape: unknown;
    }> = [];

    for (const tx of txns) {
      if (tx.kind !== undefined) {
        alreadyMigrated++;
        continue;
      }
      if (!tx.type) {
        missingType++;
        continue;
      }
      countsByLegacyType[tx.type] = (countsByLegacyType[tx.type] ?? 0) + 1;
      const shape = LEGACY_TYPE_TO_SHAPE[tx.type];
      const computedDelta = computeShareholderLoanDelta(shape, tx.amount);
      const row = {
        _id: tx._id,
        date: tx.date,
        type: tx.type,
        amount: tx.amount,
        storedDelta: tx.shareholderLoanDelta,
        computedDelta,
        derivedShape: shape,
      };
      rows.push(row);
      if (computedDelta !== tx.shareholderLoanDelta) {
        deltaMismatches.push(row);
      }
    }

    return {
      totalTransactions: txns.length,
      alreadyMigrated,
      missingType,
      toMigrate: txns.length - alreadyMigrated - missingType,
      countsByLegacyType,
      deltaMismatchCount: deltaMismatches.length,
      deltaMismatches,
      rows,
    };
  },
});

/** Same idea as previewTransactionMigration, for recurringTransactions (no stored delta to compare). */
export const previewRecurringMigration = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db.query("recurringTransactions").collect();

    let alreadyMigrated = 0;
    let missingType = 0;
    const countsByLegacyType: Record<string, number> = {};
    const rows: Array<{
      _id: string;
      description: string;
      type: string;
      derivedShape: unknown;
    }> = [];

    for (const rule of rules) {
      if (rule.kind !== undefined) {
        alreadyMigrated++;
        continue;
      }
      if (!rule.type) {
        missingType++;
        continue;
      }
      countsByLegacyType[rule.type] = (countsByLegacyType[rule.type] ?? 0) + 1;
      rows.push({
        _id: rule._id,
        description: rule.description,
        type: rule.type,
        derivedShape: LEGACY_TYPE_TO_SHAPE[rule.type],
      });
    }

    return {
      totalRules: rules.length,
      alreadyMigrated,
      missingType,
      toMigrate: rules.length - alreadyMigrated - missingType,
      countsByLegacyType,
      rows,
    };
  },
});

/**
 * The real migration for `transactions`. Backfills kind/realm/account/from/to/purpose
 * from the legacy `type` field and recomputes shareholderLoanDelta from the new unified
 * formula (per explicit product decision — not just preserving the stored value).
 * Idempotent: skips any row that already has `kind` set, so it's safe to re-run.
 */
export const runTransactionMigration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const txns = await ctx.db.query("transactions").collect();
    let migrated = 0;
    let skippedAlreadyMigrated = 0;
    let skippedMissingType = 0;

    for (const tx of txns) {
      if (tx.kind !== undefined) {
        skippedAlreadyMigrated++;
        continue;
      }
      if (!tx.type) {
        skippedMissingType++;
        continue;
      }
      const shape = LEGACY_TYPE_TO_SHAPE[tx.type];
      const shareholderLoanDelta = computeShareholderLoanDelta(shape, tx.amount);
      await ctx.db.patch(tx._id, { ...toStorageFields(shape), shareholderLoanDelta });
      migrated++;
    }

    return { migrated, skippedAlreadyMigrated, skippedMissingType, total: txns.length };
  },
});

/** The real migration for `recurringTransactions`. Same idea, no delta to recompute. */
export const runRecurringMigration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db.query("recurringTransactions").collect();
    let migrated = 0;
    let skippedAlreadyMigrated = 0;
    let skippedMissingType = 0;

    for (const rule of rules) {
      if (rule.kind !== undefined) {
        skippedAlreadyMigrated++;
        continue;
      }
      if (!rule.type) {
        skippedMissingType++;
        continue;
      }
      const shape = LEGACY_TYPE_TO_SHAPE[rule.type];
      await ctx.db.patch(rule._id, toStorageFields(shape));
      migrated++;
    }

    return { migrated, skippedAlreadyMigrated, skippedMissingType, total: rules.length };
  },
});

/** Confirms zero rows are left unmigrated — run after runTransactionMigration/runRecurringMigration. */
export const verifyMigrationComplete = internalQuery({
  args: {},
  handler: async (ctx) => {
    const txns = await ctx.db.query("transactions").collect();
    const rules = await ctx.db.query("recurringTransactions").collect();
    const unmigratedTxns = txns.filter((tx) => tx.kind === undefined && tx.type !== undefined);
    const unmigratedRules = rules.filter(
      (rule) => rule.kind === undefined && rule.type !== undefined
    );
    return {
      transactionsTotal: txns.length,
      transactionsUnmigrated: unmigratedTxns.length,
      unmigratedTransactionIds: unmigratedTxns.map((tx) => tx._id),
      recurringTotal: rules.length,
      recurringUnmigrated: unmigratedRules.length,
      unmigratedRecurringIds: unmigratedRules.map((rule) => rule._id),
    };
  },
});

/**
 * dividendPaid backfill — human checkpoint (per explicit product decision, discussed with
 * the user in chat: every historical dividend was recorded assuming cash was always paid,
 * i.e. shareholderLoanDelta === -amount. Going forward, "paid" nets to 0 and "not paid"
 * is +amount — see lib/transactionFields.ts computeShareholderLoanDelta. Historical rows
 * are being backfilled as NOT PAID, which flips their stored delta from -amount to
 * +amount. This is a real, visible change to every subsequent running balance in the
 * loan ledger — review this preview's totalNewDelta/netRunningBalanceShift before running
 * runDividendPaidMigration.
 */
export const previewDividendPaidMigration = internalQuery({
  args: {},
  handler: async (ctx) => {
    const txns = await ctx.db.query("transactions").collect();

    let notDividend = 0;
    let alreadyMigrated = 0;
    let totalCurrentDelta = 0;
    let totalNewDelta = 0;
    const rows: Array<{
      _id: string;
      date: string;
      description: string;
      amount: number;
      storedDelta: number;
      newDelta: number;
    }> = [];

    for (const tx of txns) {
      if (tx.purpose !== "dividend") {
        notDividend++;
        continue;
      }
      if (tx.dividendPaid !== undefined) {
        alreadyMigrated++;
        continue;
      }
      totalCurrentDelta += tx.shareholderLoanDelta;
      totalNewDelta += tx.amount; // not-paid dividend delta is always +amount
      rows.push({
        _id: tx._id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        storedDelta: tx.shareholderLoanDelta,
        newDelta: tx.amount,
      });
    }

    return {
      totalTransactions: txns.length,
      notDividend,
      alreadyMigrated,
      toMigrate: rows.length,
      totalCurrentDelta,
      totalNewDelta,
      // How much the final running balance moves once this migration runs.
      netRunningBalanceShift: totalNewDelta - totalCurrentDelta,
      rows,
    };
  },
});

/**
 * The real dividendPaid backfill for `transactions`. Sets dividendPaid: false and
 * recomputes shareholderLoanDelta from -amount to +amount on every historical dividend
 * row. Idempotent: skips any row that already has dividendPaid set, so it's safe to
 * re-run. Run previewDividendPaidMigration first and review the numbers.
 */
export const runDividendPaidMigration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const txns = await ctx.db.query("transactions").collect();
    let migrated = 0;
    let skippedAlreadyMigrated = 0;
    let skippedNotDividend = 0;

    for (const tx of txns) {
      if (tx.purpose !== "dividend") {
        skippedNotDividend++;
        continue;
      }
      if (tx.dividendPaid !== undefined) {
        skippedAlreadyMigrated++;
        continue;
      }
      await ctx.db.patch(tx._id, { dividendPaid: false, shareholderLoanDelta: tx.amount });
      migrated++;
    }

    return { migrated, skippedAlreadyMigrated, skippedNotDividend, total: txns.length };
  },
});

/**
 * Renames default categories that carried a redundant "(business)"/"(personal)"
 * suffix — now that `realm` already distinguishes them, e.g. "Bank Fees (business)"
 * and "Bank Fees (personal)" both become "Bank Fees" (business/personal realm
 * still tells them apart). Only touches rows where isDefault is true and the name
 * exactly matches one of the old default names below, so custom categories users
 * added themselves are never renamed — even a custom category that happens to
 * share an old default's exact name is left alone, since isDefault is false for it.
 */
const CATEGORY_RENAME_MAP: Record<string, string> = {
  "Phone & Internet (business portion)": "Phone & Internet",
  "Travel & Transportation (business)": "Travel & Transportation",
  "Meals & Entertainment (business)": "Meals & Entertainment",
  "Bank Fees (business)": "Bank Fees",
  "Travel (personal)": "Travel",
  "Bank Fees (personal)": "Bank Fees",
};

/** Read-only preview of what runCategoryRenameMigration would change. Review before running it. */
export const previewCategoryRenameMigration = internalQuery({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();

    let notDefault = 0;
    let noRenameNeeded = 0;
    const rows: Array<{
      _id: string;
      userId: string;
      realm: string;
      oldName: string;
      newName: string;
    }> = [];

    for (const category of categories) {
      if (!category.isDefault) {
        notDefault++;
        continue;
      }
      const newName = CATEGORY_RENAME_MAP[category.name];
      if (!newName) {
        noRenameNeeded++;
        continue;
      }
      rows.push({
        _id: category._id,
        userId: category.userId,
        realm: category.realm,
        oldName: category.name,
        newName,
      });
    }

    return {
      totalCategories: categories.length,
      notDefault,
      noRenameNeeded,
      toMigrate: rows.length,
      rows,
    };
  },
});

/**
 * The real migration: renames every default category whose name matches
 * CATEGORY_RENAME_MAP. Idempotent — once renamed, a row no longer matches the
 * map, so it's safe to re-run. Run previewCategoryRenameMigration first.
 */
export const runCategoryRenameMigration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();
    let migrated = 0;
    let skippedNotDefault = 0;
    let skippedNoRenameNeeded = 0;

    for (const category of categories) {
      if (!category.isDefault) {
        skippedNotDefault++;
        continue;
      }
      const newName = CATEGORY_RENAME_MAP[category.name];
      if (!newName) {
        skippedNoRenameNeeded++;
        continue;
      }
      await ctx.db.patch(category._id, { name: newName });
      migrated++;
    }

    return {
      migrated,
      skippedNotDefault,
      skippedNoRenameNeeded,
      total: categories.length,
    };
  },
});

/** Confirms zero default categories are left with an old renamed name — run after runCategoryRenameMigration. */
export const verifyCategoryRenameMigrationComplete = internalQuery({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();
    const unmigrated = categories.filter(
      (c) => c.isDefault && CATEGORY_RENAME_MAP[c.name] !== undefined
    );
    return {
      totalCategories: categories.length,
      unmigrated: unmigrated.length,
      unmigratedIds: unmigrated.map((c) => c._id),
    };
  },
});

/** Same dividendPaid backfill for `recurringTransactions` — no delta to recompute there. */
export const runDividendPaidRecurringMigration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db.query("recurringTransactions").collect();
    let migrated = 0;
    let skippedAlreadyMigrated = 0;
    let skippedNotDividend = 0;

    for (const rule of rules) {
      if (rule.purpose !== "dividend") {
        skippedNotDividend++;
        continue;
      }
      if (rule.dividendPaid !== undefined) {
        skippedAlreadyMigrated++;
        continue;
      }
      await ctx.db.patch(rule._id, { dividendPaid: false });
      migrated++;
    }

    return { migrated, skippedAlreadyMigrated, skippedNotDividend, total: rules.length };
  },
});

/** Confirms zero dividend rows are left without dividendPaid set — run after the two migrations above. */
export const verifyDividendPaidMigrationComplete = internalQuery({
  args: {},
  handler: async (ctx) => {
    const txns = await ctx.db.query("transactions").collect();
    const rules = await ctx.db.query("recurringTransactions").collect();
    const unmigratedTxns = txns.filter(
      (tx) => tx.purpose === "dividend" && tx.dividendPaid === undefined
    );
    const unmigratedRules = rules.filter(
      (rule) => rule.purpose === "dividend" && rule.dividendPaid === undefined
    );
    return {
      transactionsUnmigrated: unmigratedTxns.length,
      unmigratedTransactionIds: unmigratedTxns.map((tx) => tx._id),
      recurringUnmigrated: unmigratedRules.length,
      unmigratedRecurringIds: unmigratedRules.map((rule) => rule._id),
    };
  },
});
