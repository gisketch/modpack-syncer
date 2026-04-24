import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative w-full">
      <InputPrimitive
        type={type}
        data-slot="input"
        className={cn(
          "peer/input h-9 w-full min-w-0 bg-transparent px-3 py-2 font-heading text-sm uppercase tracking-wide text-text-high outline-none transition-colors",
          "border-b-2 border-line-soft/40",
          "placeholder:text-text-low/40 placeholder:font-body placeholder:normal-case placeholder:tracking-normal",
          "focus-visible:border-brand-core",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-signal-alert",
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-text-high",
          className,
        )}
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-2 w-1 border-b-2 border-l-2 border-line-soft/40 peer-focus-visible/input:border-brand-core"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-2 w-1 border-b-2 border-r-2 border-line-soft/40 peer-focus-visible/input:border-brand-core"
      />
    </div>
  );
}

export { Input };
