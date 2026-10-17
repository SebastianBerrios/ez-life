import * as React from "react"
import { cn } from "@/lib/utils"

export interface RingProgressProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /** 0-100; values outside the range (or NaN) are clamped. */
  value: number
  size?: number
  strokeWidth?: number
  /** Centered content (e.g. a percentage label). */
  children?: React.ReactNode
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/** SVG circular progress. The dash offset animates unless reduced motion is requested. */
const RingProgress = React.forwardRef<HTMLDivElement, RingProgressProps>(
  function RingProgress(
    { value, size = 64, strokeWidth = 6, className, children, style, ...props },
    ref
  ) {
    const percent = clampPercent(value)
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference * (1 - percent / 100)

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        data-slot="ring-progress"
        className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
        style={{ width: size, height: size, ...style }}
        {...props}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-foreground/10"
          />
          <circle
            data-slot="ring-progress-indicator"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
          />
        </svg>
        {children !== undefined && (
          <div className="absolute inset-0 flex items-center justify-center tabular-nums">
            {children}
          </div>
        )}
      </div>
    )
  }
)

export { RingProgress }
