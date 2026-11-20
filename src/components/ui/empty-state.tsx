import * as React from "react"
import { cn } from "@/lib/utils"
import { Panel } from "@/components/ui/panel"
import { Button } from "@/components/ui/button"

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  testId?: string
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  testId,
  className,
}: EmptyStateProps) {
  return (
    <Panel
      data-slot="empty-state"
      data-testid={testId}
      className={cn("items-center px-6 py-8 text-center", className)}
    >
      {icon !== undefined && (
        <div
          className="mb-3 flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="font-fredoka text-headline-md text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-body-md text-muted-foreground">
          {description}
        </p>
      )}
      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {actionLabel && onAction && (
            <Button type="button" onClick={onAction} className="min-h-11">
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              type="button"
              variant="outline"
              onClick={onSecondaryAction}
              className="min-h-11"
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </Panel>
  )
}
