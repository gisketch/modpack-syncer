import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full resize-y bg-surface-panel border border-line-soft/30 clip-diagonal-br",
        "px-3 py-2 font-body text-sm text-text-high outline-none transition-colors",
        "placeholder:text-text-low/50",
        "hover:border-brand-core/50",
        "focus-visible:border-brand-core focus-visible:ring-1 focus-visible:ring-brand-core/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-signal-alert aria-invalid:focus-visible:ring-signal-alert/30",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
