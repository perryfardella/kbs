"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EditTransactionForm } from "@/components/EditTransactionForm";

function EditTransactionDrawerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("edit");
  const isOpen = !!editId;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const removeTransaction = useMutation(api.transactions.remove);

  function handleClose() {
    router.replace("/transactions");
  }

  async function handleDelete() {
    if (!editId) return;
    setDeleting(true);
    try {
      await removeTransaction({ transactionId: editId as Id<"transactions"> });
      toast.success("Transaction deleted");
      setShowDeleteDialog(false);
      handleClose();
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DrawerContent className="bg-bg border-border flex flex-col max-h-[92dvh]">
          <DrawerTitle className="sr-only">Edit Transaction</DrawerTitle>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 shrink-0">
            <span className="text-base font-semibold text-text-primary">Edit Transaction</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                aria-label="Delete transaction"
              >
                <Trash2 size={16} className="text-negative" />
              </Button>
              <Button variant="ghost" size="icon" className="-mr-2" onClick={handleClose} aria-label="Close">
                <X size={18} className="text-text-muted" />
              </Button>
            </div>
          </div>
          {/* Scrollable form */}
          <div className="overflow-y-auto flex-1">
            {editId && (
              <EditTransactionForm
                transactionId={editId as Id<"transactions">}
                onSuccess={handleClose}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Dialog — outside the Drawer so it renders above the overlay */}
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
    </>
  );
}

export function EditTransactionDrawer() {
  return (
    <Suspense>
      <EditTransactionDrawerInner />
    </Suspense>
  );
}
