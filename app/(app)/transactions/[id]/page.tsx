"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, useParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Info, X, ChevronLeft, Trash2, ZoomIn } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";

type TransactionType =
  | "personal_expense"
  | "business_expense"
  | "business_expense_personal_pay"
  | "personal_expense_business_pay"
  | "transfer_to_personal"
  | "transfer_to_business"
  | "dividend_payment";

type CategoryRealm = "personal" | "business" | null;

const TYPE_OPTIONS: {
  value: TransactionType;
  label: string;
  tooltip?: string;
  categoryRealm: CategoryRealm;
}[] = [
  {
    value: "personal_expense",
    label: "Personal Expense",
    categoryRealm: "personal",
  },
  {
    value: "business_expense",
    label: "Business Expense",
    categoryRealm: "business",
  },
  {
    value: "business_expense_personal_pay",
    label: "Biz Expense (Personal Pay)",
    tooltip: "I paid a business expense from my own pocket",
    categoryRealm: "business",
  },
  {
    value: "personal_expense_business_pay",
    label: "Personal Expense (Business Pay)",
    tooltip: "I paid a personal expense from my business account",
    categoryRealm: "personal",
  },
  {
    value: "transfer_to_personal",
    label: "Corp → Me",
    tooltip:
      "Informal transfer — corp sent money to my personal account (e.g. to cover a personal expense or float)",
    categoryRealm: null,
  },
  {
    value: "transfer_to_business",
    label: "Me → Corp",
    tooltip: "I put personal money into the business",
    categoryRealm: null,
  },
  {
    value: "dividend_payment",
    label: "Dividend / Repayment",
    tooltip:
      "Formal corporate action — corp declared and paid a dividend, or formally repaid the shareholder loan",
    categoryRealm: null,
  },
];

