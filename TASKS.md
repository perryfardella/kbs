# KBS — Implementation Tasks

Each task is a self-contained session. Complete them in order.

---

## Task 1: Project Scaffolding & Configuration ✅

Set up the foundational project structure.

- [x] Initialize Next.js (App Router, TypeScript, Tailwind CSS)
- [x] Install and configure shadcn/ui
- [x] Install and configure Convex (`convex dev` init)
- [x] Install `@clerk/nextjs`
- [x] Create `.env.local.example` documenting required env vars (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CONVEX_URL`)
- [x] Set up Google Fonts (Playfair Display, DM Sans) in root layout
- [x] Configure Tailwind theme with the full design system palette (bg, surface, border, accent, text-primary, text-muted, positive, negative, badge colours)
- [x] Create `app/manifest.ts` for PWA
- [x] Add iOS-specific meta tags in root `layout.tsx`
- [x] Create placeholder PWA icons (`icon-192.png`, `icon-512.png`)
- [x] Initialize git repo with `.gitignore`

**Acceptance criteria:** `npm run dev` starts cleanly. Tailwind theme tokens render correctly. `/manifest.webmanifest` returns valid JSON. Git repo initialized with first commit.

---

## Task 2: Auth & Provider Wiring ✅

Wire up Clerk + Convex so that authenticated sessions work end-to-end.

- [x] Create `ConvexClientProvider` component wrapping `ClerkProvider` + `ConvexProviderWithClerk`
- [x] Wire provider into root `layout.tsx`
- [x] Create `(auth)` route group with layout (no nav, no auth guard)
- [x] Create `(app)` route group with layout (auth guard — redirect unauthenticated to `/login`)
- [x] Build `/login` page using Clerk's `<SignIn>` component, styled to match the dark theme
- [x] Verify login flow: unauthenticated → `/login` → sign in → redirect to `/`

**Acceptance criteria:** Visiting any `(app)` route while logged out redirects to `/login`. Signing in redirects to `/`. Convex queries can access `ctx.auth` and retrieve the user identity.

---

## Task 3: Convex Schema & Backend — Settings and Categories ✅

Define the database schema and implement the first two backend modules.

- [x] Define Convex schema (`convex/schema.ts`) for `settings`, `categories`, and `transactions` tables with all fields and indexes from the spec
- [x] Implement `convex/settings.ts`: `get(userId)`, `upsert(userId, data)`
- [x] Implement `convex/categories.ts`: `list(userId)`, `create(userId, {name, realm})`, `archive(categoryId)`, `delete(categoryId)`, `seedDefaults(userId)`
- [x] Populate the full default categories list (13 business, 10 personal) in the seed function
- [x] All mutations validate that the calling user owns the record being modified

**Acceptance criteria:** Schema deploys to Convex without errors. Unit-level manual testing via Convex dashboard confirms: settings can be created/updated, default categories seed correctly, archive/delete work with the default-category guard.

---

## Task 4: Convex Backend — Transactions & Receipts ✅

Implement the transaction and receipt backend modules.

- [x] Implement `convex/transactions.ts`:
  - `create` — computes `shareholderLoanDelta` per type rules, stores transaction
  - `update` — recomputes delta on save
  - `remove` — hard delete
  - `get` — single transaction with joined category name
  - `list` — paginated, supports `startDate`, `endDate`, `type`, `search` filters
  - `getShareholderLoanBalance` — `SUM(shareholderLoanDelta)`
  - `getShareholderLoanLedger` — all non-zero delta transactions, sorted ASC
  - `getSummary` — aggregated totals for a date range
- [x] Implement `convex/receipts.ts`: `generateUploadUrl()`, `getReceiptUrl(storageId)`
- [x] All mutations validate user ownership

**Acceptance criteria:** All functions deploy. Shareholder loan delta is correctly computed for every transaction type. `getShareholderLoanBalance` returns the correct running sum. `getSummary` returns correct aggregates. Receipt upload URL generation works.

---

## Task 5: Onboarding Flow ✅

Build the first-run experience.

- [x] Build `/onboarding` page: form with Owner Name, Company Name, Fiscal Year End (month + day pickers)
- [x] On submit: create `settings` record + seed default categories, then redirect to `/`
- [x] If settings already exist for the user, redirect to `/`
- [x] Update `/login` post-auth redirect: check for settings → no settings → `/onboarding`, else → `/`
- [x] Style to match dark theme, proper input modes

**Acceptance criteria:** New user signs in → lands on `/onboarding` → fills form → submits → redirected to `/` with settings and 23 default categories in the database. Returning user skips onboarding.

---

## Task 6: App Shell — Bottom Nav, FAB & Layout ✅

Build the shared `(app)` layout chrome.

- [x] Create bottom navigation bar with icons and labels: Dashboard, Transactions, Loan, Reports, Settings
- [x] Style with `backdrop-blur` glass effect, iOS safe area padding (`pb-safe`)
- [x] Create floating action button (FAB) `+` → `/add`, always visible above bottom nav
- [x] Add `active:scale-95` tactile feedback on all interactive elements
- [x] All touch targets ≥ 44×44px
- [x] Create shared loading skeleton component for data-fetched content

**Acceptance criteria:** Bottom nav renders on all `(app)` routes with correct active state. FAB is visible and navigates to `/add`. Safe area insets respected on iOS. Skeleton loader component is reusable.

---

## Task 7: Dashboard (`/`) ✅

Build the main dashboard screen.

- [x] Shareholder Loan Card (hero): displays running balance, "Corp owes you" / "You owe corp" label, CAD formatting, colour-coded (positive/negative)
- [x] Loan alert banner: shown when `loanAlertThreshold` is set and balance exceeds it
- [x] Quick Stats Row: current calendar month personal + business expense totals
- [x] Recent Transactions: last 5, sorted by date desc — date, description, type badge, amount
- [x] Tap transaction row → `/transactions/[id]`
- [x] Skeleton loaders while data loads

**Acceptance criteria:** Dashboard displays correct loan balance, monthly stats, and recent transactions. Alert banner shows/hides correctly based on threshold. All amounts are right-aligned, monospace, CAD-formatted.

---

## Task 8: Add Transaction (`/add`) ✅

Build the transaction creation form.

- [x] Type selector: segmented control with 7 options and short labels + tooltips
- [x] Amount input: large, numeric keyboard (`inputMode="decimal"`), CAD prefix, auto-focused
- [x] Date picker defaulting to today
- [x] Description text input (required)
- [x] Category dropdown: filtered by transaction type (personal categories for personal types, business for business, hidden for transfers)
- [x] Notes textarea (optional)
- [x] Receipt photo input (`accept="image/*" capture="environment"`), thumbnail preview
- [x] Shareholder Loan Impact Preview callout for applicable types (updates dynamically)
- [x] Full-width sticky Save button
- [x] On save: upload receipt (if any), create transaction, redirect to `/`

**Acceptance criteria:** All 7 transaction types can be created. Category picker filters correctly per type. Receipt uploads and stores. Shareholder loan preview shows correct impact text. Validation prevents save without required fields.

---

## Task 9: Transaction List (`/transactions`) ✅

Build the filterable transaction list.

- [x] Search bar (searches description and notes)
- [x] Filter chips: All | Personal | Business | Transfers
- [x] Date range filter (start + end date pickers)
- [x] Transactions grouped by month with month subtotal
- [x] Each row: date, description, category chip, amount, type colour indicator
- [x] Tap row → `/transactions/[id]`
- [x] Skeleton loaders

**Acceptance criteria:** List loads and displays all transactions. Filters narrow results correctly. Search matches description and notes. Month grouping and subtotals are accurate. Navigation to detail works.

---

## Task 10: Transaction Detail / Edit (`/transactions/[id]`) ✅

Build the view/edit screen for a single transaction.

- [x] Same form layout as `/add`, pre-populated with existing data
- [x] Receipt image displayed full-width if present (tap to view full size)
- [x] Save changes button — updates transaction (recomputes delta)
- [x] Delete button with confirmation dialog
- [x] On delete: remove transaction, navigate back

**Acceptance criteria:** Existing transactions load correctly into the form. Edits save and shareholder loan delta recomputes. Receipt displays and is viewable full-size. Delete requires confirmation and removes the transaction.

---

## Task 11: Shareholder Loan Ledger (`/loan`) ✅

Build the loan ledger screen.

- [x] Balance hero card (reuse dashboard component)
- [x] Plain-language explainer text about positive/negative meaning
- [x] Table of all transactions with `shareholderLoanDelta !== 0`:
  - Columns: Date, Description, Amount, Impact (+/-), Running Balance
  - Sorted oldest → newest
  - Running balance computed cumulatively
- [x] Skeleton loaders

**Acceptance criteria:** Ledger shows only loan-affecting transactions. Running balance column accumulates correctly from oldest to newest. Balance hero matches dashboard.

---

## Task 12: Reports & CSV Export (`/reports`)

Build the reports screen with export.

- [ ] Date range picker defaulting to current fiscal year (computed from `settings.fiscalYearEnd`)
- [ ] Summary cards: Total Personal Expenses, Total Business Expenses, Total Corp→Personal Transfers, Total Personal→Business Transfers, Net Shareholder Loan Change, Transaction count
- [ ] CSV export: client-side Blob generation
  - Filename: `KBS_[startDate]_[endDate].csv`
  - Columns: Date, Description, Type, Category, Amount (CAD), Notes, Shareholder Loan Impact
- [ ] Skeleton loaders

**Acceptance criteria:** Summary cards show correct aggregates for the selected date range. Default range matches fiscal year. CSV downloads with correct filename, columns, and data. All amounts formatted properly.

---

## Task 13: Settings & Category Management

Build the settings screens.

- [ ] `/settings`: editable Owner Name, Company Name, Fiscal Year End, read-only Currency, optional Loan Alert Threshold, link to categories, Sign Out button
- [ ] `/settings/categories`: two tabs (Personal | Business), list non-archived categories, default badge, inline add form, archive action (swipe or menu), delete for user-created only
- [ ] Sign Out: destructive button with Clerk sign-out, redirect to `/login`

**Acceptance criteria:** Settings save and persist. Categories can be added, archived, and deleted (with default guard). Archived categories no longer appear in transaction form pickers. Sign out works.

---

## Task 14: Polish, Edge Cases & PWA Testing

Final pass for production readiness.

- [ ] Verify all monetary amounts: right-aligned, monospace, CAD-formatted, coloured by sign
- [ ] Verify all destructive actions have confirmation dialogs
- [ ] Verify all loading states use skeleton loaders
- [ ] Test PWA: add to home screen on iPhone Safari, standalone mode, theme colour, icons
- [ ] Test viewport: `viewport-fit=cover`, safe area insets on notched devices
- [ ] Test empty states: no transactions, no categories, fresh dashboard
- [ ] Test form validation: required fields, numeric inputs, date ranges
- [ ] Fix any visual or functional issues found

**Acceptance criteria:** App is fully functional as an iPhone Safari PWA. No blank loading flashes. All edge cases handled gracefully. Design matches the spec's palette and typography.
