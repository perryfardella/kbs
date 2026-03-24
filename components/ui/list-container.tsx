import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

const ListContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border",
      className
    )}
    {...props}
  />
))
ListContainer.displayName = "ListContainer"

interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

const ListItem = React.forwardRef<HTMLDivElement, ListItemProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div"
    return (
      <Comp
        ref={ref}
        className={cn(
          "flex items-center gap-3 px-4 py-3 active:bg-border transition-colors min-h-[44px]",
          className
        )}
        {...props}
      />
    )
  }
)
ListItem.displayName = "ListItem"

export { ListContainer, ListItem }
