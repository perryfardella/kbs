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
