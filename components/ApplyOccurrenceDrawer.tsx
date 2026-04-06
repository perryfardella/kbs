"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ApplyOccurrenceForm } from "@/components/ApplyOccurrenceForm";

function ApplyOccurrenceDrawerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const applyId = searchParams.get("applyOccurrence");
  const date = searchParams.get("date");
  const isOpen = !!applyId && !!date;

  function handleClose() {
    router.replace("/transactions?tab=upcoming");
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DrawerContent className="bg-bg border-border flex flex-col max-h-[92dvh]">
        <DrawerTitle className="sr-only">Apply Recurring Transaction</DrawerTitle>
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          <span className="text-base font-semibold text-text-primary">Apply Transaction</span>
          <Button variant="ghost" size="icon" className="-mr-2" onClick={handleClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </Button>
        </div>
        <div className="overflow-y-auto flex-1">
          {applyId && date && (
            <ApplyOccurrenceForm
              recurringTransactionId={applyId as Id<"recurringTransactions">}
              scheduledDate={date}
              onSuccess={handleClose}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function ApplyOccurrenceDrawer() {
  return (
    <Suspense>
      <ApplyOccurrenceDrawerInner />
    </Suspense>
  );
}
