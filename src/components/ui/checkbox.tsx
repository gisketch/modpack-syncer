import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center border transition-colors outline-none",
        "border-line-soft/60 bg-surface-panel-strong",
        "hover:border-brand-core",
        "focus-visible:ring-2 focus-visible:ring-brand-core/40",
        "data-checked:border-brand-core data-checked:bg-brand-core/15 data-checked:glow-brand",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-signal-alert",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex size-full items-center justify-center"
      >
        <span aria-hidden className="block size-2 bg-brand-core" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
