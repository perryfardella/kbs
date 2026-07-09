"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Archive, Trash2, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
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
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { PropertyForm } from "@/components/PropertyForm";

function EditPropertyDrawerInner({ propertyId }: { propertyId: Id<"properties"> }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isOpen = searchParams.get("editProperty") === "true";

  const property = useQuery(api.properties.get, isOpen ? { propertyId } : "skip");
  const archiveProperty = useMutation(api.properties.archive);
  const removeProperty = useMutation(api.properties.remove);

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [working, setWorking] = useState(false);

  function handleClose() {
    router.replace(`/properties/${propertyId}`);
  }

  async function handleArchive() {
    setWorking(true);
    try {
      await archiveProperty({ propertyId });
      toast.success("Property archived");
      setShowArchiveDialog(false);
      router.replace("/properties");
    } catch (err) {
      console.error(err);
      setWorking(false);
      setShowArchiveDialog(false);
    }
  }

  async function handleDelete() {
    setWorking(true);
    try {
      await removeProperty({ propertyId });
      toast.success("Property deleted");
      setShowDeleteDialog(false);
      router.replace("/properties");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete property"
      );
      setWorking(false);
      setShowDeleteDialog(false);
    }
  }

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DrawerContent className="bg-bg border-border flex flex-col max-h-[92dvh]">
          <DrawerTitle className="sr-only">Edit Property</DrawerTitle>
          <div className="flex items-center justify-between px-4 pb-3 shrink-0">
            <span className="text-base font-semibold text-text-primary">Edit Property</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setShowArchiveDialog(true)} aria-label="Archive property">
                <Archive size={16} className="text-badge-transfer" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(true)} aria-label="Delete property">
                <Trash2 size={16} className="text-negative" />
              </Button>
              <Button variant="ghost" size="icon" className="-mr-2" onClick={handleClose} aria-label="Close">
                <X size={18} className="text-text-muted" />
              </Button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {property === undefined ? (
              <div className="px-4 pt-2 space-y-3 pb-2">
                <Skeleton className="h-11 w-full rounded-2xl" />
                <Skeleton className="h-11 w-full rounded-2xl" />
              </div>
            ) : property === null ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-text-muted">Property not found.</p>
              </div>
            ) : (
              <PropertyForm
                isOpen={isOpen}
                onSuccess={handleClose}
                propertyId={propertyId}
                initialName={property.name}
                initialAddress={property.address ?? ""}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Property?</DialogTitle>
            <DialogDescription>
              It will be hidden from the properties list and transaction pickers.
              Its transactions are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" size="sm" disabled={working} onClick={() => setShowArchiveDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="border border-badge-transfer/30 bg-badge-transfer/20 text-badge-transfer"
              disabled={working}
              onClick={handleArchive}
            >
              {working ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property?</DialogTitle>
            <DialogDescription>
              This cannot be undone. A property with existing transactions cannot
              be deleted — archive it instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" size="sm" disabled={working} onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-negative text-white border-0"
              disabled={working}
              onClick={handleDelete}
            >
              {working ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditPropertyDrawer({ propertyId }: { propertyId: Id<"properties"> }) {
  return (
    <Suspense>
      <EditPropertyDrawerInner propertyId={propertyId} />
    </Suspense>
  );
}
