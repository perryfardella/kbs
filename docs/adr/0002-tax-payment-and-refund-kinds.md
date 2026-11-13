# Income tax as its own kinds (`tax_payment`, `tax_refund`), not an expense category

**Status**: accepted

Income tax paid to the tax authority (corporate or personal) is a settlement of a liability, not an operating cost. Recording it as an `expense` inflated expenses and understated profit; a refund recorded as `income` did the reverse. We added two kinds, `tax_payment` and `tax_refund`, that sit beside `income`, `expense` and `transfer` and are excluded from all of their totals.

A tax row has a `realm` (`personal` or `business`, never `rental`: whose tax it is) and an `account` (which side's cash moved), and no category or property. Its Shareholder Loan delta is the existing formula: `tax_payment` behaves like `expense(realm, account)` and `tax_refund` like `income(realm, account)`. So corporate tax paid from the owner's pocket makes the corp owe the owner, and a refund reverses it. An optional `taxYear` (defaults to the year of `date`) records which year the tax relates to.

## Considered Options

- **Keep `kind: "expense"`/`"income"` and add `purpose: "income_tax"`**, the precedent set by dividends in ADR 0001. Rejected: every P&L total already filters on explicit kinds, so new kinds are excluded from income and expenses for free, whereas a purpose tag would have to be remembered at every total. New kinds break the implicit `kind === "expense" ? … : …` ternaries instead, but that is made safe by a separate `TaxShape` and exhaustive `switch` statements ending in `assertNever`, so a missed branch fails to compile.
- **A special category, or an `isTaxPayment` flag.** Rejected for the same reason: categories are orthogonal to kind, and a flag is invisible to the type system.
- **One kind with a negative amount for refunds.** Rejected: every `amount > 0` validation and every sum assumes positive amounts. Two kinds mirror how income and expense already carry direction.
- **A mandatory tax-period field.** Rejected as heavier than the problem; the optional `taxYear` records it without forcing entry.

## Consequences

- **Reports are cash-basis.** Tax is reported by `date` paid: "paid in period". Business tax on the dashboard uses the fiscal year and personal tax the calendar year. A balance paid in April for last year, this year's instalments and a refund all net together in the same period. `taxYear` is stored and shown but does not yet drive grouping; grouping by tax year is deferred, and would need a rule for which year a corporate fiscal year counts toward.
- **Out of scope:** GST/HST, payroll source deductions, rental property tax (stays a rental expense), taxable interest on a refund, and CRA offsetting a refund against other debts (no cash leg).
- **Server enforces the shape.** Every write path rejects the rental realm for tax and clears `categoryId`/`propertyId`, so the data stays clean whatever the client sent (`scrubTaxFields`).
- **Migration of existing data is manual.** Tax already recorded as expenses (and refunds recorded as income, and recurring rules that generate tax as expenses) are converted by editing them: the Edit form lets the kind change, and the loan delta is recomputed. Converting `expense(realm, account)` to `tax_payment(realm, account)` is loan-neutral. Converted rows leave expense/income, so prior-year P&L figures change; re-export anything already filed.
- **A `Tax` filter chip filters client-side** over the loaded page of transactions, like the other chips.
