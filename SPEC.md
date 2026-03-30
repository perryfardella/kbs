# KBS — Karina's Bookkeeping Service
## Product Specification v1.0

---

## 1. Product Overview

KBS is a mobile-first Progressive Web App (PWA) for a Canadian nurse practitioner who operates through a corporation. It allows her to:

- Log personal and business expenses
- Log transfers between her personal and corporate funds
- Track a running shareholder loan balance (how much her corp owes her, or she owes her corp)
- Export transaction reports for her accountant

The app is **single-user**, **Canadian-context** (CAD currency, no GST/HST tracking required), and optimised for **iPhone Safari PWA** use.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js latest stable at time of build (App Router) |
| Styling | Tailwind CSS |
| Component library | shadcn/ui |
| Backend / DB | Convex |
| Auth | Clerk + `@clerk/nextjs` + Convex Clerk integration |
| File storage | Convex built-in file storage |
| PWA | Next.js native PWA (no third-party package) |
| Language | TypeScript throughout |
| Package manager | pnpm |

**Auth rationale:** Clerk is Convex's own recommended auth path for Next.js apps. Using it from the start avoids a migration, and positions the app for Face ID / biometric login (post-MVP) with no additional auth work required.

---

## 3. Data Model

### `settings` table
One row per user. Created during onboarding.

| Field | Type | Notes |
|---|---|---|
| `userId` | `id("users")` | FK to Convex auth users table |
| `companyName` | `string` | e.g. "Karina Smith NP Corp" — used on CSV exports |
| `fiscalYearEnd` | `string` | `"MM-DD"` format e.g. `"03-31"` for March 31 |
| `currency` | `string` | Default `"CAD"`, read-only for now |
| `loanAlertThreshold` | `number` (optional) | If set, dashboard shows a banner when loan balance exceeds this amount |

Index: `by_user` on `userId`

Owner display name is read from Clerk (`user.fullName`) and not stored in the `settings` table.

---

### `categories` table
Seeded with defaults on first login. User can add custom categories.

| Field | Type | Notes |
|---|---|---|
| `userId` | `id("users")` | |
| `name` | `string` | Display name |
| `realm` | `"personal" \| "business" \| "both"` | Filters which categories appear on which transaction types |
| `isDefault` | `boolean` | `true` = seeded, cannot be deleted, only archived |
| `isArchived` | `boolean` | Hidden from pickers when true |

Index: `by_user` on `userId`

---

### `transactions` table
Core table. Every financial entry the user makes.

| Field | Type | Notes |
|---|---|---|
| `userId` | `id("users")` | |
| `date` | `string` | ISO format `"YYYY-MM-DD"` |
| `amount` | `number` | Always positive, in CAD |
| `description` | `string` | Required |
| `notes` | `string` (optional) | Free text |
| `type` | see enum below | Drives shareholder loan logic |
| `categoryId` | `id("categories")` (optional) | Required for expense types, absent for transfers |
| `receiptStorageId` | `id("_storage")` (optional) | Convex storage ID for receipt image |
| `shareholderLoanDelta` | `number` | Pre-computed impact on loan balance (see rules below) |

Indexes: `by_user`, `by_user_date`, `by_user_type`

#### Transaction Type Enum

| Type | Plain English | Shareholder Loan Delta |
|---|---|---|
| `personal_expense` | Personal money spent on a personal thing | `0` |
| `business_expense` | Business money spent on a business thing | `0` |
| `business_expense_personal_pay` | Paid for a business expense from personal funds | `+amount` (corp owes her more) |
| `personal_expense_business_pay` | Paid for a personal expense from business funds | `-amount` (corp owes her less) |
| `transfer_to_personal` | Corp paid her / transferred money to her personal account | `-amount` (corp owes her less) |
| `transfer_to_business` | She put personal money into the business | `+amount` (corp owes her more) |
| `dividend_payment` | Corp formally paid her a dividend or repaid the shareholder loan | `-amount` (corp owes her less) |

