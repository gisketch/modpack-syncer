import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const sidebarItemVariants = cva(
  "cp-sidebar-item group/sidebar-item relative flex w-full items-center gap-3 overflow-hidden rounded-none border border-transparent text-left no-underline outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-brand/25 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      active: {
        true: "",
        false: "",
      },
      size: {
        default: "px-4 py-3 text-xs",
        sm: "px-2 py-2 text-[10px]",
        child: "px-4 py-2 text-[10px]",
      },
    },
    defaultVariants: {
      active: false,
      size: "default",
    },
  },
);

function Sidebar({ className, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        "cp-sidebar-shell flex w-64 max-w-full flex-col overflow-hidden rounded-none border-r border-line-soft/15 bg-surface-panel py-4 text-text-high",
        className,
      )}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("mb-4 border-b border-line-soft/15 px-6 pb-6", className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sidebar-content"
      className={cn("flex flex-1 flex-col gap-1 px-2", className)}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sidebar-group" className={cn("flex flex-col gap-1", className)} {...props} />
  );
}

function SidebarItem({
  className,
  active = false,
  size = "default",
  ...props
}: React.ComponentProps<"a"> & VariantProps<typeof sidebarItemVariants>) {
  return (
    <a
      data-slot="sidebar-item"
      data-active={active ? "true" : "false"}
      className={cn(sidebarItemVariants({ active, size }), className)}
      {...props}
    />
  );
}

function SidebarItemIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="sidebar-item-icon"
      className={cn("flex size-5 items-center justify-center text-current", className)}
      {...props}
    />
  );
}

function SidebarItemIndicator({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="sidebar-item-indicator"
      className={cn("cp-sidebar-indicator ml-auto", className)}
      {...props}
    />
  );
}

function SidebarSubmenu({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sidebar-submenu" className={cn("cp-sidebar-submenu", className)} {...props} />
  );
}

function SidebarSubItem({
  className,
  active = false,
  ...props
}: React.ComponentProps<"a"> & { active?: boolean }) {
  return (
    <SidebarItem
      data-slot="sidebar-sub-item"
      active={active}
      size="child"
      className={cn("min-h-0", className)}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("mt-auto flex flex-col gap-4 px-4 pt-4", className)}
      {...props}
    />
  );
}

function SidebarAction({ className, type = "button", ...props }: React.ComponentProps<"button">) {
  return (
    <button
      data-slot="sidebar-action"
      type={type}
      className={cn(
        "cp-sidebar-action cp-flicker-hover flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-bold",
        className,
      )}
      {...props}
    />
  );
}

export {
  Sidebar,
  SidebarAction,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarItem,
  SidebarItemIcon,
  SidebarItemIndicator,
  SidebarSubItem,
  SidebarSubmenu,
};
