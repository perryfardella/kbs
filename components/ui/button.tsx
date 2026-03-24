import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 rounded-2xl min-h-[44px]",
  {
    variants: {
      variant: {
        default:     "bg-accent text-bg",
        secondary:   "border border-border bg-surface text-text-primary",
        destructive: "border border-negative/30 bg-negative/10 text-negative",
        ghost:       "text-text-muted hover:bg-surface min-h-0",
        outline:     "border border-border bg-transparent text-text-primary",
        link:        "text-accent underline-offset-4 hover:underline p-0 h-auto min-h-0",
      },
      size: {
        default: "py-4 px-6 text-base w-full",
        sm:      "py-2.5 px-4 text-sm",
        xs:      "py-1 px-3 text-xs rounded-xl",
        icon:    "w-10 h-10 p-0 rounded-xl min-h-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
