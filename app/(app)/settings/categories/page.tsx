"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ListContainer, ListItem } from "@/components/ui/list-container";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ChevronLeft, Archive, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type Tab = "personal" | "business";

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("personal");
  const [addingPersonal, setAddingPersonal] = useState(false);
  const [addingBusiness, setAddingBusiness] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<Id<"categories"> | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<Id<"categories"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"categories"> | null>(null);

  const categories = useQuery(api.categories.list);
  const createCategory = useMutation(api.categories.create);
  const archiveCategory = useMutation(api.categories.archive);
  const deleteCategory = useMutation(api.categories.deleteCategory);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "" },
  });

  const personalCategories =
    categories?.filter((c) => c.realm === "personal" || c.realm === "both") ?? [];
  const businessCategories =
    categories?.filter((c) => c.realm === "business" || c.realm === "both") ?? [];

  async function handleAdd(tab: Tab) {
    const { name } = form.getValues();
    const setAdding = tab === "personal" ? setAddingPersonal : setAddingBusiness;
    setAdding(true);
    try {
      await createCategory({ name: name.trim(), realm: tab });
      form.reset();
    } finally {
      setAdding(false);
    }
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
  const isAdding = activeTab === "personal" ? addingPersonal : addingBusiness;

  function CategoryList({ cats }: { cats: typeof personalCategories }) {
    return (
      <>
        {isLoading ? (
          <ListContainer>
            {Array.from({ length: 5 }).map((_, i) => (
              <ListItem key={i}>
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </ListItem>
            ))}
          </ListContainer>
        ) : cats.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
            No {activeTab} categories. Add one below.
          </div>
        ) : (
          <ListContainer>
            {cats.map((cat) => (
              <ListItem key={cat._id} className="gap-2">
                <span className="flex-1 text-sm text-text-primary truncate">
                  {cat.name}
                </span>
                {cat.isDefault && (
                  <Badge variant="accent">Default</Badge>
                )}

                {confirmArchiveId === cat._id ? (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="secondary" size="xs" onClick={() => setConfirmArchiveId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      className="border border-badge-transfer/30 bg-badge-transfer/20 text-badge-transfer rounded-xl"
                      onClick={() => confirmArchive(cat._id)}
                    >
                      Archive
                    </Button>
                  </div>
                ) : !cat.isDefault && confirmDeleteId === cat._id ? (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="secondary" size="xs" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="xs"
                      disabled={deletingId === cat._id}
                      onClick={() => handleDelete(cat._id)}
                    >
                      Delete
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmArchiveId(cat._id)}
                      title="Archive — hides from pickers"
                      className="h-8 w-8 hover:text-badge-transfer"
                    >
                      <Archive size={15} />
                    </Button>
                    {!cat.isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDeleteId(cat._id)}
                        title="Delete permanently"
                        className="h-8 w-8 hover:text-negative"
                      >
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                )}
              </ListItem>
            ))}
          </ListContainer>
        )}

        <Card className="p-4 space-y-3">
          <p className="text-sm font-semibold text-text-muted uppercase tracking-wide">
            Add {activeTab} category
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Category name"
              className="flex-1 h-10 min-h-0 rounded-xl py-2 text-sm"
              {...form.register("name")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  form.handleSubmit(() => handleAdd(activeTab))();
                }
              }}
            />
            <Button
              onClick={form.handleSubmit(() => handleAdd(activeTab))}
              disabled={isAdding}
              size="sm"
              className="w-auto"
            >
              {isAdding ? "Adding…" : "Add"}
            </Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="icon" asChild>
          <Link href="/settings">
            <ChevronLeft size={18} className="text-text-muted" />
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Categories
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as Tab); form.reset(); }} className="flex flex-col gap-4">
        <TabsList className="w-full">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
        </TabsList>
        <TabsContent value="personal" className="flex flex-col gap-4">
          <CategoryList cats={personalCategories} />
        </TabsContent>
        <TabsContent value="business" className="flex flex-col gap-4">
          <CategoryList cats={businessCategories} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
