"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ListContainer, ListItem } from "@/components/ui/list-container";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ChevronLeft, Archive, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";

type Tab = "personal" | "business" | "rental";
type Kind = "expense" | "income";

type CategoryData = NonNullable<ReturnType<typeof useQuery<typeof api.categories.list>>>[number];

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("personal");
  const [addKind, setAddKind] = useState<Kind>("expense");
  const [addingPersonal, setAddingPersonal] = useState(false);
  const [addingBusiness, setAddingBusiness] = useState(false);
  const [addingRental, setAddingRental] = useState(false);
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

  const personalExpenseCategories =
    categories?.filter((c) => (c.realm === "personal" || c.realm === "both") && !c.isIncome) ?? [];
  const personalIncomeCategories =
    categories?.filter((c) => (c.realm === "personal" || c.realm === "both") && c.isIncome) ?? [];
  const businessExpenseCategories =
    categories?.filter((c) => (c.realm === "business" || c.realm === "both") && !c.isIncome) ?? [];
  const businessIncomeCategories =
    categories?.filter((c) => (c.realm === "business" || c.realm === "both") && c.isIncome) ?? [];
  const rentalCategories =
    categories?.filter((c) => c.realm === "rental") ?? [];

  async function handleAdd(tab: Tab, kind: Kind) {
    const { name } = form.getValues();
    const setAdding =
      tab === "personal"
        ? setAddingPersonal
        : tab === "business"
        ? setAddingBusiness
        : setAddingRental;
    setAdding(true);
    try {
      await createCategory({ name: name.trim(), realm: tab, isIncome: kind === "income" });
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
  const isAdding =
    activeTab === "personal"
      ? addingPersonal
      : activeTab === "business"
      ? addingBusiness
      : addingRental;

  function CategoryList({ cats, emptyLabel }: { cats: CategoryData[]; emptyLabel: string }) {
    if (isLoading) {
      return (
        <ListContainer>
          {Array.from({ length: 3 }).map((_, i) => (
            <ListItem key={i}>
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </ListItem>
          ))}
        </ListContainer>
      );
    }
    if (cats.length === 0) {
      return (
        <div className="rounded-2xl border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          {emptyLabel}
        </div>
      );
    }
    return (
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
    );
  }

  function TabPanel({
    tab,
    expenseCats,
    incomeCats,
  }: {
    tab: Tab;
    expenseCats: CategoryData[];
    incomeCats?: CategoryData[];
  }) {
    const showIncomeSplit = incomeCats !== undefined;
    return (
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          {showIncomeSplit && (
            <p className="px-1 text-xs font-semibold text-text-muted uppercase tracking-wide">
              Expenses
            </p>
          )}
          <CategoryList cats={expenseCats} emptyLabel={`No ${tab} expense categories. Add one below.`} />
        </div>

        {showIncomeSplit && (
          <div className="space-y-2">
            <p className="px-1 text-xs font-semibold text-text-muted uppercase tracking-wide">
              Income
            </p>
            <CategoryList cats={incomeCats!} emptyLabel={`No ${tab} income categories. Add one below.`} />
          </div>
        )}

        <Card className="p-4 space-y-3">
          <p className="text-sm font-semibold text-text-muted uppercase tracking-wide">
            Add {tab} category
          </p>
          {showIncomeSplit && (
            <div className="flex gap-2">
              <Toggle pressed={addKind === "expense"} onPressedChange={() => setAddKind("expense")}>
                Expense
              </Toggle>
              <Toggle pressed={addKind === "income"} onPressedChange={() => setAddKind("income")}>
                Income
              </Toggle>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Category name"
              className="flex-1 h-10 min-h-0 rounded-xl py-2 text-sm"
              {...form.register("name")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  form.handleSubmit(() => handleAdd(tab, showIncomeSplit ? addKind : "expense"))();
                }
              }}
            />
            <Button
              onClick={form.handleSubmit(() => handleAdd(tab, showIncomeSplit ? addKind : "expense"))}
              disabled={isAdding}
              size="sm"
              className="w-auto"
            >
              {isAdding ? "Adding…" : "Add"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Categories"
        left={
          <Button variant="secondary" size="icon" asChild className="-ml-2">
            <Link href="/settings">
              <ChevronLeft size={18} className="text-text-muted" />
            </Link>
          </Button>
        }
      />
      <div className="space-y-5 px-4 pt-4 pb-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as Tab);
            setAddKind("expense");
            form.reset();
          }}
          className="flex flex-col gap-4"
        >
          <TabsList className="w-full">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="rental">Rental</TabsTrigger>
          </TabsList>
          <TabsContent value="personal">
            <TabPanel tab="personal" expenseCats={personalExpenseCategories} incomeCats={personalIncomeCategories} />
          </TabsContent>
          <TabsContent value="business">
            <TabPanel tab="business" expenseCats={businessExpenseCategories} incomeCats={businessIncomeCategories} />
          </TabsContent>
          <TabsContent value="rental">
            <TabPanel tab="rental" expenseCats={rentalCategories} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
