import type * as React from "react";

import { cn } from "@/lib/utils";

function TacticalGrid({
  className,
  fixed = false,
  strong = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  fixed?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      aria-hidden
      data-slot="tactical-grid"
      className={cn(
        "pointer-events-none inset-0",
        fixed ? "fixed z-0" : "absolute",
        strong ? "bg-tactical-grid-strong" : "bg-tactical-grid",
        className,
      )}
      {...props}
    />
  );
}

export { TacticalGrid };
