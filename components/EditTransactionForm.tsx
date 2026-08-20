"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Info, X, Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  transactionSchema,
  type TransactionFormValues,
} from "@/app/(app)/transactions/transactionSchema";
import { TransactionKindFields } from "@/components/TransactionKindFields";
import { getLoanImpact, tryShapeFromFields } from "@/lib/transactionFields";

const MAX_RECEIPT_PHOTOS = 5;

interface EditTransactionFormProps {
  transactionId: Id<"transactions">;
  onSuccess: () => void;
}

type TransactionData = NonNullable<ReturnType<typeof useQuery<typeof api.transactions.get>>>;
type CategoryData = NonNullable<ReturnType<typeof useQuery<typeof api.categories.list>>>;

// Outer shell: waits for both transaction and categories before mounting the form
export function EditTransactionForm({ transactionId, onSuccess }: EditTransactionFormProps) {
  const transaction = useQuery(api.transactions.get, { transactionId });
  const categories = useQuery(api.categories.list);

  if (transaction === null) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-text-muted">Transaction not found.</p>
      </div>
    );
  }

  if (transaction === undefined || categories === undefined) {
    return (
      <div className="px-4 pt-2 space-y-3 pb-2">
        <Skeleton className="h-11 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-11 w-full rounded-2xl" />
        <Skeleton className="h-11 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <EditTransactionFormInner
      transactionId={transactionId}
      transaction={transaction}
      categories={categories}
      onSuccess={onSuccess}
    />
  );
}

interface InnerProps {
  transactionId: Id<"transactions">;
  transaction: TransactionData;
  categories: CategoryData;
  onSuccess: () => void;
}

