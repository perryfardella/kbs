/**
 * Compositional transaction model — see /CONTEXT.md and
 * /docs/adr/0001-compositional-transaction-model.md for the domain design
 * this replaces the legacy flat `type` enum with.
 *
 * Plain, framework-agnostic module (no `convex/values`, no React) so both
 * Convex functions and frontend code can import it — mirrors how
 * `convex/recurringTransactions.ts` already imports `lib/recurrence.ts`.
 */

export type Kind = "income" | "expense" | "transfer";
export type Realm = "personal" | "business" | "rental";
export type Side = "personal" | "business";
export type Purpose = "dividend";

export const KINDS: readonly Kind[] = ["income", "expense", "transfer"];
export const REALMS: readonly Realm[] = ["personal", "business", "rental"];
export const SIDES: readonly Side[] = ["personal", "business"];
export const PURPOSES: readonly Purpose[] = ["dividend"];

export interface IncomeExpenseShape {
  kind: "income" | "expense";
  realm: Realm;
  /** Which account the cash actually moved through. Only meaningful when
   * `realm !== "rental"`; defaults to `realm` when omitted. */
  account?: Side;
}

export interface TransferShape {
  kind: "transfer";
  from: Side;
  to: Side;
  /** Only valid when `from === "business" && to === "personal"`. */
  purpose?: Purpose;
}

export type TransactionShape = IncomeExpenseShape | TransferShape;

function transferDelta(from: Side, to: Side, amount: number): number {
  if (from === to) return 0;
  return from === "personal" ? amount : -amount;
}

/**
 * Unified shareholder-loan-delta formula, replacing the legacy per-type
 * `computeDelta` switch duplicated across transactions.ts,
 * recurringTransactions.ts, and seed.ts.
 *
 * expense(realm=X, account=Y) behaves like transfer(from=Y, to=X)
 * income(realm=X, account=Y)  behaves like transfer(from=X, to=Y)
 * transfer(from=A, to=B)      personal→business = +amount, business→personal = -amount
 * anything touching "rental"  always 0
 */
export function computeShareholderLoanDelta(shape: TransactionShape, amount: number): number {
  if (shape.kind === "transfer") {
    return transferDelta(shape.from, shape.to, amount);
  }
  const realm = shape.realm;
  if (realm === "rental") return 0;
  const account: Side = shape.account ?? realm;
  return shape.kind === "expense"
    ? transferDelta(account, realm, amount)
    : transferDelta(realm, account, amount);
}

export type CashDirection = "you-to-corp" | "corp-to-you";

// Only two Sides exist and the two never match on a row reaching this function
// (delta would be 0, so it'd be filtered out of the ledger upstream) — direction
// is fully determined by where cash originates.
function directionFrom(from: Side): CashDirection {
  return from === "personal" ? "you-to-corp" : "corp-to-you";
}

/**
 * Which way cash physically moved for this row — independent of the loan-delta
 * sign (see docs/handoff for the loan ledger redesign). Mirrors transferDelta's
 * from/to handling: expense(realm=X, account=Y) moves cash Y → X, income(realm=X,
 * account=Y) moves cash X → Y. Rental never reaches this — computeShareholderLoanDelta
 * returns 0 for it, so rental rows are filtered out of the ledger upstream.
 */
export function deriveCashDirection(shape: TransactionShape): CashDirection {
  if (shape.kind === "transfer") {
    return directionFrom(shape.from);
  }
  const realm = shape.realm as Side;
  const account = (shape.account ?? shape.realm) as Side;
  return directionFrom(shape.kind === "expense" ? account : realm);
}

/** Same as shapeFromFields, but returns null instead of throwing — for UI code reading a form mid-fill-out. */
export function tryShapeFromFields(fields: LooseShapeFields): TransactionShape | null {
  try {
    return shapeFromFields(fields);
  } catch {
    return null;
  }
}

/** Loan-impact banner copy for a (possibly incomplete) shape — null shape or zero delta means no banner. */
export function getLoanImpact(
  shape: TransactionShape | null,
  amount: number
): { text: string; positive: boolean } | null {
  if (!shape || !(amount > 0)) return null;
  const delta = computeShareholderLoanDelta(shape, amount);
  if (delta === 0) return null;
  const fmt = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(Math.abs(delta));
  return delta > 0
    ? { text: `This will increase the corp's debt to you by ${fmt}`, positive: true }
    : { text: `This will decrease the corp's debt to you by ${fmt}`, positive: false };
}

export interface TransactionShapeFields {
  kind: Kind;
  realm: Realm | undefined;
  account: Side | undefined;
  from: Side | undefined;
  to: Side | undefined;
  purpose: Purpose | undefined;
}

/**
 * Expands a TransactionShape into the full set of storage fields, with fields
 * that don't apply to this shape explicitly set to `undefined`. Use this
 * (rather than spreading a TransactionShape directly) in `ctx.db.patch` calls —
 * Convex treats an explicit `undefined` as "unset this field," unlike omitting
 * the key, which leaves any stale value from a previous shape untouched.
 */
export function toStorageFields(shape: TransactionShape): TransactionShapeFields {
  if (shape.kind === "transfer") {
    return {
      kind: shape.kind,
      realm: undefined,
      account: undefined,
      from: shape.from,
      to: shape.to,
      purpose: shape.purpose,
    };
  }
  return {
    kind: shape.kind,
    realm: shape.realm,
    account: shape.account,
    from: undefined,
    to: undefined,
    purpose: undefined,
  };
}

export type LegacyTransactionType =
  | "personal_expense"
  | "business_expense"
  | "business_expense_personal_pay"
  | "personal_expense_business_pay"
  | "transfer_to_personal"
  | "transfer_to_business"
  | "dividend_payment"
  | "rental_income"
  | "rental_expense"
  | "business_income"
  | "personal_income";

