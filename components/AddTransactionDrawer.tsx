"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { AddTransactionForm } from "@/components/AddTransactionForm";

function AddTransactionDrawerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isOpen = searchParams.get("add") === "true";

  function handleClose() {
    router.replace("/transactions");
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DrawerContent className="bg-bg border-border flex flex-col max-h-[92dvh]">
        <DrawerTitle className="sr-only">Add Transaction</DrawerTitle>
        {/* Visible header */}
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          <span className="text-base font-semibold text-text-primary">Add Transaction</span>
          <Button variant="ghost" size="icon" className="-mr-2" onClick={handleClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </Button>
        </div>
        <div className="overflow-y-auto flex-1">
          <AddTransactionForm isOpen={isOpen} onSuccess={handleClose} />
        </div>
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
