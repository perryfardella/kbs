import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border-transparent px-2 py-0.5 text-[10px] font-medium",
  {
    variants: {
      variant: {
        default:  "bg-surface text-text-muted",
        personal: "bg-[#1d4ed8]/15 text-[#1d4ed8]",
        business: "bg-[#6d28d9]/15 text-[#6d28d9]",
        transfer: "bg-[#9a3412]/15 text-[#9a3412]",
        rental:   "bg-[#065f46]/15 text-[#065f46]",
        accent:   "bg-accent/10 text-accent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
