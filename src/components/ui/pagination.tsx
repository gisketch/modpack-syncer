import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn(
        "flex items-center gap-4 font-heading text-xs uppercase tracking-widest",
        className,
      )}
      {...props}
    />
  );
}

function PaginationInfo({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="pagination-info" className={cn("text-text-low", className)} {...props} />;
}

function PaginationIndicator({
  className,
  page,
  total,
  ...props
}: React.ComponentProps<"div"> & { page: number | string; total: number | string }) {
  return (
    <div
      data-slot="pagination-indicator"
      className={cn(
        "border border-brand-core/30 bg-brand-core/10 px-2 py-1 text-brand-core",
        className,
      )}
      {...props}
    >
      PG_{String(page).padStart(2, "0")}
      <span className="mx-1 text-brand-core/60">//</span>
      {total}
    </div>
  );
}

function PaginationControls({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="pagination-controls"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}

type PaginationButtonProps = React.ComponentProps<"button"> & {
  active?: boolean;
};

function PaginationButton({
  className,
  active,
  children,
  type = "button",
  ...props
}: PaginationButtonProps) {
  return (
    <button
      type={type}
      data-slot="pagination-button"
      data-active={active || undefined}
      className={cn(
        "inline-flex size-8 items-center justify-center",
        "clip-diagonal-sm border transition-colors",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand-core/60",
        "disabled:pointer-events-none disabled:opacity-40",
        active
          ? "border-brand-core bg-brand-core text-text-on-brand hover:bg-brand-accent"
          : "border-line-soft bg-surface-panel-strong text-text-low hover:border-brand-core hover:text-brand-core",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function PaginationPrevious({ className, ...props }: PaginationButtonProps) {
  return (
    <PaginationButton aria-label="Go to previous page" className={className} {...props}>
      <ChevronLeftIcon className="size-4" />
    </PaginationButton>
  );
}

function PaginationNext({ className, ...props }: PaginationButtonProps) {
  return (
    <PaginationButton aria-label="Go to next page" className={className} {...props}>
      <ChevronRightIcon className="size-4" />
    </PaginationButton>
  );
}

export {
  Pagination,
  PaginationButton,
  PaginationControls,
  PaginationIndicator,
  PaginationInfo,
  PaginationNext,
  PaginationPrevious,
};
