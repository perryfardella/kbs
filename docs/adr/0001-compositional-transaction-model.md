# Compositional transaction model instead of a flat type enum

**Status**: accepted

The transaction `type` field was an 11-literal flat enum (`business_expense_personal_pay`, `dividend_payment`, etc.) that conflated three orthogonal concerns — Kind, Realm, and payer — into single strings. This made `dividend_payment` a forced union of two distinct real-world events (a declared dividend vs. a loan repayment): both always applied the same Shareholder Loan effect, and neither ever appeared in the personal income report, because the enum had no room to express "this transfer is also income."

We replaced it with a compositional shape: `kind` (`income`/`expense`/`transfer`) plus, depending on kind, `for`+`account` (income/expense) or `from`+`to` (transfer), plus an optional `purpose` tag on transfers (currently only `dividend`). The Shareholder Loan delta is now one formula derived from these fields instead of a per-literal switch statement.

## Considered Options

- **Keep `dividend` as its own 4th top-level kind**, separate from transfer. Rejected: a dividend has no cash-movement machinery of its own — it *is* a business→personal transfer, just one that also posts to personal income. Modeling it as a 4th kind would have required duplicating the transfer plumbing (loan delta, from/to accounts) for no benefit.
- **Model `rental` as an attribute of `business`** (a `propertyId` under the business Realm) rather than a peer Realm. Rejected: the client wants rental income/expense to sit fully outside the Shareholder Loan and generate its own report, never interacting with `personal`/`business` cash movement — that only works cleanly as a fully separate Realm, not a business sub-attribute.
- **Give `income` only a `for` field**, mirroring the old enum's asymmetry. Rejected once a real production scenario surfaced: business revenue paid directly into the personal account, previously requiring two transactions (an income row plus a manual transfer) as a workaround. Adding `account` to income (mirroring expense's `paidBy`) collapses that into one row and reuses the same loan-delta mechanism as everything else.

## Consequences

- All 11 legacy literals, including historical `dividend_payment` rows, require a one-time data migration on both dev and prod deployments before the old `type` field can be removed. Historical `dividend_payment` rows migrate to `transfer(from=business, to=personal, purpose=dividend)`, not plain transfers — per explicit product decision, since users had a specific reason to record them as dividends rather than generic transfers.
- Every place that branched on the old type literals (loan delta, category-visibility rules, property-requirement rules, the loan-impact banner, `getSummary` bucketing, `TRANSFER_TYPES` badge grouping) needs to be rewritten against the new compositional fields.
