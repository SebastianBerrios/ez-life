import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        positive: "bg-pill-savings text-pill-savings-foreground",
        negative: "bg-expense/15 text-expense",
        neutral: "bg-surface-2 text-muted-foreground",
        warning: "bg-warning/15 text-warning",
        primary: "bg-primary text-primary-foreground",
        needs: "bg-pill-needs text-pill-needs-foreground",
        wants: "bg-pill-wants text-pill-wants-foreground",
        savings: "bg-pill-savings text-pill-savings-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

export type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, ...props },
  ref
) {
  return (
    <span
      ref={ref}
      data-slot="badge"
      data-variant={variant ?? "neutral"}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
})

export { Badge, badgeVariants }