#### Shareholder Loan Balance
`Running balance = SUM(shareholderLoanDelta) across all transactions for userId`

- **Positive balance** → Corp owes her money (she should receive a dividend or repayment)
- **Negative balance** → She owes the corp money

---

## 4. Default Categories (seed on first login)

### Business
- Medical Supplies & Equipment
- Professional Development / CME
- Insurance
- Professional Fees (accounting, legal)
- Office & Admin Supplies
- Software & Subscriptions
- Phone & Internet (business portion)
- Travel & Transportation (business)
- Meals & Entertainment (business)
- Home Office
- Marketing
- Bank Fees (business)
- Other Business

### Personal
- Groceries
- Dining & Restaurants
- Transportation & Gas
- Housing & Utilities
- Health & Wellness
- Clothing & Personal
- Entertainment & Subscriptions
- Travel (personal)
- Bank Fees (personal)
- Other Personal

---

## 5. Application Routes

```
/login                          — Auth screen (password login)
/onboarding                     — First-run setup (name, company, financial year end)
/                               — Dashboard
/add                            — Add transaction
/transactions                   — Transaction list + filters
/transactions/[id]              — Transaction detail / edit
/loan                           — Shareholder loan ledger
/reports                        — Summary stats + CSV export
/settings                       — App settings
/settings/categories            — Category management
```

Route groups:
- `(auth)` — `/login`, `/onboarding` — no nav, no auth guard
- `(app)` — all other routes — requires active Convex session, shows bottom nav + FAB

---

## 6. Screen Specifications

### 6.1 Login (`/login`)
- Username + password form
- On successful login: check if `settings` record exists for user
  - No → redirect to `/onboarding`
  - Yes → redirect to `/`

### 6.2 Onboarding (`/onboarding`)
- Single page, collected sequentially or as a form
- Fields: Owner Name, Company Name, Financial Year End (month picker + day picker)
- On submit: creates `settings` record, seeds default categories, redirects to `/`
- If `settings` already exists, redirect to `/`

### 6.3 Dashboard (`/`)

**Shareholder Loan Card** (hero element)
- Large display of current running balance
- Label: "Corp owes you" (positive) or "You owe corp" (negative)
- Amount formatted as CAD with 2 decimal places
- If `loanAlertThreshold` is set in settings and the balance exceeds it, show a highlighted banner beneath the card: e.g. "Your balance has exceeded $[threshold] — consider declaring a dividend."

**Quick Stats Row**
- "This month" personal expense total
- "This month" business expense total
- Month = current calendar month (not fiscal)

**Recent Transactions**
- Last 5 transactions, sorted by date descending
- Each row: date (short format), description, type badge, amount
- Tap → `/transactions/[id]`

**FAB** — `+` button, always visible, → `/add`

---

### 6.4 Add Transaction (`/add`)

Form fields in order:

1. **Type** — segmented/tab selector, 6 options with short labels:
   - Personal Expense
   - Business Expense
   - Biz Expense (Personal Pay) — tooltip: "I paid a business expense from my own pocket"
   - Personal Expense (Business Pay) — tooltip: "I paid a personal expense from my business account"
   - Corp → Me — tooltip: "Informal transfer — corp sent money to my personal account (e.g. to cover a personal expense or float)"
   - Me → Corp — tooltip: "I put personal money into the business"
   - Dividend / Repayment — tooltip: "Formal corporate action — corp declared and paid a dividend, or formally repaid the shareholder loan"

2. **Amount** — large input, numeric keyboard (`inputMode="decimal"`), CAD prefix, auto-focused

3. **Date** — date picker, defaults to today

4. **Description** — text input, required

5. **Category** — dropdown, filtered by transaction type:
   - Personal Expens / Personal expense (Biz Pay) → personal + both categories
   - Business Expense / Biz Expense (Personal Pay) → business + both categories
   - Transfer types → hidden / not applicable

6. **Notes** — optional textarea

7. **Receipt Photo** — file input (`accept="image/*" capture="environment"`), shows thumbnail on selection

