"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { OctagonX, Trash2, X } from "lucide-react";
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
import { EditRecurringForm } from "@/components/EditRecurringForm";

function EditRecurringDrawerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("editRecurring");
  const isOpen = !!editId;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const removeRecurring = useMutation(api.recurringTransactions.remove);
  const deactivateRecurring = useMutation(api.recurringTransactions.deactivate);

  function handleClose() {
    router.replace("/transactions?tab=upcoming");
  }

  async function handleStop() {
    if (!editId) return;
    setStopping(true);
    try {
      await deactivateRecurring({ recurringTransactionId: editId as Id<"recurringTransactions"> });
      toast.success("Recurring transaction stopped");
      setShowStopDialog(false);
      handleClose();
    } catch (err) {
      console.error(err);
      setStopping(false);
      setShowStopDialog(false);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    setDeleting(true);
    try {
      await removeRecurring({ recurringTransactionId: editId as Id<"recurringTransactions"> });
      toast.success("Recurring transaction deleted");
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
          <DrawerTitle className="sr-only">Edit Recurring Transaction</DrawerTitle>
          <div className="flex items-center justify-between px-4 pb-3 shrink-0">
            <span className="text-base font-semibold text-text-primary">Edit Recurring</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowStopDialog(true)}
                aria-label="Stop recurring transaction"
              >
                <OctagonX size={16} className="text-text-muted" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                aria-label="Delete recurring transaction"
              >
                <Trash2 size={16} className="text-negative" />
              </Button>
              <Button variant="ghost" size="icon" className="-mr-2" onClick={handleClose} aria-label="Close">
                <X size={18} className="text-text-muted" />
              </Button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {editId && (
              <EditRecurringForm
                recurringTransactionId={editId as Id<"recurringTransactions">}
                onSuccess={handleClose}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop Recurring Transaction?</DialogTitle>
            <DialogDescription>
              No future occurrences will be generated. Your existing transaction history is preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" size="sm" disabled={stopping} onClick={() => setShowStopDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={stopping} onClick={handleStop}>
              {stopping ? "Stopping…" : "Stop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recurring Transaction?</DialogTitle>
            <DialogDescription>
              This will stop all future occurrences. Applied transactions will not be affected.
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

export function EditRecurringDrawer() {
  return (
    <Suspense>
      <EditRecurringDrawerInner />
    </Suspense>
  );
}
