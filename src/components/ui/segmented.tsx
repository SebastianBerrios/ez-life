"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SegmentedOption {
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
  count?: number
  disabled?: boolean
}

export interface SegmentedProps {
  value: string
  onValueChange: (value: string) => void
  options: SegmentedOption[]
  /** Accessible name of the tablist (required). */
  ariaLabel: string
  /** `md` keeps the 44px touch target; `sm` is the dense desktop variant. */
  size?: "sm" | "md"
  /** Mono uppercase labels (design: tabs of the quick-record sheet). */
  mono?: boolean
  /** Stretch the options to fill the container. */
  fullWidth?: boolean
  /** Enables `id` / `aria-controls` wiring with `SegmentedPanel`. */
  idPrefix?: string
  className?: string
}

/**
 * Segmented control / tabs with roving tabindex. Arrow keys, Home and End move focus and
 * select (automatic activation); disabled options are skipped.
 */
function Segmented({
  value,
  onValueChange,
  options,
  ariaLabel,
  size = "md",
  mono = false,
  fullWidth = false,
  idPrefix,
  className,
}: SegmentedProps) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({})

  const enabled = options.filter((option) => !option.disabled)

  const moveTo = (target: SegmentedOption | undefined) => {
    if (!target) return
    onValueChange(target.value)
    refs.current[target.value]?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent, current: SegmentedOption) => {
    const index = enabled.findIndex((option) => option.value === current.value)
    if (index === -1) return
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault()
        moveTo(enabled[(index + 1) % enabled.length])
        break
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault()
        moveTo(enabled[(index - 1 + enabled.length) % enabled.length])
        break
      case "Home":
        event.preventDefault()
        moveTo(enabled[0])
        break
      case "End":
        event.preventDefault()
        moveTo(enabled[enabled.length - 1])
        break
    }
  }

  const hasSelection = options.some((option) => option.value === value && !option.disabled)

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-slot="segmented"
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-background p-1",
        fullWidth && "flex w-full",
        className
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        // Roving tabindex: the selected tab, or the first enabled one when nothing matches.
        const focusable = hasSelection ? selected : option.value === enabled[0]?.value
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[option.value] = node
            }}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${option.value}` : undefined}
            aria-selected={selected}
            aria-controls={idPrefix ? `${idPrefix}-panel-${option.value}` : undefined}
            tabIndex={focusable ? 0 : -1}
            disabled={option.disabled}
            data-state={selected ? "active" : "inactive"}
            data-index={index}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, option)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent px-3 whitespace-nowrap transition-colors outline-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
              size === "sm" ? "h-9 min-h-9" : "h-11",
              mono
                ? "font-mono text-label-mono-sm uppercase"
                : "text-body-md font-medium",
              fullWidth ? "flex-1" : "shrink-0",
              selected
                ? "border-border-strong bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.icon}
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span className="font-mono text-label-mono-xs tabular-nums text-muted-foreground">
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export interface SegmentedPanelProps extends React.ComponentProps<"div"> {
  /** Same `idPrefix` given to `Segmented`. */
  idPrefix: string
  /** The option value this panel belongs to. */
  value: string
  /** The currently selected value; the panel renders only when it matches. */
  current: string
}

/** Optional tabpanel wired to `Segmented` through `idPrefix`. */
function SegmentedPanel({
  idPrefix,
  value,
  current,
  className,
  children,
  ...props
}: SegmentedPanelProps) {
  if (value !== current) return null
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      data-slot="segmented-panel"
      tabIndex={0}
      className={cn("outline-none focus-visible:shadow-focus", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Segmented, SegmentedPanel }