// Inner form: receives transaction + categories as props, uses them as static defaultValues
function EditTransactionFormInner({ transactionId, transaction, categories, onSuccess }: InnerProps) {
  const updateTransaction = useMutation(api.transactions.update);
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl);
  const properties = useQuery(api.properties.list);

  const [existingStorageIds] = useState<Id<"_storage">[]>(
    (transaction.receiptStorageIds as Id<"_storage">[] | undefined) ?? []
  );
  const [removedExistingIds, setRemovedExistingIds] = useState<Set<Id<"_storage">>>(new Set());
  const [newReceiptFiles, setNewReceiptFiles] = useState<File[]>([]);
  const [newReceiptPreviews, setNewReceiptPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const existingReceiptUrls = useQuery(
    api.receipts.getReceiptUrls,
    existingStorageIds.length > 0 ? { storageIds: existingStorageIds } : "skip"
  );

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      kind: transaction.kind ?? "expense",
      realm: transaction.realm,
      account: transaction.account,
      from: transaction.from,
      to: transaction.to,
      purpose: transaction.purpose,
      amount: String(transaction.amount),
      date: transaction.date,
      description: transaction.description,
      categoryId: transaction.categoryId ?? "",
      propertyId: transaction.propertyId ?? "",
      notes: transaction.notes ?? "",
    },
  });

  const kind = form.watch("kind");
  const realm = form.watch("realm");
  const account = form.watch("account");
  // Mirrors categoryRealmFor: no category for transfers or (uncategorized) rental income.
  const showCategory = kind !== "transfer" && !!realm && !(kind === "income" && realm === "rental");
  const showProperty = kind !== "transfer" && realm === "rental";
  const propertyRequired = showProperty;

  const filteredCategories = categories.filter((cat) => {
    if (!showCategory || !realm) return false;
    if (Boolean(cat.isIncome) !== (kind === "income")) return false;
    if (realm === "personal") return cat.realm === "personal" || cat.realm === "both";
    if (realm === "business") return cat.realm === "business" || cat.realm === "both";
    if (realm === "rental") return cat.realm === "rental";
    return false;
  });

  const amountStr = form.watch("amount");
  const amountNum = parseFloat(amountStr) || 0;
  const from = form.watch("from");
  const to = form.watch("to");
  const purpose = form.watch("purpose");
  const shape = tryShapeFromFields({ kind, realm, account, from, to, purpose });
  const loanImpact = getLoanImpact(shape, amountNum);

  const remainingExistingIds = existingStorageIds.filter((id) => !removedExistingIds.has(id));
  const existingUrlByStorageId = new Map(
    (existingReceiptUrls ?? []).map((r) => [r.storageId, r.url])
  );
  const existingGallery = remainingExistingIds
    .map((id) => ({ kind: "existing" as const, id, src: existingUrlByStorageId.get(id) ?? null }))
    .filter((item): item is { kind: "existing"; id: Id<"_storage">; src: string } => !!item.src);
  const newGallery = newReceiptPreviews.map((src, i) => ({ kind: "new" as const, index: i, src }));
  const gallery = [...existingGallery, ...newGallery];
  const totalReceiptCount = remainingExistingIds.length + newReceiptFiles.length;

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = Array.from(e.target.files ?? []);
    if (raw.length === 0) return;
    const room = MAX_RECEIPT_PHOTOS - totalReceiptCount;
    const accepted = raw.slice(0, Math.max(0, room));
    if (accepted.length === 0) return;
    setNewReceiptFiles((prev) => [...prev, ...accepted]);
    setNewReceiptPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
  }

  function removeExistingReceipt(id: Id<"_storage">) {
    setRemovedExistingIds((prev) => new Set(prev).add(id));
  }

  function removeNewReceipt(index: number) {
    setNewReceiptFiles((prev) => prev.filter((_, i) => i !== index));
    setNewReceiptPreviews((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSave(data: TransactionFormValues) {
    setSaving(true);
    try {
      const uploadedIds: Id<"_storage">[] = await Promise.all(
        newReceiptFiles.map(async (file) => {
          const uploadUrl = await generateUploadUrl();
          const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
          if (!res.ok) throw new Error("Receipt upload failed");
          const { storageId } = await res.json();
          return storageId as Id<"_storage">;
        })
      );
      const receiptStorageIds = [...remainingExistingIds, ...uploadedIds];
      await updateTransaction({
        transactionId,
        date: data.date,
        amount: parseFloat(data.amount),
        description: data.description.trim(),
        notes: data.notes?.trim() || undefined,
        kind: data.kind,
        realm: data.realm,
        account: data.account,
        from: data.from,
        to: data.to,
        purpose: data.purpose,
        categoryId: data.categoryId ? (data.categoryId as Id<"categories">) : undefined,
        propertyId: data.propertyId ? (data.propertyId as Id<"properties">) : undefined,
        receiptStorageIds: receiptStorageIds.length > 0 ? receiptStorageIds : undefined,
      });
      toast.success("Changes saved");
      onSuccess();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSave)}>
          <div className="px-4 pt-2 space-y-3 pb-2">
            {/* Existing Receipts */}
            {gallery.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">Receipts</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {gallery.map((item) => (
                    <div key={item.kind === "existing" ? item.id : `new-${item.index}`} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.src}
                        alt="Receipt"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setFullscreenSrc(item.src)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          item.kind === "existing" ? removeExistingReceipt(item.id) : removeNewReceipt(item.index)
                        }
                        className="absolute top-1 right-1 flex items-center justify-center w-6 h-6 rounded-full bg-bg/80 active:scale-95 transition-transform"
                        aria-label="Remove receipt"
                      >
                        <X size={12} className="text-text-primary" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Type Selector */}
            <TransactionKindFields form={form} />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel variant="muted">Amount</FormLabel>
                  <div className={`flex items-center gap-2 rounded-2xl border bg-surface px-4 py-1.5 ${fieldState.invalid ? "border-negative" : "border-border"}`}>
                    <span className="font-mono text-sm font-medium text-text-muted">CAD</span>
                    <input
                      {...field}
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="flex-1 min-w-0 bg-transparent font-mono text-3xl font-semibold text-text-primary outline-none placeholder:text-text-muted"
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

            {/* Date + Category */}
            <div className={showCategory ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : ""}>
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel variant="muted">Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="font-mono appearance-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {showCategory && (
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel variant="muted">Category</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger className={fieldState.invalid ? "border-negative" : ""}>
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
            </div>

            {/* Property */}
            {showProperty && (
              <FormField
                control={form.control}
                name="propertyId"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel variant="muted">
                      Property{propertyRequired ? "" : " (optional)"}
                    </FormLabel>
                    {properties === undefined ? (
                      <Skeleton className="h-12 w-full rounded-2xl" />
                    ) : properties.length === 0 ? (
                      <p className="text-xs text-text-muted">
                        No properties yet. Add one from the Properties screen.
                      </p>
                    ) : (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger className={fieldState.invalid ? "border-negative" : ""}>
                          <SelectValue placeholder="Select a property…" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties.map((p) => (
                            <SelectItem key={p._id} value={p._id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
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
                    <Textarea placeholder="Any additional details…" rows={1} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Receipt — add another */}
            {totalReceiptCount < MAX_RECEIPT_PHOTOS && (
              <div className="space-y-2">
                {gallery.length === 0 && (
                  <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
                    Receipts <span className="normal-case font-normal text-text-muted">(optional)</span>
                  </label>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-2 active:bg-border/20 transition-colors min-h-[44px]"
                  >
                    <Camera size={16} className="text-text-muted" />
                    <span className="text-sm text-text-muted">
                      {gallery.length > 0 ? "Take Another Photo" : "Take Photo"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-2 active:bg-border/20 transition-colors min-h-[44px]"
                  >
                    <Upload size={16} className="text-text-muted" />
                    <span className="text-sm text-text-muted">
                      {gallery.length > 0 ? "Add More Photos" : "Upload Photo(s)"}
                    </span>
                  </button>
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleReceiptChange} className="sr-only" />
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleReceiptChange} className="sr-only" />
                </div>
              </div>
            )}
          </div>

          {/* Save Button — sits in normal flow at the end of the form */}
          <div className="px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border mt-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Fullscreen Receipt Viewer */}
      {fullscreenSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 backdrop-blur-sm"
          onClick={() => setFullscreenSrc(null)}
        >
          <button
            type="button"
            onClick={() => setFullscreenSrc(null)}
            className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full bg-surface/80 active:scale-95 transition-transform z-10"
            aria-label="Close"
          >
            <X size={18} className="text-text-primary" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreenSrc}
            alt="Receipt full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
