"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CollapsibleSectionProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  badge?: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  variant?: "panel" | "inline"
  testId?: string
  className?: string
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  subtitle,
  icon,
  badge,
  open,
  defaultOpen = false,
  onOpenChange,
  variant = "panel",
  testId,
  className,
  children,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const contentId = React.useId()

  const handleToggle = () => {
    const next = !isOpen
    if (!isControlled) {
      setInternalOpen(next)
    }
    onOpenChange?.(next)
  }

  return (
    <section
      data-slot="collapsible-section"
      data-variant={variant}
      data-testid={testId}
      className={cn(
        variant === "panel"
          ? "rounded-card bg-card text-card-foreground shadow-card"
          : "rounded-2xl bg-surface-2/60 text-foreground",
        className
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={handleToggle}
        className={cn(
          "flex w-full min-h-11 items-center justify-between gap-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
          variant === "panel"
            ? "rounded-card px-5 py-4 hover:bg-surface-2/50"
            : "rounded-2xl px-4 py-3 hover:bg-surface-2"
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          {icon !== undefined && (
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span
              className={cn(
                "truncate",
                variant === "panel"
                  ? "font-fredoka text-headline-sm text-foreground"
                  : "text-sm font-medium text-foreground"
              )}
            >
              {title}
            </span>
            {subtitle !== undefined && (
              <span className="truncate text-xs text-muted-foreground">
                {subtitle}
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge !== undefined && (
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-foreground">
              {badge}
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </span>
      </button>
      {isOpen && (
        <div
          id={contentId}
          data-slot="collapsible-content"
          className={cn(
            variant === "panel" ? "px-5 pt-1 pb-5" : "px-4 pt-1 pb-4"
          )}
        >
          {children}
        </div>
      )}
    </section>
  )
}
