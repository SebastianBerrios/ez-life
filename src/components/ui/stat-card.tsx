import * as React from "react"
import { cn } from "@/lib/utils"

export type StatTone = "default" | "positive" | "negative" | "warning"

const toneClass: Record<StatTone, string> = {
  default: "text-foreground",
  positive: "text-success",
  negative: "text-expense",
  warning: "text-warning",
}

export interface StatCardProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode
  /** Usually a `<Money>` or a plain number string. */
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  /** Colors the value only; the label and hint stay muted. */
  tone?: StatTone
}

/** KPI tile: muted label, big tabular Fredoka value, optional hint and icon. */
const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(function StatCard(
  { label, value, hint, icon, tone = "default", className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-slot="stat-card"
      data-tone={tone}
      className={cn(
        "flex flex-col gap-2 rounded-card bg-card p-5 text-card-foreground shadow-card",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-label-xs text-muted-foreground">
          {label}
        </span>
        {icon !== undefined && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-foreground [&_svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      <div className={cn("font-fredoka text-metric-num-md tabular-nums", toneClass[tone])}>{value}</div>
      {hint !== undefined && (
        <div className="text-body-sm text-muted-foreground">{hint}</div>
      )}
    </div>
  )
})

export { StatCard }
