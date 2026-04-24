import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "group/card relative flex flex-col overflow-hidden rounded-none border border-line-soft/15 bg-surface-panel text-sm text-text-high",
  {
    variants: {
      variant: {
        default: "cp-card-shell cp-card-brackets cp-card-interlace",
        window:
          "cp-card-shell cp-card-interlace cp-window-interlace cp-window-shell cp-tactical-glow bg-surface-panel",
      },
      size: {
        default: "min-h-0",
        sm: "min-h-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Card({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(
        cardVariants({ variant, size }),
        "data-[variant=default]:gap-4 data-[variant=default]:py-5 data-[variant=window]:gap-0 data-[variant=window]:py-0 data-[size=sm]:gap-3 data-[size=sm]:py-4",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-2 px-5 group-data-[size=sm]/card:px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-bold uppercase tracking-tight text-text-high group-data-[size=sm]/card:text-sm group-data-[variant=window]/card:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("font-sans text-sm text-text-low", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end group-data-[variant=window]/card:self-center",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        "px-5 group-data-[size=sm]/card:px-4 font-sans group-data-[variant=window]/card:px-4 group-data-[variant=window]/card:py-4",
        className,
      )}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center bg-surface-panel-strong/70 px-5 py-4 group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:py-3 group-data-[variant=window]/card:bg-surface-panel",
        className,
      )}
      {...props}
    />
  );
}

function CardWindowBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-window-bar"
      className={cn(
        "cp-card-window-bar flex items-center justify-between gap-4 px-3 py-2",
        className,
      )}
      {...props}
    />
  );
}

function CardWindowTab({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-window-tab" className={cn("cp-card-window-tab", className)} {...props} />
  );
}

function CardEyebrow({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-eyebrow" className={cn("cp-card-meta-chip", className)} {...props} />;
}

function CardStatus({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-status" className={cn("cp-card-status", className)} {...props} />;
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardStatus,
  CardTitle,
  CardWindowBar,
  CardWindowTab,
};
