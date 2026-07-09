"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const propertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
  address: z.string().optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

interface PropertyFormProps {
  isOpen: boolean;
  onSuccess: () => void;
  // When editing, pass the existing property; omit to create a new one.
  propertyId?: Id<"properties">;
  initialName?: string;
  initialAddress?: string;
}

export function PropertyForm({
  isOpen,
  onSuccess,
  propertyId,
  initialName,
  initialAddress,
}: PropertyFormProps) {
  const [saving, setSaving] = useState(false);
  const createProperty = useMutation(api.properties.create);
  const updateProperty = useMutation(api.properties.update);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: initialName ?? "",
      address: initialAddress ?? "",
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    setSaving(false);
    form.reset({ name: initialName ?? "", address: initialAddress ?? "" });
    const timer = setTimeout(() => form.setFocus("name"), 300);
    return () => clearTimeout(timer);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(data: PropertyFormValues) {
    setSaving(true);
    try {
      if (propertyId) {
        await updateProperty({
          propertyId,
          name: data.name.trim(),
          address: data.address?.trim() || undefined,
        });
        toast.success("Property saved");
      } else {
        await createProperty({
          name: data.name.trim(),
          address: data.address?.trim() || undefined,
        });
        toast.success("Property added");
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSave)}>
        <div className="px-4 pt-2 space-y-3 pb-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel variant="muted">Name</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="e.g. 123 Main St, Unit 2"
                    className={fieldState.invalid ? "border-negative" : ""}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel variant="muted">Address (optional)</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Full address" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="sticky bottom-0 left-0 right-0 z-20 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-bg/95 backdrop-blur-sm border-t border-border mt-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : propertyId ? "Save Changes" : "Add Property"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
