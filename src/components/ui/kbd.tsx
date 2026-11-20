import * as React from "react"
import { cn } from "@/lib/utils"

/** Hotkey chip, e.g. `<Kbd>⌘K</Kbd>`. */
const Kbd = React.forwardRef<HTMLElement, React.ComponentProps<"kbd">>(
  function Kbd({ className, ...props }, ref) {
    return (
      <kbd
        ref={ref}
        data-slot="kbd"
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-surface-2 px-2 py-0.5 text-label-xs text-muted-foreground",
          className
        )}
        {...props}
      />
    )
  }
)

export { Kbd }
