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
import { KINDS, REALMS, type Kind, type Realm } from "@/lib/transactionFields";

function AddTransactionDrawerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isOpen = searchParams.get("add") === "true";
  const returnTo = searchParams.get("returnTo") ?? "/transactions";
  const defaultPropertyId = searchParams.get("property") ?? undefined;
  const kindParam = searchParams.get("kind");
  const realmParam = searchParams.get("realm");
  const defaultKind = (KINDS as readonly string[]).includes(kindParam ?? "") ? (kindParam as Kind) : undefined;
  const defaultRealm = (REALMS as readonly string[]).includes(realmParam ?? "") ? (realmParam as Realm) : undefined;

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
            defaultKind={defaultKind}
            defaultRealm={defaultRealm}
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
