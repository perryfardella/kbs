# Receipt Scanning — Implementation Plan

## Goal

When a user adds a transaction and attaches a receipt photo, the app automatically
scans it using the Claude API and pre-fills as many form fields as possible:
amount, date, description, transaction type, category, and notes. The user
reviews and corrects before saving.

---

## Key Design Decisions

### Image compression
Convex stores files verbatim — no built-in compression. Phone camera photos
can be 4–10MB, which is wasteful for receipt storage. Compress client-side
(browser Canvas API, no extra library) before upload: max 1200px wide, 80%
JPEG quality. Brings a typical photo to ~200–400KB — enough for Claude to
read text.

### Upload timing
The receipt is uploaded to Convex storage **only on final save**, not when the
user selects the file. This avoids orphaned files entirely — if the user
cancels, the File object is just garbage collected.

### How the scan works
Because the file stays in memory until save, we can't pass a `storageId` to
the scan action. Instead: base64-encode the compressed image client-side and
pass it directly as an action argument. A ~300KB compressed receipt becomes a
~400KB base64 string, well within Convex's 1MB argument limit.

### Modularity — categories
The scan action accepts the user's current category list as an argument (id,
name, realm). The Add page already loads these via `useQuery(api.categories.list)`.
Passing them in means the action always works with the live category set —
new categories the user creates are automatically available to the scanner
with no code changes.

### Transaction type inference
Claude is given the full type definitions with their descriptions. For a
typical receipt it will correctly infer `personal_expense` vs
`business_expense`. It will not try to infer `business_expense_personal_pay`,
`personal_expense_business_pay`, `transfer_to_personal`, `transfer_to_business`,
or `dividend_payment` — those depend on which account was used to pay, which
isn't visible on the receipt. Claude defaults to one of the two basic expense
types and the user corrects if needed.

### Scan failures
If the scan action throws or returns incomplete data, the form just stays as-is
(or partially pre-filled with whatever did parse). The user fills in the rest
manually. A failed scan never blocks saving.

---

## Architecture

```
User selects image
  │
  ├─ compressImage() ──────────────────────────────► File in state (not yet uploaded)
  │                                                   (used by handleSave later)
  │
  ├─ toBase64() ──► scanReceipt action ──► Claude API (haiku — fast + cheap)
  │                   args:                 prompt includes:
  │                   - imageBase64           - app context (shareholder loan tracker)
  │                   - imageType             - 7 type definitions + which ones are
  │                   - categories[]            inferrable from a receipt
  │                                           - full category list (from args)
  │                 returns:                returns:
  │                   { amount?, date?,       structured JSON, all fields optional
  │                     description?, type?,
  │                     categoryId?, notes? }
  │
  └─ Pre-fill form fields
       └─ Fields that were auto-filled get a subtle visual indicator

User saves
  └─ Upload compressed File ──► storageId ──► createTransaction (unchanged)

User cancels
  └─ File GC'd, nothing to clean up
```

---

## Files Touched

| File | Change |
|---|---|
| `lib/compressImage.ts` | New — client-side compression utility |
| `convex/receiptScanner.ts` | New — internal Convex action calling Claude API |
| `app/(app)/add/page.tsx` | Modify — wire up compression, scanning, pre-fill |

**Not changed:** `convex/schema.ts`, `convex/receipts.ts`, `convex/transactions.ts`,
`convex/categories.ts`, or any other existing file.

---

## Manual Prerequisite

Add `ANTHROPIC_API_KEY` to Convex environment variables:
- Convex Dashboard → your project → Settings → Environment Variables
- Key: `ANTHROPIC_API_KEY`
- Value: your key from console.anthropic.com

This must be done before Task 2 will work in production.

---

## Tasks

Tasks 1 and 2 are independent and can be done in either order or in parallel.
Task 3 depends on both being complete.

---

### Task 1 — Client-side image compression utility ✓ DONE

**File:** `lib/compressImage.ts`

Create a single exported async function:

```ts
compressImage(file: File, maxWidth?: number, quality?: number): Promise<File>
```

Implementation:
- Draw the image onto an offscreen `<canvas>` element
- Scale down proportionally if wider than `maxWidth` (default: 1200px)
- Export as JPEG at `quality` (default: 0.8)
- Return a new `File` with `type: "image/jpeg"` and the original filename

No external dependencies. Pure browser Canvas API.

Also add a helper alongside it:

```ts
fileToBase64(file: File): Promise<string>
```

Returns just the base64 data string (no `data:...;base64,` prefix — Claude
expects raw base64).

---

### Task 2 — Convex scan action

**File:** `convex/receiptScanner.ts`

Rules from Convex guidelines that apply here:
- Add `"use node";` at the top (base64/Buffer handling is cleanest in Node runtime)
- This file must contain **only actions** (no queries or mutations) because of the
  Node runtime restriction
