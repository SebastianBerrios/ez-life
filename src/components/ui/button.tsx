import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:shadow-focus motion-safe:active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:shadow-focus-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
        outline:
          "border-border bg-card text-foreground hover:bg-surface-2 aria-expanded:bg-surface-2 aria-expanded:text-foreground",
        secondary:
          "bg-surface-2 text-secondary-foreground hover:bg-surface-3 aria-expanded:bg-surface-3 aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-surface-2 hover:text-foreground aria-expanded:bg-surface-2 aria-expanded:text-foreground",
        destructive:
          "bg-destructive/15 text-destructive hover:bg-destructive/25 focus-visible:border-destructive focus-visible:shadow-focus-destructive",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 min-h-11 gap-1.5 px-5 has-[[data-icon=inline-end]]:pr-4 has-[[data-icon=inline-start]]:pl-4",
        xs: "h-8 gap-1 rounded-full px-3 text-xs has-[[data-icon=inline-end]]:pr-2.5 has-[[data-icon=inline-start]]:pl-2.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 min-h-11 gap-1.5 rounded-full px-4 text-sm has-[[data-icon=inline-end]]:pr-3 has-[[data-icon=inline-start]]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 min-h-12 gap-2 px-6 has-[[data-icon=inline-end]]:pr-5 has-[[data-icon=inline-start]]:pl-5",
        icon: "size-11 min-h-11 min-w-11",
        "icon-xs":
          "size-8 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-11 min-h-11 min-w-11 rounded-full",
        "icon-lg": "size-12 min-h-12 min-w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// forwardRef: Base UI passes a ref when a Button is used through a `render` prop (Dialog/Sheet close
// buttons); React 18 function components cannot receive refs otherwise.
const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants>
>(function Button({ className, variant = "default", size = "default", ...props }, ref) {
  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})

export { Button, buttonVariants }
