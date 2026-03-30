"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, useParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Info, X, ChevronLeft, Trash2, ZoomIn } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  transactionSchema,
  type TransactionFormValues,
} from "@/app/(app)/transactions/transactionSchema";

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
  { value: "personal_expense",             label: "Personal Expense",               categoryRealm: "personal" },
  { value: "business_expense",             label: "Business Expense",               categoryRealm: "business" },
  { value: "business_expense_personal_pay",label: "Biz Expense (Personal Pay)",     tooltip: "I paid a business expense from my own pocket",                                                                 categoryRealm: "business" },
  { value: "personal_expense_business_pay",label: "Personal Expense (Business Pay)",tooltip: "I paid a personal expense from my business account",                                                          categoryRealm: "personal" },
  { value: "transfer_to_personal",         label: "Corp → Me",                      tooltip: "Informal transfer — corp sent money to my personal account (e.g. to cover a personal expense or float)",      categoryRealm: null },
  { value: "transfer_to_business",         label: "Me → Corp",                      tooltip: "I put personal money into the business",                                                                       categoryRealm: null },
  { value: "dividend_payment",             label: "Dividend / Repayment",           tooltip: "Formal corporate action — corp declared and paid a dividend, or formally repaid the shareholder loan",        categoryRealm: null },
];

