import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-label-mono-sm whitespace-nowrap tabular-nums [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        positive: "border-primary/25 bg-primary/[0.12] text-success",
        negative: "border-expense/25 bg-expense/10 text-expense",
        neutral: "border-border bg-foreground/[0.04] text-muted-foreground",
        warning: "border-warning/25 bg-warning/10 text-warning",
        primary: "border-transparent bg-primary text-primary-foreground",
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