function getLoanImpact(
  type: TransactionType,
  amount: number
): { text: string; positive: boolean } | null {
  const fmt = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
  switch (type) {
    case "business_expense_personal_pay":
    case "transfer_to_business":
      return {
        text: `This will increase the corp's debt to you by ${fmt}`,
        positive: true,
      };
    case "transfer_to_personal":
      return {
        text: `This will decrease the corp's debt to you by ${fmt}`,
        positive: false,
      };
    default:
      return null;
  }
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params.id as Id<"transactions">;

  const transaction = useQuery(api.transactions.get, { transactionId });
  const categories = useQuery(api.categories.list);
  const updateTransaction = useMutation(api.transactions.update);
  const removeTransaction = useMutation(api.transactions.remove);
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl);

  // Form state
  const [type, setType] = useState<TransactionType>("personal_expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Receipt state
  const [existingStorageId, setExistingStorageId] = useState<Id<"_storage"> | undefined>(undefined);
  const [newReceiptFile, setNewReceiptFile] = useState<File | null>(null);
  const [newReceiptPreview, setNewReceiptPreview] = useState<string | null>(null);
  const [receiptRemoved, setReceiptRemoved] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReceiptFullscreen, setShowReceiptFullscreen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; description?: string; category?: string }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing receipt URL
  const existingReceiptUrl = useQuery(
    api.receipts.getReceiptUrl,
    existingStorageId ? { storageId: existingStorageId } : "skip"
  );

  // Pre-populate form when transaction loads
  useEffect(() => {
    if (transaction && !initialized) {
      setType(transaction.type as TransactionType);
      setAmount(String(transaction.amount));
      setDate(transaction.date);
      setDescription(transaction.description);
      setCategoryId(transaction.categoryId ?? "");
      setNotes(transaction.notes ?? "");
      setExistingStorageId(transaction.receiptStorageId as Id<"_storage"> | undefined);
      setInitialized(true);
    }
  }, [transaction, initialized]);

  const selectedOption = TYPE_OPTIONS.find((t) => t.value === type)!;
  const showCategory = selectedOption.categoryRealm !== null;

  const filteredCategories = (categories ?? []).filter((cat) => {
    if (!showCategory) return false;
    const realm = selectedOption.categoryRealm;
    if (realm === "personal") return cat.realm === "personal" || cat.realm === "both";
    if (realm === "business") return cat.realm === "business" || cat.realm === "both";
    return false;
  });

  const amountNum = parseFloat(amount) || 0;
  const loanImpact = amountNum > 0 ? getLoanImpact(type, amountNum) : null;

  // Displayed receipt: new file preview > existing URL (unless removed)
  const displayReceiptSrc = newReceiptPreview
    ? newReceiptPreview
    : !receiptRemoved && existingReceiptUrl
    ? existingReceiptUrl
    : null;

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setNewReceiptFile(file);
    if (newReceiptPreview) URL.revokeObjectURL(newReceiptPreview);
    if (file) {
      setNewReceiptPreview(URL.createObjectURL(file));
      setReceiptRemoved(false);
    } else {
      setNewReceiptPreview(null);
    }
  }

  function handleRemoveReceipt() {
    setNewReceiptFile(null);
    if (newReceiptPreview) URL.revokeObjectURL(newReceiptPreview);
    setNewReceiptPreview(null);
    setReceiptRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    const newErrors: { amount?: string; description?: string; category?: string } = {};
    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = "Enter a valid amount";
    }
    if (!description.trim()) {
      newErrors.description = "Description is required";
    }
    if (showCategory && !categoryId) {
      newErrors.category = "Select a category";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      let receiptStorageId: Id<"_storage"> | undefined;

      if (newReceiptFile) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": newReceiptFile.type },
          body: newReceiptFile,
        });
        if (!res.ok) throw new Error("Receipt upload failed");
        const { storageId } = await res.json();
        receiptStorageId = storageId as Id<"_storage">;
      } else if (!receiptRemoved) {
        receiptStorageId = existingStorageId;
      }

      await updateTransaction({
        transactionId,
        date,
        amount: parseFloat(amount),
        description: description.trim(),
        notes: notes.trim() || undefined,
        type,
        categoryId: categoryId ? (categoryId as Id<"categories">) : undefined,
        receiptStorageId,
      });

      router.push("/transactions");
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await removeTransaction({ transactionId });
      router.push("/transactions");
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  const isLoading = transaction === undefined || categories === undefined;

  if (transaction === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-sm text-text-muted">Transaction not found.</p>
        <Link href="/transactions" className="mt-4 inline-block text-sm text-accent">
          ← Back to Transactions
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-bg border-b border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <Link
            href="/transactions"
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-xl active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-text-muted" />
          </Link>
          <h1 className="font-display text-lg font-semibold text-text-primary">
            Edit Transaction
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="flex items-center justify-center w-10 h-10 rounded-xl active:scale-95 transition-transform"
          aria-label="Delete transaction"
        >
          <Trash2 size={18} className="text-negative" />
        </button>
      </div>

      {isLoading ? (
        <div className="px-4 pt-5 space-y-5 pb-28">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="px-4 pt-5 space-y-5 pb-28">
          {/* Receipt Image (full-width if present) */}
          {displayReceiptSrc && (
            <div className="relative rounded-2xl overflow-hidden border border-[#1f1f1f]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayReceiptSrc}
                alt="Receipt"
                className="w-full object-cover cursor-pointer"
                onClick={() => setShowReceiptFullscreen(true)}
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptFullscreen(true)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0a0a0a]/80 active:scale-95 transition-transform"
                  aria-label="View full size"
                >
                  <ZoomIn size={14} className="text-text-primary" />
                </button>
                <button
                  type="button"
                  onClick={handleRemoveReceipt}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0a0a0a]/80 active:scale-95 transition-transform"
                  aria-label="Remove receipt"
                >
                  <X size={14} className="text-text-primary" />
                </button>
              </div>
            </div>
          )}

          {/* Type Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
              Type
            </label>
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setType(opt.value);
                    setCategoryId("");
                  }}
                  className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-95 min-h-[44px] whitespace-nowrap border ${
                    type === opt.value
                      ? "bg-accent text-bg border-accent"
                      : "bg-surface text-text-muted border-[#1f1f1f]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {selectedOption.tooltip && (
              <p className="flex items-start gap-1.5 text-xs text-text-muted leading-relaxed">
                <Info size={12} className="mt-0.5 shrink-0" />
                {selectedOption.tooltip}
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
              Amount
            </label>
            <div
              className={`flex items-center gap-2 rounded-2xl border bg-surface px-4 py-3 ${
                errors.amount ? "border-negative" : "border-[#1f1f1f]"
              }`}
            >
              <span className="font-mono text-sm font-medium text-text-muted">CAD</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                }}
                className="flex-1 bg-transparent font-mono text-3xl font-semibold text-text-primary outline-none placeholder:text-[#2a2a2a]"
              />
            </div>
            {errors.amount && (
              <p className="text-xs text-negative">{errors.amount}</p>
            )}
          </div>

          {/* Shareholder Loan Impact Preview */}
          {loanImpact && (
            <div
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                loanImpact.positive
                  ? "border-positive/30 bg-positive/10 text-positive"
                  : "border-negative/30 bg-negative/10 text-negative"
              }`}
            >
              <Info size={16} className="mt-0.5 shrink-0" />
              <p>{loanImpact.text}</p>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl border border-[#1f1f1f] bg-surface px-4 py-3 text-text-primary font-mono text-sm outline-none focus:border-accent min-h-[44px]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
              Description
            </label>
            <input
              type="text"
              inputMode="text"
              placeholder="What was this for?"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description)
                  setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              className={`w-full rounded-2xl border bg-surface px-4 py-3 text-text-primary outline-none focus:border-accent min-h-[44px] placeholder:text-text-muted ${
                errors.description ? "border-negative" : "border-[#1f1f1f]"
              }`}
            />
            {errors.description && (
              <p className="text-xs text-negative">{errors.description}</p>
            )}
          </div>

          {/* Category */}
          {showCategory && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  if (e.target.value) setErrors((prev) => ({ ...prev, category: undefined }));
                }}
                className={`w-full rounded-2xl border bg-surface px-4 py-3 text-text-primary outline-none focus:border-accent min-h-[44px] appearance-none ${errors.category ? "border-negative" : "border-[#1f1f1f]"}`}
              >
                <option value="">Select a category…</option>
                {filteredCategories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-xs text-negative">{errors.category}</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
              Notes{" "}
              <span className="normal-case font-normal text-text-muted">(optional)</span>
            </label>
            <textarea
              placeholder="Any additional details…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-[#1f1f1f] bg-surface px-4 py-3 text-text-primary outline-none focus:border-accent placeholder:text-text-muted resize-none"
            />
          </div>

          {/* Receipt Photo — add/replace */}
          {!displayReceiptSrc && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
                Receipt{" "}
                <span className="normal-case font-normal text-text-muted">(optional)</span>
              </label>
              <label className="flex items-center justify-center rounded-2xl border border-dashed border-[#1f1f1f] bg-surface px-4 py-6 cursor-pointer active:bg-[#1a1a1a] transition-colors min-h-[44px]">
                <span className="text-sm text-text-muted">Tap to add photo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleReceiptChange}
                  className="sr-only"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Sticky Save Button */}
      {!isLoading && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-0 right-0 z-20 px-4 pt-3 pb-3 bg-bg/95 backdrop-blur-sm border-t border-[#1f1f1f]">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-2xl bg-accent text-bg font-semibold py-4 text-base active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-[#0a0a0a]/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#1f1f1f] bg-surface p-6 space-y-4">
            <div className="space-y-1.5">
              <h2 className="font-display text-lg font-semibold text-text-primary">
                Delete Transaction?
              </h2>
              <p className="text-sm text-text-muted">
                This action cannot be undone. The transaction will be permanently removed.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
                className="flex-1 rounded-2xl border border-[#1f1f1f] bg-bg py-3.5 text-sm font-medium text-text-primary active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-negative py-3.5 text-sm font-semibold text-white active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Receipt Viewer */}
      {showReceiptFullscreen && displayReceiptSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/95 backdrop-blur-sm"
          onClick={() => setShowReceiptFullscreen(false)}
        >
          <button
            type="button"
            onClick={() => setShowReceiptFullscreen(false)}
            className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full bg-surface/80 active:scale-95 transition-transform z-10"
            aria-label="Close"
          >
            <X size={18} className="text-text-primary" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayReceiptSrc}
            alt="Receipt full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