function getLoanImpact(type: TransactionType, amount: number): { text: string; positive: boolean } | null {
  const fmt = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount);
  switch (type) {
    case "business_expense_personal_pay":
    case "transfer_to_business":
      return { text: `This will increase the corp's debt to you by ${fmt}`, positive: true };
    case "transfer_to_personal":
      return { text: `This will decrease the corp's debt to you by ${fmt}`, positive: false };
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

  const [existingStorageId, setExistingStorageId] = useState<Id<"_storage"> | undefined>(undefined);
  const [newReceiptFile, setNewReceiptFile] = useState<File | null>(null);
  const [newReceiptPreview, setNewReceiptPreview] = useState<string | null>(null);
  const [receiptRemoved, setReceiptRemoved] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReceiptFullscreen, setShowReceiptFullscreen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingReceiptUrl = useQuery(
    api.receipts.getReceiptUrl,
    existingStorageId ? { storageId: existingStorageId } : "skip"
  );

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "personal_expense",
      amount: "",
      date: "",
      description: "",
      categoryId: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (transaction && !initialized) {
      form.reset({
        type: transaction.type as TransactionType,
        amount: String(transaction.amount),
        date: transaction.date,
        description: transaction.description,
        categoryId: transaction.categoryId ?? "",
        notes: transaction.notes ?? "",
      });
      setExistingStorageId(transaction.receiptStorageId as Id<"_storage"> | undefined);
      setInitialized(true);
    }
  }, [transaction, initialized, form]);

  const transactionType = form.watch("type");
  const selectedOption = TYPE_OPTIONS.find((t) => t.value === transactionType)!;
  const showCategory = selectedOption.categoryRealm !== null;

  const filteredCategories = (categories ?? []).filter((cat) => {
    if (!showCategory) return false;
    const realm = selectedOption.categoryRealm;
    if (realm === "personal") return cat.realm === "personal" || cat.realm === "both";
    if (realm === "business") return cat.realm === "business" || cat.realm === "both";
    return false;
  });

  const amountStr = form.watch("amount");
  const amountNum = parseFloat(amountStr) || 0;
  const loanImpact = amountNum > 0 ? getLoanImpact(transactionType, amountNum) : null;

  const displayReceiptSrc = newReceiptPreview
    ? newReceiptPreview
    : !receiptRemoved && existingReceiptUrl
    ? existingReceiptUrl
    : null;

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setNewReceiptFile(file);
    if (newReceiptPreview) URL.revokeObjectURL(newReceiptPreview);
    if (file) { setNewReceiptPreview(URL.createObjectURL(file)); setReceiptRemoved(false); }
    else setNewReceiptPreview(null);
  }

  function handleRemoveReceipt() {
    setNewReceiptFile(null);
    if (newReceiptPreview) URL.revokeObjectURL(newReceiptPreview);
    setNewReceiptPreview(null);
    setReceiptRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave(data: TransactionFormValues) {
    setSaving(true);
    try {
      let receiptStorageId: Id<"_storage"> | undefined;
      if (newReceiptFile) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": newReceiptFile.type }, body: newReceiptFile });
        if (!res.ok) throw new Error("Receipt upload failed");
        const { storageId } = await res.json();
        receiptStorageId = storageId as Id<"_storage">;
      } else if (!receiptRemoved) {
        receiptStorageId = existingStorageId;
      }
      await updateTransaction({
        transactionId,
        date: data.date,
        amount: parseFloat(data.amount),
        description: data.description.trim(),
        notes: data.notes?.trim() || undefined,
        type: data.type,
        categoryId: data.categoryId ? (data.categoryId as Id<"categories">) : undefined,
        receiptStorageId,
      });
      toast.success("Changes saved");
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
      toast.success("Transaction deleted");
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
      <PageHeader
        title="Edit Transaction"
        left={
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link href="/transactions">
              <ChevronLeft size={20} className="text-text-muted" />
            </Link>
          </Button>
        }
        right={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteDialog(true)}
            aria-label="Delete transaction"
          >
            <Trash2 size={18} className="text-negative" />
          </Button>
        }
      />

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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)}>
            <div className="px-4 pt-5 space-y-5 pb-28">
              {/* Receipt Image */}
              {displayReceiptSrc && (
                <div className="relative rounded-2xl overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={displayReceiptSrc} alt="Receipt" className="w-full object-cover cursor-pointer" onClick={() => setShowReceiptFullscreen(true)} />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button type="button" onClick={() => setShowReceiptFullscreen(true)} className="flex items-center justify-center w-8 h-8 rounded-full bg-bg/80 active:scale-95 transition-transform" aria-label="View full size">
                      <ZoomIn size={14} className="text-text-primary" />
                    </button>
                    <button type="button" onClick={handleRemoveReceipt} className="flex items-center justify-center w-8 h-8 rounded-full bg-bg/80 active:scale-95 transition-transform" aria-label="Remove receipt">
                      <X size={14} className="text-text-primary" />
                    </button>
                  </div>
                </div>
              )}

              {/* Type Selector */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">Type</label>
                    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
                      {TYPE_OPTIONS.map((opt) => (
                        <Toggle
                          key={opt.value}
                          pressed={field.value === opt.value}
                          onPressedChange={() => {
                            field.onChange(opt.value);
                            form.setValue("categoryId", "");
                          }}
                        >
                          {opt.label}
                        </Toggle>
                      ))}
                    </div>
                    {selectedOption.tooltip && (
                      <p className="flex items-start gap-1.5 text-xs text-text-muted leading-relaxed">
                        <Info size={12} className="mt-0.5 shrink-0" />
                        {selectedOption.tooltip}
                      </p>
                    )}
                  </div>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel variant="muted">Amount</FormLabel>
                    <div className={`flex items-center gap-2 rounded-2xl border bg-surface px-4 py-3 ${fieldState.invalid ? "border-negative" : "border-border"}`}>
                      <span className="font-mono text-sm font-medium text-text-muted">CAD</span>
                      <input
                        {...field}
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="flex-1 bg-transparent font-mono text-3xl font-semibold text-text-primary outline-none placeholder:text-[#2a2a2a]"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Loan Impact Banner */}
              {loanImpact && (
                <Alert variant={loanImpact.positive ? "positive" : "negative"}>
                  <Info size={16} />
                  <AlertDescription>{loanImpact.text}</AlertDescription>
                </Alert>
              )}

              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel variant="muted">Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel variant="muted">Description</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="text"
                        placeholder="What was this for?"
                        className={fieldState.invalid ? "border-negative" : ""}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category */}
              {showCategory && (
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel variant="muted">Category</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          className={`rounded-2xl border bg-surface min-h-[44px] px-4 text-text-primary ${fieldState.invalid ? "border-negative" : "border-border"}`}
                        >
                          <SelectValue placeholder="Select a category…" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredCategories.map((cat) => (
                            <SelectItem key={cat._id} value={cat._id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel variant="muted">Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional details…" rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Receipt Photo — add/replace */}
              {!displayReceiptSrc && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
                    Receipt <span className="normal-case font-normal text-text-muted">(optional)</span>
                  </label>
                  <label className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-4 py-6 cursor-pointer active:bg-border/20 transition-colors min-h-[44px]">
                    <span className="text-sm text-text-muted">Tap to add photo</span>
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleReceiptChange} className="sr-only" />
                  </label>
                </div>
              )}
            </div>

            {/* Sticky Save Button */}
            <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-0 right-0 z-20 px-4 pt-3 pb-3 bg-bg/95 backdrop-blur-sm border-t border-border">
              <div className="mx-auto max-w-lg">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The transaction will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" size="sm" disabled={deleting} onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-negative text-white border-0"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Receipt Viewer */}
      {showReceiptFullscreen && displayReceiptSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 backdrop-blur-sm"
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
