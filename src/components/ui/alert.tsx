import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  cn(
    "group/alert relative grid w-full items-start gap-x-3 gap-y-0.5 overflow-hidden border p-4 pl-5 pr-4",
    "grid-cols-[auto_1fr_auto]",
    "scanlines-overlay",
    "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:content-['']",
    "[&>svg]:size-5 [&>svg]:translate-y-0.5 [&>svg]:col-start-1 [&>svg]:row-span-2",
    "font-body text-sm",
  ),
  {
    variants: {
      variant: {
        default:
          "bg-surface-panel-strong border-brand-core/40 text-text-high shadow-[0_0_24px_color-mix(in_srgb,var(--brand-core)_10%,transparent)] clip-diagonal-br before:bg-brand-core [&>svg]:text-brand-core",
        warning:
          "bg-surface-panel-strong border-signal-alert/35 text-text-high shadow-[0_0_24px_color-mix(in_srgb,var(--signal-alert)_10%,transparent)] clip-diagonal-br before:bg-signal-alert [&>svg]:text-signal-alert",
        destructive:
          "bg-surface-panel-strong border-signal-alert/60 text-text-high shadow-[0_0_28px_color-mix(in_srgb,var(--signal-alert)_18%,transparent)] clip-diagonal-btn-secondary before:bg-signal-alert before:animate-pulse [&>svg]:text-signal-alert",
        success:
          "bg-surface-panel-strong border-brand-core/50 text-text-high shadow-[0_0_24px_color-mix(in_srgb,var(--brand-core)_14%,transparent)] clip-diagonal-br before:bg-brand-core [&>svg]:text-brand-core",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant ?? "default"}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return (
    <h5
      data-slot="alert-title"
      className={cn(
        "col-start-2 row-start-1 font-heading text-sm font-bold uppercase tracking-tight text-text-high",
        "group-data-[variant=warning]/alert:text-signal-alert",
        "group-data-[variant=destructive]/alert:text-signal-alert",
        "group-data-[variant=success]/alert:text-brand-core",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 row-start-2 font-body text-xs leading-relaxed text-text-low",
        "[&_p]:leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("col-start-3 row-span-2 row-start-1 flex items-start gap-2", className)}
      {...props}
    />
  );
}

export { Alert, AlertAction, AlertDescription, AlertTitle };
