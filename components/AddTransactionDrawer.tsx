"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerBody,
  DrawerTitle,
} from "@/components/ui/drawer";
import { AddTransactionForm } from "@/components/AddTransactionForm";

type TransactionTypeParam =
  | "personal_expense"
  | "business_expense"
  | "business_expense_personal_pay"
  | "personal_expense_business_pay"
  | "transfer_to_personal"
  | "transfer_to_business"
  | "dividend_payment"
  | "rental_income"
  | "rental_expense";

function AddTransactionDrawerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isOpen = searchParams.get("add") === "true";
  const returnTo = searchParams.get("returnTo") ?? "/transactions";
  const defaultPropertyId = searchParams.get("property") ?? undefined;
  const defaultType = (searchParams.get("type") as TransactionTypeParam | null) ?? undefined;

  function handleClose() {
    router.replace(returnTo);
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DrawerContent className="bg-bg border-border">
        <DrawerTitle className="sr-only">Add Transaction</DrawerTitle>
        {/* Visible header */}
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          <span className="text-base font-semibold text-text-primary">Add Transaction</span>
          <Button variant="ghost" size="icon" className="-mr-2" onClick={handleClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </Button>
        </div>
        <DrawerBody>
          <AddTransactionForm
            isOpen={isOpen}
            onSuccess={handleClose}
            defaultPropertyId={defaultPropertyId}
            defaultType={defaultType}
          />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

export function AddTransactionDrawer() {
  return (
    <Suspense>
      <AddTransactionDrawerInner />
    </Suspense>
  );
}
