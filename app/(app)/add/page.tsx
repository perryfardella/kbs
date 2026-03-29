"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Info, X, ChevronLeft, Loader2, Camera, Upload } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
      return { text: `This will increase the corp's debt to you by ${fmt}`, positive: true };
    case "transfer_to_business":
      return { text: `This will increase the corp's debt to you by ${fmt}`, positive: true };
    case "transfer_to_personal":
      return { text: `This will decrease the corp's debt to you by ${fmt}`, positive: false };
    default:
      return null;
  }
}

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const selectClass = "w-full rounded-2xl border bg-surface pl-4 pr-10 py-3 text-text-primary outline-none focus:border-accent min-h-[44px] appearance-none";

function AutoFilledBadge({ field, autoFilled }: { field: string; autoFilled: Set<string> }) {
  if (!autoFilled.has(field)) return null;
  return (
    <span className="ml-1.5 text-[10px] font-medium text-accent normal-case tracking-normal">
      auto-filled
    </span>
  );
}

export default function AddTransactionPage() {
  const router = useRouter();

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useQuery(api.categories.list);
  const createTransaction = useMutation(api.transactions.create);
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl);
  const scanReceipt = useAction(api.receiptScanner.scanReceiptPublic);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "personal_expense",
      amount: "",
      date: todayString(),
      description: "",
      categoryId: "",
      notes: "",
    },
  });

  useEffect(() => { form.setFocus("amount"); }, [form]);

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

  function clearAutoFilled(fieldName: string) {
    setAutoFilled((prev) => {
      if (!prev.has(fieldName)) return prev;
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    });
  }

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0] ?? null;
    if (!raw) return;

    // Compress before storing — this same File is uploaded on save
    let compressed: File;
    try {
      compressed = await compressImage(raw);
    } catch {
      // Compression failed — store original, skip scan
      setReceiptFile(raw);
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
      setReceiptPreview(URL.createObjectURL(raw));
      return;
    }

    setReceiptFile(compressed);
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview(URL.createObjectURL(compressed));

    if (!categories) {
      console.warn("[receipt scan] categories not yet loaded — skipping scan");
      return;
    }

    setScanning(true);
    try {
      const imageBase64 = await fileToBase64(compressed);
      console.log("[receipt scan] calling scanReceipt, categories:", categories.length);
      const result = await scanReceipt({
        imageBase64,
        imageType: "image/jpeg",
        // Pass live category list — new categories added by the user are automatically included
        categories: categories.map((c) => ({ id: c._id, name: c.name, realm: c.realm })),
      });
      console.log("[receipt scan] result:", result);

      const filled = new Set<string>();

      if (result.amount) {
        form.setValue("amount", result.amount);
        filled.add("amount");
      }
      if (result.date) {
        form.setValue("date", result.date);
        filled.add("date");
      }
      if (result.description) {
        form.setValue("description", result.description);
        filled.add("description");
      }
      if (result.notes) {
        form.setValue("notes", result.notes);
        filled.add("notes");
      }

      // Set type before validating categoryId — category realm must match the type
      const effectiveType = result.type ?? form.getValues("type");
      if (result.type) {
        form.setValue("type", result.type);
        form.setValue("categoryId", "");
        filled.add("type");
      }

      if (result.categoryId) {
        const typeOption = TYPE_OPTIONS.find((t) => t.value === effectiveType);
        const realm = typeOption?.categoryRealm;
        const cat = categories.find((c) => c._id === result.categoryId);
        const realmMatch =
          realm !== null &&
          cat !== undefined &&
          (cat.realm === realm || cat.realm === "both");

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

  function removeReceipt() {
    setReceiptFile(null);
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview(null);
    setAutoFilled(new Set());
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave(data: TransactionFormValues) {
    setSaving(true);
    try {
      let receiptStorageId: Id<"_storage"> | undefined;
      if (receiptFile) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": receiptFile.type }, body: receiptFile });
        if (!res.ok) throw new Error("Receipt upload failed");
        const { storageId } = await res.json();
        receiptStorageId = storageId as Id<"_storage">;
      }
      await createTransaction({
        date: data.date,
        amount: parseFloat(data.amount),
        description: data.description.trim(),
        notes: data.notes?.trim() || undefined,
        type: data.type,
        categoryId: data.categoryId ? (data.categoryId as Id<"categories">) : undefined,
        receiptStorageId,
      });
      router.push("/");
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-bg border-b border-border">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/"><ChevronLeft size={20} className="text-text-muted" /></Link>
        </Button>
        <h1 className="font-display text-lg font-semibold text-text-primary">
          Add Transaction
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSave)}>
          <div className="px-4 pt-5 space-y-5 pb-28">
            {/* Type Selector */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
                    Type
                    <AutoFilledBadge field="type" autoFilled={autoFilled} />
                  </label>
                  <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
                    {TYPE_OPTIONS.map((opt) => (
                      <Toggle
                        key={opt.value}
                        pressed={field.value === opt.value}
                        onPressedChange={() => {
                          field.onChange(opt.value);
                          form.setValue("categoryId", "");
                          clearAutoFilled("type");
                          clearAutoFilled("categoryId");
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
                  <FormLabel variant="muted">
                    Amount
                    <AutoFilledBadge field="amount" autoFilled={autoFilled} />
                  </FormLabel>
                  <div className={`flex items-center gap-2 rounded-2xl border bg-surface px-4 py-3 ${fieldState.invalid ? "border-negative" : "border-border"}`}>
                    <span className="font-mono text-sm font-medium text-text-muted">CAD</span>
                    <input
                      {...field}
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="flex-1 bg-transparent font-mono text-3xl font-semibold text-text-primary outline-none placeholder:text-[#2a2a2a]"
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

            {/* Date */}
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
                      className="font-mono"
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

            {/* Category */}
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
                    ) : (
                      <select
                        value={field.value ?? ""}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          clearAutoFilled("categoryId");
                        }}
                        className={`${selectClass} ${fieldState.invalid ? "border-negative" : "border-border"}`}
                      >
                        <option value="">Select a category…</option>
                        {filteredCategories.map((cat) => (
                          <option key={cat._id} value={cat._id}>{cat.name}</option>
                        ))}
                      </select>
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
                      rows={3}
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

            {/* Receipt Photo */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
                Receipt <span className="normal-case font-normal text-text-muted">(optional)</span>
              </label>
              {receiptPreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className={`w-full max-h-52 object-cover transition-opacity duration-200 ${scanning ? "opacity-40" : ""}`}
                  />
                  {scanning ? (
                    <div className="absolute inset-0 flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-text-primary" />
                      <span className="text-sm font-medium text-text-primary">Scanning…</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={removeReceipt}
                      className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-full bg-bg/80 active:scale-95 transition-transform"
                    >
                      <X size={16} className="text-text-primary" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-surface px-4 py-6 active:bg-border/20 transition-colors min-h-[44px]"
                  >
                    <Camera size={18} className="text-text-muted" />
                    <span className="text-sm text-text-muted">Take Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-surface px-4 py-6 active:bg-border/20 transition-colors min-h-[44px]"
                  >
                    <Upload size={18} className="text-text-muted" />
                    <span className="text-sm text-text-muted">Upload File</span>
                  </button>
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleReceiptChange} className="sr-only" />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleReceiptChange} className="sr-only" />
                </div>
              )}
            </div>
          </div>

          {/* Sticky Save Button */}
          <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-0 right-0 z-20 px-4 pt-3 pb-3 bg-bg/95 backdrop-blur-sm border-t border-border">
            <div className="mx-auto max-w-lg">
              <Button type="submit" disabled={saving || scanning}>
                {saving ? "Saving…" : "Save Transaction"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
