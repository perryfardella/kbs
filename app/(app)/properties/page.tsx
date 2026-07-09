"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ListContainer, ListItem } from "@/components/ui/list-container";
import { PageHeader } from "@/components/PageHeader";
import { AddPropertyDrawer } from "@/components/AddPropertyDrawer";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";

function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
}

const now = new Date();
const year = now.getFullYear();
const startOfYear = `${year}-01-01`;
const endOfYear = `${year}-12-31`;

function PropertyRow({ property }: { property: { _id: Id<"properties">; name: string; address?: string } }) {
  const summary = useQuery(api.properties.getPropertySummary, {
    propertyId: property._id,
    startDate: startOfYear,
    endDate: endOfYear,
  });
  const net = summary?.net ?? 0;
  const positive = net >= 0;

  return (
    <ListItem asChild>
      <Link href={`/properties/${property._id}`}>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm text-text-primary">{property.name}</p>
          {property.address && (
            <p className="truncate text-xs text-text-muted">{property.address}</p>
          )}
        </div>
        {summary === undefined ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <span className={`shrink-0 font-mono text-sm ${positive ? "text-positive" : "text-negative"}`}>
            {positive ? "+" : "-"}
            {formatCAD(net)}
          </span>
        )}
        <ChevronRight size={16} className="shrink-0 text-text-muted" />
      </Link>
    </ListItem>
  );
}

function PropertiesPageInner() {
  const properties = useQuery(api.properties.list);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Properties"
        right={
          <Button variant="secondary" size="icon" asChild className="-mr-2">
            <Link href="/properties?add=true" aria-label="Add property">
              <Plus size={18} className="text-text-primary" />
            </Link>
          </Button>
        }
      />
      <div className="space-y-5 px-4 pt-4 pb-6">
        <p className="px-1 text-xs text-text-muted">
          Net rental cash flow · {year}
        </p>
        {properties === undefined ? (
          <ListContainer>
            {Array.from({ length: 3 }).map((_, i) => (
              <ListItem key={i}>
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </ListItem>
            ))}
          </ListContainer>
        ) : properties.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-4 py-10 text-center space-y-3">
            <p className="text-sm text-text-muted">
              No properties yet. Add one to track rental income and expenses.
            </p>
            <Button asChild size="sm" className="w-auto mx-auto">
              <Link href="/properties?add=true">Add Property</Link>
            </Button>
          </div>
        ) : (
          <ListContainer>
            {properties.map((property) => (
              <PropertyRow key={property._id} property={property} />
            ))}
          </ListContainer>
        )}
      </div>

      <AddPropertyDrawer />
    </div>
  );
}

export default function PropertiesPage() {
  return (
    <Suspense>
      <PropertiesPageInner />
    </Suspense>
  );
}
