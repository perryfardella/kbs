import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border-transparent px-2 py-0.5 text-[10px] font-medium",
  {
    variants: {
      variant: {
        default:  "bg-surface text-text-muted",
        personal: "bg-[#60a5fa]/20 text-[#60a5fa]",
        business: "bg-[#a78bfa]/20 text-[#a78bfa]",
        transfer: "bg-[#fb923c]/20 text-[#fb923c]",
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
