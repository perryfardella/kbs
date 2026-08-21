# Finance Tracker

Personal and business finance tracking for a shareholder who moves money between themself and their company, plus a separate rental property book.

## Language

**Transaction**:
A single recorded movement or attribution of money — an income, an expense, or a transfer between accounts.

**Kind**:
The top-level shape of a transaction: `income`, `expense`, or `transfer`. Distinct from Category, which classifies what the money was for within a kind.
_Avoid_: Type (the legacy flat `type` enum this replaces), Category

**Realm** (`for`):
The P&L bucket an income or expense transaction is attributed to: `personal`, `business`, or `rental`. Determines which report the transaction appears in. Transfers don't have a Realm — they have a source and destination instead (see Transfer).
_Avoid_: Type, side

**Account**:
The bank account cash actually moved through for an income or expense transaction: `personal` or `business`. Defaults to match the transaction's Realm — most transactions never touch this. Only set explicitly when cash lands somewhere unexpected (e.g. business revenue paid into the personal account, or a personal expense paid with the business card). Not applicable to `rental` transactions — rental never touches the Shareholder Loan.
_Avoid_: Paid by, Payer — both are asymmetric and only read correctly for expenses, not income

**Transfer**:
A transaction that moves money between the `personal` and `business` accounts directly, with no P&L attribution. Has a `from` and a `to` (each `personal` or `business`) instead of a Realm and an Account.

**Repayment**:
Not a distinct concept — any Transfer between `personal` and `business`, in either direction, carrying no purpose tag. "Repayment" describes intent, not a stored value.
_Avoid_: modeling this as its own kind or purpose

**Dividend**:
A Transfer from `business` to `personal`, tagged `purpose: dividend`. Only valid in that direction — a dividend is corp-to-shareholder by definition. Always appears in the personal income report under its own "Dividend income" bucket, regardless of whether it's paid. Its effect on the Shareholder Loan depends on `dividendPaid`:
- **Not paid** (declared only, no cash moves): reduces what the shareholder owes the corp / increases what the corp owes the shareholder by `+amount` — it's booked straight against the loan instead of being paid out.
- **Paid** (real cash moves business → personal): the declaration leg and the cash leg cancel, so the net effect on the Shareholder Loan is `0`. The loan ledger still shows the row (as a cash movement with no balance impact), it just doesn't move the running balance.
_Avoid_: Repayment, Distribution

**Shareholder Loan**:
The running balance of what the business owes its shareholder (negative if the shareholder owes the business instead), derived from every transaction's implied money movement between the `personal` and `business` accounts. Rental transactions never affect it, regardless of which account paid or received the cash.
_Avoid_: Loan account

**Category** (pre-existing, unchanged by this redesign):
A user-defined tag (e.g. "Groceries," "Software") scoped to a Realm, selected via `categoryId`. Orthogonal to Kind — Categories exist for income and expense transactions; Transfers don't have one.
