"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center shrink-0 rounded-xl border text-sm font-medium transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap data-[state=on]:bg-accent data-[state=on]:text-bg data-[state=on]:border-accent",
  {
    variants: {
      variant: {
        default: "bg-surface text-text-muted border-border",
        outline: "bg-transparent text-text-muted border-border",
      },
      size: {
        default: "min-h-[44px] px-3.5 py-1.5",
        sm:      "h-8 px-3 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