**Shareholder Loan Impact Preview**
When type is `business_expense_personal_pay`, `transfer_to_personal`, or `transfer_to_business`, show inline callout:
- e.g. "This will increase the corp's debt to you by $[amount]"
- Updates dynamically as amount changes

**Save** — full-width sticky button at bottom

---

### 6.5 Transaction List (`/transactions`)

- Search bar (searches description and notes)
- Filter chips: All | Personal | Business | Transfers
- Date range filter (start date + end date pickers)
- Transactions grouped by month, each group shows month subtotal
- Each row: date, description, category chip, amount, type colour indicator
- Tap row → `/transactions/[id]`

---

### 6.6 Transaction Detail / Edit (`/transactions/[id]`)

- Same form as `/add`, pre-populated
- Receipt image displayed full-width if present (tap to view full size)
- Save changes button
- Delete button with confirmation dialog

---

### 6.7 Shareholder Loan Ledger (`/loan`)

- Balance hero (same component as dashboard card)
- Plain-language explainer text about what positive/negative means
- Table of all transactions where `shareholderLoanDelta !== 0`:
  - Columns: Date | Description | Amount | Impact (+/-) | Running Balance
  - Sorted oldest → newest (so the running balance column tells a story)
  - Running balance computed cumulatively in the query/component

---

### 6.8 Reports (`/reports`)

**Date range picker**
- Defaults to current financial year (computed from `settings.fiscalYearEnd`)
- User can adjust

**Summary Cards**
- Total Personal Expenses
- Total Business Expenses
- Total Corp → Personal Transfers
- Total Personal → Business Transfers
- Net Shareholder Loan Change (for selected period)
- Transaction count

**Export CSV**
- Client-side Blob export (no server involvement)
- Filename: `KBS_[startDate]_[endDate].csv`

CSV columns:
```
Date, Description, Type, Category, Amount (CAD), Notes, Shareholder Loan Impact
```

---

### 6.9 Settings (`/settings`)

- Owner Name (editable)
- Company Name (editable)
- Financial Year End (month + day, editable)
- Currency: "CAD" (read-only display)
- Shareholder Loan Alert Threshold (optional, numeric input) — triggers dashboard banner when balance exceeds this amount
- Link → `/settings/categories`
- Sign Out (destructive button, bottom)

---

### 6.10 Category Management (`/settings/categories`)

- Two tabs: Personal | Business
- Lists all non-archived categories in each tab
- Default categories marked with a badge
- Add new category: inline input form per tab
- Archive a category: swipe action or menu — hides from transaction pickers
- Default categories can be archived but not deleted
- User-created categories can be deleted

---

## 7. Convex Backend Functions

