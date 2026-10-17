"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps
  extends Omit<React.ComponentProps<"button">, "onChange" | "role" | "type"> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/**
 * Accessible toggle. The button is the 44px hit area; the visible track is smaller.
 * Space/Enter toggle through the native button click.
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, className, disabled, onClick, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-slot="switch"
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onCheckedChange(!checked)
      }}
      className={cn(
        "group/switch inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-6 w-10 items-center rounded-full border transition-colors",
          checked
            ? "border-primary bg-primary"
            : "border-border-strong bg-surface-3"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 size-4 rounded-full transition-transform duration-150",
            checked
              ? "translate-x-4 bg-primary-foreground"
              : "translate-x-0 bg-muted-foreground"
          )}
        />
      </span>
    </button>
  )
})

export { Switch }
