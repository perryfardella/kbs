"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  labelVariant?: "default" | "muted"
  error?: string
  className?: string
  children: React.ReactNode
}

function FormField({ label, labelVariant = "muted", error, className, children }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label variant={labelVariant}>{label}</Label>
      {children}
      {error && (
        <p className="text-xs text-negative">{error}</p>
      )}
    </div>
  )
}

export { FormField }