### `convex/auth.ts` / Clerk setup
- Use `@clerk/nextjs` + Convex's official Clerk integration
- `ConvexClientProvider` wraps `ClerkProvider` and `ConvexProviderWithClerk`
- Single user — no open registration; additional sign-ups disabled in the Clerk dashboard
- All Convex mutations and queries access `ctx.auth` via the Clerk JWT token Convex validates automatically
- Required env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CONVEX_URL`

### `convex/settings.ts`
- `get(userId)` → settings record or null
- `upsert(userId, data)` → create or update

### `convex/categories.ts`
- `list(userId)` → all non-archived categories for user
- `create(userId, { name, realm })` → user-created category
- `archive(categoryId)` → set `isArchived: true`
- `delete(categoryId)` → hard delete (user-created only, guard against defaults)
- `seedDefaults(userId)` → inserts all default categories (called from onboarding)

### `convex/transactions.ts`
- `list(userId, filters)` → paginated, supports: `startDate`, `endDate`, `type`, `categoryId`, `search`
- `get(transactionId)` → single transaction with joined category name
- `create(userId, data)` → computes and stores `shareholderLoanDelta`, inserts
- `update(transactionId, data)` → recomputes `shareholderLoanDelta` on save
- `remove(transactionId)` → hard delete
- `getShareholderLoanBalance(userId)` → `SUM(shareholderLoanDelta)`
- `getShareholderLoanLedger(userId)` → all transactions with non-zero delta, sorted ASC by date
- `getSummary(userId, startDate, endDate)` → aggregated totals for Reports screen

### `convex/receipts.ts`
- `generateUploadUrl()` → Convex storage upload URL (mutation)
- `getReceiptUrl(storageId)` → temporary public URL (query)

---

## 8. PWA Configuration

### `app/manifest.ts`
Use Next.js's native PWA support — no third-party package needed. Create `app/manifest.ts` which Next.js serves automatically at `/manifest.webmanifest`. No `next.config.js` changes required for the manifest.

### Manifest content
```json
{
  "name": "KBS — Karina's Bookkeeping",
  "short_name": "KBS",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "orientation": "portrait",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### iOS-specific meta tags (in root `layout.tsx`)
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="KBS" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0a0a0a" />
```

---

## 9. Design System

### Palette
| Token | Value | Usage |
|---|---|---|
| `bg` | `#0a0a0a` | App background |
| `surface` | `#141414` | Cards, inputs |
| `border` | `#1f1f1f` | Dividers, card borders |
| `accent` | `#e8d5b0` | Primary CTA, logo, highlights |
| `text-primary` | `#f5f5f5` | Main text |
| `text-muted` | `#6b6b6b` | Secondary text, placeholders |
| `positive` | `#4ade80` | Corp owes her / positive loan balance |
| `negative` | `#f87171` | She owes corp / negative loan balance |
| `badge-personal` | `#60a5fa` | Personal transaction badge |
| `badge-business` | `#a78bfa` | Business transaction badge |
| `badge-transfer` | `#fb923c` | Transfer transaction badge |

### Typography
| Role | Font | Source |
|---|---|---|
| Display / headings | Playfair Display | Google Fonts |
| Body / UI | DM Sans | Google Fonts |
| Amounts / numbers | Monospace (system) | `font-mono` Tailwind class |

### Component Rules
- Card border radius: `rounded-2xl`
- Cards: subtle border (`border border-[#1f1f1f]`), no heavy box shadows
- All monetary amounts: right-aligned, monospace, coloured by sign
- Bottom nav: `backdrop-blur` glass style, respects iOS safe area (`pb-safe`)
- All touch targets: minimum 44×44px
- Inputs: dark background (`bg-[#141414]`), no white/light backgrounds anywhere
- Loading states: skeleton loaders on all data-fetched content
- Destructive actions: always require a confirmation dialog before executing

### Mobile UX Rules
- Amount field on `/add`: auto-focus on mount
- Receipt input: `capture="environment"` for rear camera on mobile
- All form inputs use correct `inputMode` attribute
- Transitions: `active:scale-95` on interactive elements for tactile feedback

---

## 10. Auth Rules

- Auth is handled entirely by Clerk — no custom auth logic in Convex
- Additional sign-ups are disabled in the Clerk dashboard (single-user app)
- All `(app)` routes check for active Clerk session; unauthenticated users are redirected to `/login`
- Convex automatically validates the Clerk JWT on every query and mutation via `ctx.auth`
- Post-MVP: enable Face ID / biometric login via Clerk's passkey support in the Clerk dashboard — no code changes required

---

## 11. Out of Scope (v1)

- GST/HST tracking or input tax credits
- Multiple users or accountant access
- Bank/account balance reconciliation
- Recurring transactions
- AI receipt parsing / auto-extraction
- Biometric login (Face ID) — enable post-MVP via Clerk dashboard, no code changes required
- Push notifications
- Multi-currency

---

## 12. Open Items

- [ ] Confirm corporation's financial year-end date (placeholder: configurable in Settings)
- [ ] Provide real PNG icons for PWA manifest (`icon-192.png`, `icon-512.png`)
- [ ] Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env.local` and Vercel environment before first deploy
- [ ] Disable additional sign-ups in Clerk dashboard after Karina's account is created
