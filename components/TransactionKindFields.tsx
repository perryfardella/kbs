"use client";

import { Info } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import { KIND_OPTIONS, REALM_OPTIONS, SIDE_OPTIONS, type Kind, type Realm, type Side } from "@/lib/transactionFields";

// The subset of fields every transaction/recurring form shares — the piece
// this component drives. Both TransactionFormValues and RecurringTransactionFormValues
// satisfy this shape. `paidDate` only exists on TransactionFormValues (a recurring rule
// never carries a paid state — see showPaidDate below) but stays here, optional, since
// the two schemas share this one generic component.
export interface ShapeFormValues {
  kind: Kind;
  realm?: Realm;
  account?: Side;
  from?: Side;
  to?: Side;
  purpose?: "dividend";
  paidDate?: string;
  categoryId?: string;
  propertyId?: string;
}

const DIRECTION_OPTIONS: { from: Side; to: Side; label: string }[] = [
  { from: "personal", to: "business", label: "Personal → Business" },
  { from: "business", to: "personal", label: "Business → Personal" },
];

interface TransactionKindFieldsProps<T extends ShapeFormValues> {
  form: UseFormReturn<T>;
  // Recurring rules never carry a paid state — every generated occurrence always starts
  // declared-only, with a paid date added later by editing that occurrence's own
  // transaction. Defaults to true for the one-off transaction forms.
  showPaidDate?: boolean;
}

// react-hook-form's setValue/watch need a Path<T> literal, but this component
// is generic over two structurally-identical-in-this-slice schemas — cast
// through FieldPath<T> at the call sites instead of threading a second
// generic parameter through every helper.
export function TransactionKindFields<T extends ShapeFormValues>({ form, showPaidDate = true }: TransactionKindFieldsProps<T>) {
  const path = <K extends keyof ShapeFormValues>(key: K) => key as unknown as FieldPath<T>;

  const kind = form.watch(path("kind")) as unknown as Kind;
  const realm = form.watch(path("realm")) as unknown as Realm | undefined;
  const account = form.watch(path("account")) as unknown as Side | undefined;
  const from = form.watch(path("from")) as unknown as Side | undefined;
  const to = form.watch(path("to")) as unknown as Side | undefined;
  const purpose = form.watch(path("purpose")) as unknown as "dividend" | undefined;
  const paidDate = form.watch(path("paidDate")) as unknown as string | undefined;

  function set<K extends keyof ShapeFormValues>(key: K, value: ShapeFormValues[K]) {
    form.setValue(path(key), value as never);
  }

  function setKind(next: Kind) {
    set("kind", next);
    set("categoryId", "");
    set("propertyId", "");
    if (next === "transfer") {
      set("realm", undefined);
      set("account", undefined);
    } else {
      set("from", undefined);
      set("to", undefined);
      set("purpose", undefined);
      set("paidDate", undefined);
    }
  }

  function setRealm(next: Realm) {
    set("realm", next);
    set("account", undefined); // reset to the default (matches realm)
    set("categoryId", "");
    set("propertyId", "");
  }

  function setDirection(next: { from: Side; to: Side }) {
    set("from", next.from);
    set("to", next.to);
    if (!(next.from === "business" && next.to === "personal")) {
      set("purpose", undefined);
      set("paidDate", undefined);
    }
  }

  const effectiveAccount = account ?? realm;

  return (
    <div className="space-y-3">
      {/* Kind */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">Type</label>
        <div className="flex gap-2">
          {KIND_OPTIONS.map((opt) => (
            <Toggle key={opt.value} pressed={kind === opt.value} onPressedChange={() => setKind(opt.value)} className="flex-1">
              {opt.label}
            </Toggle>
          ))}
        </div>
      </div>

      {kind !== "transfer" ? (
        <>
          {/* Realm */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
              {kind === "income" ? "Who earned it" : "Who's it for"}
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {REALM_OPTIONS.map((opt) => (
                <Toggle key={opt.value} pressed={realm === opt.value} onPressedChange={() => setRealm(opt.value)}>
                  {opt.label}
                </Toggle>
              ))}
            </div>
          </div>

          {/* Paid via — which account the cash moved through. Hidden for rental
              (no loan effect either way), defaults to match realm so it's invisible
              for the common case. */}
          {realm && realm !== "rental" && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">Paid via</label>
              <div className="flex gap-2">
                {SIDE_OPTIONS.map((opt) => (
                  <Toggle
                    key={opt.value}
                    pressed={effectiveAccount === opt.value}
                    onPressedChange={() => set("account", opt.value)}
                    className="flex-1"
                  >
                    {opt.label}
                  </Toggle>
                ))}
              </div>
              {effectiveAccount !== realm && (
                <p className="flex items-start gap-1.5 text-xs text-text-muted leading-relaxed">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  Money moved through the {effectiveAccount} account, even though this is {realm} {kind}.
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Direction */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">Direction</label>
            <div className="flex gap-2">
              {DIRECTION_OPTIONS.map((opt) => (
                <Toggle
                  key={opt.label}
                  pressed={from === opt.from && to === opt.to}
                  onPressedChange={() => setDirection(opt)}
                  className="flex-1"
                >
                  {opt.label}
                </Toggle>
              ))}
            </div>
          </div>

          {/* Dividend — only a valid label for a business → personal transfer. */}
          {from === "business" && to === "personal" && (
            <div className="space-y-1.5">
              <Toggle
                pressed={purpose === "dividend"}
                onPressedChange={(pressed) => {
                  set("purpose", pressed ? "dividend" : undefined);
                  set("paidDate", undefined);
                }}
              >
                Mark as dividend
              </Toggle>
              <p className="flex items-start gap-1.5 text-xs text-text-muted leading-relaxed">
                <Info size={12} className="mt-0.5 shrink-0" />
                Dividends also show up in your personal income report.
              </p>

              {purpose === "dividend" && showPaidDate && (
                <div className="space-y-1.5 pt-1">
                  <label htmlFor="dividend-paid-date" className="block text-xs font-medium text-text-muted uppercase tracking-wide">
                    Paid date (optional)
                  </label>
                  <Input
                    id="dividend-paid-date"
                    type="date"
                    className="font-mono appearance-none"
                    value={paidDate ?? ""}
                    onChange={(e) => set("paidDate", e.target.value || undefined)}
                  />
                  <p className="flex items-start gap-1.5 text-xs text-text-muted leading-relaxed">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    {paidDate
                      ? "Real cash moves business → personal on this date. Once paid, this dividend has no net effect on the shareholder loan."
                      : "Leave blank until it's actually paid — until then it's declared and booked straight against the shareholder loan, reducing what you owe the corp (or increasing what it owes you)."}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