- Use `internalAction` — this should not be callable from the public API
- Always include argument validators

Action signature:

```ts
export const scanReceipt = internalAction({
  args: {
    imageBase64: v.string(),
    imageType: v.string(),
    categories: v.array(v.object({
      id: v.string(),
      name: v.string(),
      realm: v.union(v.literal("personal"), v.literal("business"), v.literal("both")),
    })),
  },
  handler: async (ctx, args) => { ... }
})
```

Return type (all fields optional — return only what was confidently extracted):

```ts
{
  amount?: string,       // decimal string e.g. "42.50"
  date?: string,         // "YYYY-MM-DD"
  description?: string,  // merchant name or short description
  type?: TransactionType, // only personal_expense or business_expense
  categoryId?: string,   // id from the provided categories array
  notes?: string,        // brief line-item summary or relevant detail
}
```

Calling Claude:
- Model: `claude-haiku-4-5-20251001` (fast and cheap for structured extraction)
- Use `fetch()` to call the Anthropic API directly (no SDK needed, fetch is
  available in the Node runtime)
- API endpoint: `https://api.anthropic.com/v1/messages`
- Auth header: `x-api-key: process.env.ANTHROPIC_API_KEY`
- `anthropic-version: 2023-06-01`

Prompt context to include:
- App purpose: personal/business shareholder loan tracker (Canadian context, CAD)
- The 7 transaction types with plain-English descriptions, noting that only
  `personal_expense` and `business_expense` should be inferred from a receipt
  (the others require knowing which bank account was used)
- The full categories array from args, grouped by realm
- Instruction to return a JSON object (only confident fields, omit the rest)
- Instruction to return `null` if the image is not a receipt

Wrap the entire handler in try/catch — on any error, return `{}` so the
frontend degrades gracefully.

---

### Task 3 — Wire up in the Add page

**File:** `app/(app)/add/page.tsx`

This task integrates Tasks 1 and 2 into the existing form. Read the current
file carefully before editing — the receipt section starts around line 321.

**State additions:**
```ts
const [scanning, setScanning] = useState(false);
const [scannedStorageFile, setScannedStorageFile] = useState<File | null>(null);
// rename existing receiptFile → keep as-is, it holds the compressed File for upload
```

Actually: keep `receiptFile` state but store the **compressed** File there
instead of the raw file. This means `handleSave` uploads the already-compressed
file without any changes to the save logic.

**`handleReceiptChange` — replace current implementation:**
1. Get the selected `File` from the input
2. Call `compressImage(file)` → store result in `receiptFile` state
3. Set preview URL from the compressed file
4. `setScanning(true)`
5. Call `fileToBase64(compressedFile)`
6. Call `useAction(api.receiptScanner.scanReceipt)` with base64, type, and
   the already-loaded `categories` array (map to `{ id, name, realm }`)
7. On success: call `form.setValue(...)` for each returned field that is
   non-null. For `categoryId`, only set it if the id exists in `filteredCategories`
   for the current transaction type (avoids setting a business category on a
   personal expense type and vice versa — user may not have changed type yet,
   so also consider setting type first, then filtering)
8. `setScanning(false)` in finally block

**Receipt preview section — add scanning overlay:**
When `scanning === true` and `receiptPreview` is set, show a subtle overlay
on the receipt thumbnail:
```
[receipt image with ~40% opacity]
[centered: small spinner + "Scanning…" text]
```

**Pre-filled field indicator:**
Track which fields were auto-filled:
```ts
const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
```
When `form.setValue` is called from the scan result, add the field name to
`autoFilled`. When the user manually edits a field (use `onChange` on the
field), remove it from `autoFilled`. Fields in `autoFilled` get a subtle
accent-coloured left border or background tint to signal "Claude filled this —
please review". Keep this visually quiet — it should not alarm the user.

Clear `autoFilled` when the receipt is removed (`removeReceipt`).

**`handleSave` — no changes needed.** It already uploads `receiptFile` and
passes the `storageId` to `createTransaction`. Since we now store the
compressed file in `receiptFile`, it just uploads a smaller file.

**`useAction` import:**
```ts
import { useMutation, useQuery, useAction } from "convex/react";
```

**Important:** `scanReceipt` is an `internalAction`. To call an internal
function from the client you need to expose a thin public wrapper action in
`convex/receiptScanner.ts`:

```ts
export const scanReceiptPublic = action({
  args: { /* same args */ },
  handler: async (ctx, args) => {
    // auth check first
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await ctx.runAction(internal.receiptScanner.scanReceipt, args);
  },
});
```

Then call `api.receiptScanner.scanReceiptPublic` from the client.
