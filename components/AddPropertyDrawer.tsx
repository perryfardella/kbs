"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { PropertyForm } from "@/components/PropertyForm";

function AddPropertyDrawerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isOpen = searchParams.get("add") === "true";

  function handleClose() {
    router.replace("/properties");
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DrawerContent className="bg-bg border-border flex flex-col max-h-[92dvh]">
        <DrawerTitle className="sr-only">Add Property</DrawerTitle>
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          <span className="text-base font-semibold text-text-primary">Add Property</span>
          <Button variant="ghost" size="icon" className="-mr-2" onClick={handleClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </Button>
        </div>
        <div className="overflow-y-auto flex-1">
          <PropertyForm isOpen={isOpen} onSuccess={handleClose} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function AddPropertyDrawer() {
  return (
    <Suspense>
      <AddPropertyDrawerInner />
    </Suspense>
  );
}
