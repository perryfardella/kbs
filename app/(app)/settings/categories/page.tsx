"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";
import { ChevronLeft, Archive, Trash2 } from "lucide-react";

type Tab = "personal" | "business";

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("personal");
  const [newPersonalName, setNewPersonalName] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [addingPersonal, setAddingPersonal] = useState(false);
  const [addingBusiness, setAddingBusiness] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<Id<"categories"> | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<Id<"categories"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"categories"> | null>(null);

  const categories = useQuery(api.categories.list);
  const createCategory = useMutation(api.categories.create);
  const archiveCategory = useMutation(api.categories.archive);
  const deleteCategory = useMutation(api.categories.deleteCategory);

  const personalCategories =
    categories?.filter((c) => c.realm === "personal" || c.realm === "both") ?? [];
  const businessCategories =
    categories?.filter((c) => c.realm === "business" || c.realm === "both") ?? [];

  const shownCategories =
    activeTab === "personal" ? personalCategories : businessCategories;

  async function handleAdd(tab: Tab) {
    const name = (tab === "personal" ? newPersonalName : newBusinessName).trim();
    if (!name) return;
    const setAdding = tab === "personal" ? setAddingPersonal : setAddingBusiness;
    setAdding(true);
    try {
      await createCategory({ name, realm: tab });
      if (tab === "personal") setNewPersonalName("");
      else setNewBusinessName("");
    } finally {
      setAdding(false);
    }
  }

  async function handleArchive(id: Id<"categories">) {
    setConfirmArchiveId(id);
  }

  async function confirmArchive(id: Id<"categories">) {
    await archiveCategory({ categoryId: id });
    setConfirmArchiveId(null);
  }

  async function handleDelete(id: Id<"categories">) {
    setDeletingId(id);
    try {
      await deleteCategory({ categoryId: id });
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  }

  const isLoading = categories === undefined;
  const newName = activeTab === "personal" ? newPersonalName : newBusinessName;
  const isAdding = activeTab === "personal" ? addingPersonal : addingBusiness;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1f1f1f] bg-[#141414] active:scale-95 transition-transform"
        >
          <ChevronLeft size={18} className="text-text-muted" />
        </Link>
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Categories
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl border border-[#1f1f1f] bg-[#141414] p-1">
        {(["personal", "business"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors active:scale-95 capitalize ${
              activeTab === tab
                ? "bg-accent text-bg"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Category List */}
      {isLoading ? (
        <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] divide-y divide-[#1f1f1f] overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      ) : shownCategories.length === 0 ? (
        <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] px-4 py-8 text-center text-sm text-text-muted">
          No {activeTab} categories. Add one below.
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] divide-y divide-[#1f1f1f] overflow-hidden">
          {shownCategories.map((cat) => (
            <div
              key={cat._id}
              className="flex items-center gap-2 px-4 py-3 min-h-[44px]"
            >
              <span className="flex-1 text-sm text-text-primary truncate">
                {cat.name}
              </span>
              {cat.isDefault && (
                <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  Default
                </span>
              )}

              {/* Confirm archive inline */}
              {confirmArchiveId === cat._id ? (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setConfirmArchiveId(null)}
                    className="rounded-lg border border-[#1f1f1f] px-2 py-1 text-xs text-text-muted active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => confirmArchive(cat._id)}
                    className="rounded-lg border border-[#fb923c]/30 bg-[#fb923c]/20 px-2 py-1 text-xs text-[#fb923c] active:scale-95 transition-transform"
                  >
                    Archive
                  </button>
                </div>
              ) : /* Confirm delete inline */
              !cat.isDefault && confirmDeleteId === cat._id ? (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-lg border border-[#1f1f1f] px-2 py-1 text-xs text-text-muted active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(cat._id)}
                    disabled={deletingId === cat._id}
                    className="rounded-lg border border-negative/30 bg-negative/20 px-2 py-1 text-xs text-negative active:scale-95 transition-transform disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <div className="flex gap-1 shrink-0">
                  {/* Archive */}
                  <button
                    onClick={() => handleArchive(cat._id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-[#fb923c] active:scale-95 transition-all"
                    title="Archive — hides from pickers"
                  >
                    <Archive size={15} />
                  </button>
                  {/* Delete (user-created only) */}
                  {!cat.isDefault && (
                    <button
                      onClick={() => setConfirmDeleteId(cat._id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-negative active:scale-95 transition-all"
                      title="Delete permanently"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new category */}
      <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] p-4 space-y-3">
        <p className="text-sm font-semibold text-text-muted uppercase tracking-wide">
          Add {activeTab} category
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) =>
              activeTab === "personal"
                ? setNewPersonalName(e.target.value)
                : setNewBusinessName(e.target.value)
            }
            placeholder="Category name"
            className="flex-1 h-10 rounded-xl border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd(activeTab);
              }
            }}
          />
          <button
            onClick={() => handleAdd(activeTab)}
            disabled={!newName.trim() || isAdding}
            className="h-10 rounded-xl bg-accent px-4 text-sm font-medium text-bg active:scale-95 transition-transform disabled:opacity-50"
          >
            {isAdding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
