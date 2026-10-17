import * as React from "react"
import { cn } from "@/lib/utils"
import { formatMoneyParts } from "@/core/use-cases/formatMoney"

export type MoneySign = "auto" | "always" | "never"
export type MoneySize = "lg" | "md" | "sm"
export type MoneyTone = "auto" | "income" | "expense" | "neutral"

export interface MoneyProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** Integer cents (PEN). */
  cents: number
  /** `auto`: minus only when negative. `always`: also plus for positives. `never`: absolute value. */
  sign?: MoneySign
  size?: MoneySize
  /** `auto` colors by sign (income green / expense rose); `neutral` (default) inherits the text color. */
  tone?: MoneyTone
}

const sizeClass: Record<MoneySize, string> = {
  lg: "text-metric-num-lg",
  md: "text-metric-num-md",
  sm: "text-body-md",
}

/**
 * Renders `S/` (muted, 75% size) + the amount with tabular numerals.
 * Uses a typographic minus (U+2212); `formatMoney` stays ASCII for plain-text contexts.
 */
const Money = React.forwardRef<HTMLSpanElement, MoneyProps>(function Money(
  { cents, sign = "auto", size = "md", tone = "neutral", className, ...props },
  ref
) {
  const parts = formatMoneyParts(cents)
  const isZero = parts.integer === "0" && parts.decimals === "00"
  const resolvedTone: Exclude<MoneyTone, "auto"> =
    tone === "auto" ? (isZero ? "neutral" : parts.negative ? "expense" : "income") : tone

  let prefix = ""
  if (sign !== "never" && !isZero) {
    if (parts.negative) prefix = "−"
    else if (sign === "always") prefix = "+"
  }

  return (
    <span
      ref={ref}
      data-slot="money"
      data-tone={resolvedTone}
      className={cn(
        "inline-flex items-baseline gap-[0.25em] tabular-nums",
        sizeClass[size],
        resolvedTone === "income" && "text-success",
        resolvedTone === "expense" && "text-expense",
        className
      )}
      {...props}
    >
      {prefix !== "" && <span data-slot="money-sign">{prefix}</span>}
      <span
        data-slot="money-symbol"
        className="text-[0.75em] font-normal text-muted-foreground"
      >
        {parts.symbol}
      </span>
      <span data-slot="money-amount">
        {parts.integer}.{parts.decimals}
      </span>
    </span>
  )
})

export { Money }
