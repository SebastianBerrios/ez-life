"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * One component, two layouts: a full-width bottom sheet on mobile that becomes a centered
 * panel from `md` up. Built on the Base UI dialog already wrapped in `dialog.tsx`
 * (focus trap, Escape, overlay click, aria-modal come from there).
 */
function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <Dialog data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogTrigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogClose data-slot="sheet-close" {...props} />
}

function SheetContent({
  className,
  children,
  footer,
  side = "bottom",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  /** Mobile placement. Only `bottom` exists today; the prop reserves the API. */
  side?: "bottom"
  showCloseButton?: boolean
  /** Optional sticky footer pinned to the bottom of the sheet within thumb reach. */
  footer?: React.ReactNode
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-card bg-popover text-sm text-popover-foreground shadow-dialog outline-none motion-safe:animate-sheet-in",
          "md:inset-auto md:top-1/2 md:left-1/2 md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:motion-safe:animate-sheet-fade-in md:rounded-card",
          className
        )}
        {...props}
      >
        <div
          data-slot="sheet-body"
          className={cn(
            "grid gap-4 overflow-y-auto overscroll-contain p-4",
            !footer && "pb-[calc(1rem+env(safe-area-inset-bottom))]"
          )}
        >
          {children}
        </div>
        {footer !== undefined && (
          <div
            data-slot="sheet-sticky-footer"
            className="shrink-0 border-t border-border/60 bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
          >
            {footer}
          </div>
        )}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 pr-10", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "sticky bottom-0 -mx-4 -mb-4 mt-2 flex flex-col-reverse gap-2 border-t border-border/60 bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogTitle
      data-slot="sheet-title"
      className={cn("text-headline-sm leading-6", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogDescription
      data-slot="sheet-description"
      className={cn("text-body-md", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