export const LEGACY_TRANSACTION_TYPES: readonly LegacyTransactionType[] = [
  "personal_expense",
  "business_expense",
  "business_expense_personal_pay",
  "personal_expense_business_pay",
  "transfer_to_personal",
  "transfer_to_business",
  "dividend_payment",
  "rental_income",
  "rental_expense",
  "business_income",
  "personal_income",
];

/**
 * Deterministic legacy → new-shape mapping. Every historical `dividend_payment`
 * row maps to a dividend-tagged transfer (not a plain transfer) — per explicit
 * product decision, since users had a specific reason to record them as
 * dividends rather than generic transfers.
 */
export const LEGACY_TYPE_TO_SHAPE: Record<LegacyTransactionType, TransactionShape> = {
  personal_expense: { kind: "expense", realm: "personal", account: "personal" },
  business_expense: { kind: "expense", realm: "business", account: "business" },
  business_expense_personal_pay: { kind: "expense", realm: "business", account: "personal" },
  personal_expense_business_pay: { kind: "expense", realm: "personal", account: "business" },
  transfer_to_personal: { kind: "transfer", from: "business", to: "personal" },
  transfer_to_business: { kind: "transfer", from: "personal", to: "business" },
  dividend_payment: { kind: "transfer", from: "business", to: "personal", purpose: "dividend" },
  rental_income: { kind: "income", realm: "rental" },
  rental_expense: { kind: "expense", realm: "rental" },
  business_income: { kind: "income", realm: "business", account: "business" },
  personal_income: { kind: "income", realm: "personal", account: "personal" },
};

export const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfer" },
];

export const REALM_OPTIONS: { value: Realm; label: string }[] = [
  { value: "personal", label: "Personal" },
  { value: "business", label: "Business" },
  { value: "rental", label: "Rental" },
];

export const SIDE_OPTIONS: { value: Side; label: string }[] = [
  { value: "personal", label: "Personal" },
  { value: "business", label: "Business" },
];

export const PURPOSE_OPTIONS: { value: Purpose; label: string }[] = [
  { value: "dividend", label: "Dividend" },
];

/**
 * Category realm a transaction shape should filter/require categories against.
 * Null for transfers, and also for rental income — rental income has never
 * been categorized (it's just "rent received"), only rental expenses are
 * (repairs, mortgage interest, etc.), matching the legacy EXPENSE_TYPE_REALMS
 * table where `rental_income` mapped to `null` but `rental_expense` to `"rental"`.
 */
export function categoryRealmFor(shape: TransactionShape): Realm | null {
  if (shape.kind === "transfer") return null;
  if (shape.kind === "income" && shape.realm === "rental") return null;
  return shape.realm;
}

/** Whether this shape must be tagged to a property. */
export function requiresProperty(shape: TransactionShape): boolean {
  return shape.kind !== "transfer" && shape.realm === "rental";
}

export type BadgeVariant = "personal" | "business" | "rental" | "transfer";

export function badgeVariantFor(shape: TransactionShape): BadgeVariant {
  return shape.kind === "transfer" ? "transfer" : shape.realm;
}

const SIDE_LABEL: Record<Side, string> = { personal: "Personal", business: "Business" };
const REALM_LABEL: Record<Realm, string> = {
  personal: "Personal",
  business: "Business",
  rental: "Rental",
};

/**
 * Fields as they come off a stored document or mutation args — same shape as
 * TransactionShapeFields but every field optional, since a document mid-migration
 * (or a not-yet-validated mutation arg) may not have them all set.
 */
export interface LooseShapeFields {
  kind?: Kind;
  realm?: Realm;
  account?: Side;
  from?: Side;
  to?: Side;
  purpose?: Purpose;
}

/**
 * Reconstructs a validated TransactionShape from loose fields (a stored
 * document's own kind/realm/account/from/to/purpose, or create/update mutation
 * args) — the inverse of toStorageFields. Throws on missing/incoherent data
 * rather than guessing, since this only ever runs on data that should already
 * be well-formed (post-migration documents, or args shaped by the Convex
 * validators in transactions.ts/recurringTransactions.ts).
 */
export function shapeFromFields(fields: LooseShapeFields): TransactionShape {
  if (!fields.kind) throw new Error("Transaction is missing a kind");
  if (fields.kind === "transfer") {
    if (!fields.from || !fields.to) throw new Error("Transfer is missing from/to");
    if (fields.from === fields.to) throw new Error("Transfer from and to must differ");
    return { kind: "transfer", from: fields.from, to: fields.to, purpose: fields.purpose };
  }
  if (!fields.realm) throw new Error(`${fields.kind} is missing a realm`);
  return { kind: fields.kind, realm: fields.realm, account: fields.account };
}

/** Human-readable label for a transaction shape — replaces TYPE_LABELS and the duplicated typeConfig maps. */
export function describeTransactionType(shape: TransactionShape): string {
  if (shape.kind === "transfer") {
    if (shape.purpose === "dividend") return "Dividend";
    if (shape.from === shape.to) return "Transfer";
    return `${SIDE_LABEL[shape.from]} → ${SIDE_LABEL[shape.to]} Transfer`;
  }
  const kindLabel = shape.kind === "income" ? "Income" : "Expense";
  const base = `${REALM_LABEL[shape.realm]} ${kindLabel}`;
  if (shape.realm === "rental") return base;
  const account = shape.account ?? shape.realm;
  if (account === shape.realm) return base;
  return shape.kind === "expense"
    ? `${base} (${SIDE_LABEL[account]} Pay)`
    : `${base} (via ${SIDE_LABEL[account]})`;
}
