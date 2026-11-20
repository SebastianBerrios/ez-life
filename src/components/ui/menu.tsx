"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "@/lib/utils"

/**
 * Action menu (kebab menus, row actions) on the Base UI menu already shipped with `@base-ui/react`:
 * the trigger carries `aria-haspopup="menu"` / `aria-expanded`, arrow keys move between items,
 * Escape closes and returns focus to the trigger, and the popup is portalled so table or list
 * overflow never clips it.
 */
function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  className,
  align = "end",
  side = "bottom",
  sideOffset = 4,
  children,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "side" | "sideOffset">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "min-w-40 origin-[var(--transform-origin)] rounded-3xl bg-popover p-1.5 text-popover-foreground shadow-dialog outline-none duration-100 motion-safe:data-[open]:animate-in motion-safe:data-[open]:fade-in-0 motion-safe:data-[open]:zoom-in-95 motion-safe:data-[closed]:animate-out motion-safe:data-[closed]:fade-out-0 motion-safe:data-[closed]:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & { variant?: "default" | "destructive" }) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        "flex min-h-11 w-full cursor-default items-center gap-2 rounded-xl px-3 text-body-md outline-none select-none data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        variant === "destructive" && "text-destructive data-[highlighted]:bg-destructive/10",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
}
