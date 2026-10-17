import * as React from "react"
import { cn } from "@/lib/utils"

/** Dashboard panel: surface-1 + hairline, 8px radius, no shadow. */
const Panel = React.forwardRef<HTMLElement, React.ComponentProps<"section">>(
  function Panel({ className, ...props }, ref) {
    return (
      <section
        ref={ref}
        data-slot="panel"
        className={cn(
          "flex flex-col rounded-lg border border-border bg-card text-card-foreground",
          className
        )}
        {...props}
      />
    )
  }
)

export interface PanelHeaderProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  /** Mono uppercase micro-label above the title. */
  eyebrow?: React.ReactNode
  title?: React.ReactNode
  /** Heading level for `title` (default h3). */
  titleAs?: "h2" | "h3" | "h4"
  /** Right-aligned slot: buttons, badges, links. */
  action?: React.ReactNode
}

function PanelHeader({
  eyebrow,
  title,
  titleAs: Title = "h3",
  action,
  className,
  children,
  ...props
}: PanelHeaderProps) {
  return (
    <div
      data-slot="panel-header"
      className={cn("flex items-start justify-between gap-3 px-5 pt-5 pb-3", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        {eyebrow !== undefined && (
          <span className="font-mono text-label-mono-xs uppercase text-muted-foreground">
            {eyebrow}
          </span>
        )}
        {title !== undefined && (
          <Title className="text-headline-md text-foreground">{title}</Title>
        )}
        {children}
      </div>
      {action !== undefined && (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  )
}

function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="panel-body" className={cn("px-5 pb-5", className)} {...props} />
  )
}

export { Panel, PanelHeader, PanelBody }
