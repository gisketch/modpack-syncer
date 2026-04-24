import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center border transition-colors outline-none clip-diagonal-sm scanlines-overlay-dark",
        "data-[size=default]:h-6 data-[size=default]:w-12 data-[size=sm]:h-5 data-[size=sm]:w-10",
        "bg-surface-panel-strong border-line-soft/40",
        "data-checked:bg-brand-core data-checked:border-brand-core data-checked:glow-brand",
        "focus-visible:ring-2 focus-visible:ring-brand-core/40",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none relative z-[2] block transition-transform clip-diagonal-sm",
          "group-data-[size=default]/switch:size-5 group-data-[size=sm]/switch:size-4",
          "bg-text-low group-data-checked/switch:bg-surface-sunken",
          "group-data-unchecked/switch:translate-x-0.5",
          "group-data-[size=default]/switch:group-data-checked/switch:translate-x-[26px]",
          "group-data-[size=sm]/switch:group-data-checked/switch:translate-x-[22px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
