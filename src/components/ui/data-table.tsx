import type * as React from "react";

import { cn } from "@/lib/utils";

function DataTable({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table"
      className={cn(
        "relative flex flex-col",
        "border border-line-soft/20 bg-surface-panel clip-diagonal-tab",
        "shadow-[0_0_24px_color-mix(in_srgb,var(--brand-core)_5%,transparent)]",
        "scanlines-overlay",
        className,
      )}
      {...props}
    />
  );
}

function DataTableHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-header"
      className={cn(
        "flex items-center justify-between gap-4 border-b border-line-soft/20",
        "bg-surface-panel-strong/50 px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

function DataTableTitle({
  className,
  moduleId,
  children,
  ...props
}: React.ComponentProps<"div"> & { moduleId?: string }) {
  return (
    <div
      data-slot="data-table-title"
      className={cn(
        "flex items-center gap-2 font-heading text-[10px] uppercase tracking-widest text-text-low",
        className,
      )}
      {...props}
    >
      {moduleId ? (
        <>
          <span className="text-brand-core">{moduleId}</span>
          <span className="text-line-soft">|</span>
        </>
      ) : null}
      <span>{children}</span>
    </div>
  );
}

function DataTableIndicator({
  className,
  level = 2,
  ...props
}: React.ComponentProps<"div"> & { level?: 1 | 2 | 3 }) {
  return (
    <div data-slot="data-table-indicator" className={cn("flex gap-1", className)} {...props}>
      <span className={cn("h-3 w-1", level >= 1 ? "bg-brand-core" : "bg-line-soft")} />
      <span className={cn("h-3 w-1", level >= 2 ? "bg-brand-core/50" : "bg-line-soft")} />
      <span className={cn("h-3 w-1", level >= 3 ? "bg-brand-core/30" : "bg-line-soft")} />
    </div>
  );
}

function DataTableFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-footer"
      className={cn(
        "flex items-center justify-between gap-4 border-t border-line-soft/20",
        "bg-surface-sunken px-4 py-3 font-heading text-xs uppercase tracking-widest text-text-low",
        className,
      )}
      {...props}
    />
  );
}

export { DataTable, DataTableFooter, DataTableHeader, DataTableIndicator, DataTableTitle };
