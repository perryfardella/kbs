"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Info, X, Loader2, Camera, Upload } from "lucide-react";
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
import { compressImage, fileToBase64 } from "@/lib/compressImage";
import { TransactionKindFields } from "@/components/TransactionKindFields";
import { getLoanImpact, tryShapeFromFields, type Kind, type Realm } from "@/lib/transactionFields";

const MAX_RECEIPT_PHOTOS = 5;

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function AutoFilledBadge({ field, autoFilled }: { field: string; autoFilled: Set<string> }) {
  if (!autoFilled.has(field)) return null;
  return (
    <span className="ml-1.5 text-[10px] font-medium text-accent normal-case tracking-normal">
      auto-filled
    </span>
  );
}

interface AddTransactionFormProps {
  isOpen: boolean;
  onSuccess: () => void;
  // When launched from a property page, preselect the property + default to a
  // rental expense so the kind/realm toggles and property picker start sensibly.
  defaultPropertyId?: string;
  defaultKind?: Kind;
  defaultRealm?: Realm;
}

export function AddTransactionForm({
  isOpen,
  onSuccess,
  defaultPropertyId,
  defaultKind,
  defaultRealm,
}: AddTransactionFormProps) {
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [receiptPreviews, setReceiptPreviews] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useQuery(api.categories.list);
  const properties = useQuery(api.properties.list);
  const createTransaction = useMutation(api.transactions.create);
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl);
  const scanReceipt = useAction(api.receiptScanner.scanReceiptPublic);

  function defaultValues(): TransactionFormValues {
    return {
      kind: defaultKind ?? "expense",
      realm: defaultRealm ?? (defaultKind ? undefined : "personal"),
      amount: "",
      date: todayString(),
      description: "",
      categoryId: "",
      propertyId: defaultPropertyId ?? "",
      notes: "",
    };
  }

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: defaultValues(),
  });

  // Reset and focus when drawer opens
  useEffect(() => {
    if (!isOpen) return;
    setSaving(false);
    setScanning(false);
    setAutoFilled(new Set());
    setReceiptFiles([]);
    setReceiptPreviews((prev) => { prev.forEach((p) => URL.revokeObjectURL(p)); return []; });
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    form.reset(defaultValues());
    const timer = setTimeout(() => form.setFocus("amount"), 300);
    return () => clearTimeout(timer);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const kind = form.watch("kind");
  const realm = form.watch("realm");
  const account = form.watch("account");
  // Mirrors categoryRealmFor: no category for transfers or (uncategorized) rental income.
  const showCategory = kind !== "transfer" && !!realm && !(kind === "income" && realm === "rental");
  const showProperty = kind !== "transfer" && realm === "rental";
  const propertyRequired = showProperty;

  const filteredCategories = (categories ?? []).filter((cat) => {
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
  const dividendPaid = form.watch("dividendPaid");
  const shape = tryShapeFromFields({ kind, realm, account, from, to, purpose, dividendPaid });
  const loanImpact = getLoanImpact(shape, amountNum);

  function clearAutoFilled(fieldName: string) {
    setAutoFilled((prev) => {
      if (!prev.has(fieldName)) return prev;
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    });
  }

  async function runScan(files: File[]) {
    if (files.length === 0) {
      setAutoFilled(new Set());
      return;
    }
    if (!categories) {
      console.warn("[receipt scan] categories not yet loaded — skipping scan");
      return;
    }

    setScanning(true);
    try {
      const images = await Promise.all(
        files.map(async (f) => ({ imageBase64: await fileToBase64(f), imageType: "image/jpeg" }))
      );
      console.log("[receipt scan] calling scanReceipt, images:", images.length, "categories:", categories.length);
      const result = await scanReceipt({
        images,
        categories: categories.map((c) => ({ id: c._id, name: c.name, realm: c.realm })),
      });
      console.log("[receipt scan] result:", result);

      const filled = new Set<string>();

      if (result.amount) { form.setValue("amount", result.amount); filled.add("amount"); }
      if (result.date) { form.setValue("date", result.date); filled.add("date"); }
      if (result.description) { form.setValue("description", result.description); filled.add("description"); }
      if (result.notes) { form.setValue("notes", result.notes); filled.add("notes"); }

      // The scanner can only ever infer personal_expense/business_expense — it
      // has no way to know which account paid, so account defaults to realm.
      const effectiveRealm = result.type === "personal_expense" ? "personal" : result.type === "business_expense" ? "business" : form.getValues("realm");
      if (result.type) {
        form.setValue("kind", "expense");
        form.setValue("realm", effectiveRealm);
        form.setValue("account", undefined);
        form.setValue("categoryId", "");
        filled.add("kind");
      }

      if (result.categoryId) {
        const cat = categories.find((c) => c._id === result.categoryId);
        const realmMatch =
          effectiveRealm != null &&
          cat !== undefined &&
          (cat.realm === effectiveRealm || cat.realm === "both");

        if (realmMatch) {
          form.setValue("categoryId", result.categoryId);
          filled.add("categoryId");
        }
      }

      setAutoFilled(filled);
    } catch (err) {
      console.error("[receipt scan] failed:", err);
    } finally {
      setScanning(false);
    }
  }

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = Array.from(e.target.files ?? []);
    if (raw.length === 0) return;

    const room = MAX_RECEIPT_PHOTOS - receiptFiles.length;
    const accepted = raw.slice(0, Math.max(0, room));
    if (accepted.length === 0) return;

    const compressed = await Promise.all(
      accepted.map(async (f) => {
        try {
          return await compressImage(f);
        } catch {
          return f;
        }
      })
    );

    const nextFiles = [...receiptFiles, ...compressed];
    setReceiptFiles(nextFiles);
    setReceiptPreviews((prev) => [...prev, ...compressed.map((f) => URL.createObjectURL(f))]);

    await runScan(nextFiles);
  }

  function removeReceiptAt(index: number) {
    const nextFiles = receiptFiles.filter((_, i) => i !== index);
    setReceiptFiles(nextFiles);
    setReceiptPreviews((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed);
      return prev.filter((_, i) => i !== index);
    });
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    void runScan(nextFiles);
  }

  async function handleSave(data: TransactionFormValues) {
    setSaving(true);
    try {
      const receiptStorageIds: Id<"_storage">[] = await Promise.all(
        receiptFiles.map(async (file) => {
          const uploadUrl = await generateUploadUrl();
          const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
          if (!res.ok) throw new Error("Receipt upload failed");
          const { storageId } = await res.json();
          return storageId as Id<"_storage">;
        })
      );
      await createTransaction({
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
        dividendPaid: data.dividendPaid,
        categoryId: data.categoryId ? (data.categoryId as Id<"categories">) : undefined,
        propertyId: data.propertyId ? (data.propertyId as Id<"properties">) : undefined,
        receiptStorageIds: receiptStorageIds.length > 0 ? receiptStorageIds : undefined,
      });
      toast.success("Transaction saved");
      onSuccess();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSave)}>
        <div className="px-4 pt-2 space-y-3 pb-2">
          {/* Type Selector */}
          <div className="relative">
            {autoFilled.has("kind") && (
              <span className="absolute -top-0.5 right-0 text-[10px] font-medium text-accent normal-case tracking-normal">
                auto-filled
              </span>
            )}
            <TransactionKindFields form={form} />
          </div>

          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel variant="muted">
                  Amount
                  <AutoFilledBadge field="amount" autoFilled={autoFilled} />
                </FormLabel>
                <div className={`flex items-center gap-2 rounded-2xl border bg-surface px-4 py-1.5 ${fieldState.invalid ? "border-negative" : "border-border"}`}>
                  <span className="font-mono text-sm font-medium text-text-muted">CAD</span>
                  <input
                    {...field}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="flex-1 min-w-0 bg-transparent font-mono text-3xl font-semibold text-text-primary outline-none placeholder:text-text-muted"
                    onChange={(e) => {
                      field.onChange(e);
                      clearAutoFilled("amount");
                    }}
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
                <FormLabel variant="muted">
                  Description
                  <AutoFilledBadge field="description" autoFilled={autoFilled} />
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="text"
                    placeholder="What was this for?"
                    className={fieldState.invalid ? "border-negative" : ""}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      clearAutoFilled("description");
                    }}
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
                  <FormLabel variant="muted">
                    Date
                    <AutoFilledBadge field="date" autoFilled={autoFilled} />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="font-mono appearance-none"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        clearAutoFilled("date");
                      }}
                    />
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
                    <FormLabel variant="muted">
                      Category
                      <AutoFilledBadge field="categoryId" autoFilled={autoFilled} />
                    </FormLabel>
                    {categories === undefined ? (
                      <Skeleton className="h-12 w-full rounded-2xl" />
                    ) : filteredCategories.length === 0 ? (
                      <p className="text-xs text-text-muted">
                        No {kind} categories yet.{" "}
                        <Link href="/settings/categories" className="underline">
                          Add one in Settings.
                        </Link>
                      </p>
                    ) : (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) => {
                          field.onChange(v);
                          clearAutoFilled("categoryId");
                        }}
                      >
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
                    )}
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
                <FormLabel variant="muted">
                  Notes (optional)
                  <AutoFilledBadge field="notes" autoFilled={autoFilled} />
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any additional details…"
                    rows={1}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      clearAutoFilled("notes");
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Receipt Photos */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
              Receipts <span className="normal-case font-normal text-text-muted">(optional — add more than one if the total is split across photos, e.g. an itemized receipt plus a card slip)</span>
            </label>

            {receiptPreviews.length > 0 && (
              <div className="relative">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {receiptPreviews.map((preview, i) => (
                    <div key={preview} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt={`Receipt ${i + 1}`}
                        className={`w-full h-full object-cover transition-opacity duration-200 ${scanning ? "opacity-40" : ""}`}
                      />
                      {!scanning && (
                        <button
                          type="button"
                          onClick={() => removeReceiptAt(i)}
                          className="absolute top-1 right-1 flex items-center justify-center w-6 h-6 rounded-full bg-bg/80 active:scale-95 transition-transform"
                        >
                          <X size={12} className="text-text-primary" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-bg/60 rounded-xl">
                    <Loader2 size={16} className="animate-spin text-text-primary" />
                    <span className="text-sm font-medium text-text-primary">Scanning…</span>
                  </div>
                )}
              </div>
            )}

            {receiptFiles.length < MAX_RECEIPT_PHOTOS && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-2 active:bg-border/20 transition-colors min-h-[44px]"
                >
                  <Camera size={16} className="text-text-muted" />
                  <span className="text-sm text-text-muted">
                    {receiptFiles.length > 0 ? "Take Another Photo" : "Take Photo"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-2 active:bg-border/20 transition-colors min-h-[44px]"
                >
                  <Upload size={16} className="text-text-muted" />
                  <span className="text-sm text-text-muted">
                    {receiptFiles.length > 0 ? "Add More Photos" : "Upload Photo(s)"}
                  </span>
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleReceiptChange} className="sr-only" />
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleReceiptChange} className="sr-only" />
              </div>
            )}
          </div>
        </div>

        {/* Save Button — sits in normal flow at the end of the form */}
        <div className="px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border mt-3">
          <Button type="submit" disabled={saving || scanning}>
            {saving ? "Saving…" : "Save Transaction"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
