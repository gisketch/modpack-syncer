import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import * as React from "react";

import { cn } from "@/lib/utils";

type SliderVariant = "default" | "alert";

const SliderVariantContext = React.createContext<SliderVariant>("default");

const variantFill: Record<SliderVariant, string> = {
  default: "bg-brand-core",
  alert: "bg-signal-alert",
};

const variantText: Record<SliderVariant, string> = {
  default: "text-brand-core",
  alert: "text-signal-alert",
};

function Slider({
  className,
  variant = "default",
  ...props
}: SliderPrimitive.Root.Props<number | readonly number[]> & {
  variant?: SliderVariant;
}) {
  return (
    <SliderVariantContext.Provider value={variant}>
      <SliderPrimitive.Root
        data-slot="slider"
        data-variant={variant}
        className={cn("relative flex w-full flex-col select-none", className)}
        {...props}
      />
    </SliderVariantContext.Provider>
  );
}

function SliderLabel({ className, ...props }: SliderPrimitive.Label.Props) {
  return (
    <SliderPrimitive.Label
      data-slot="slider-label"
      className={cn("font-heading text-xs uppercase tracking-widest text-text-high", className)}
      {...props}
    />
  );
}

function SliderValue({ className, ...props }: SliderPrimitive.Value.Props) {
  const variant = React.useContext(SliderVariantContext);
  return (
    <SliderPrimitive.Value
      data-slot="slider-value"
      className={cn(
        "font-heading text-xs font-bold uppercase tracking-widest tabular-nums",
        variantText[variant],
        className,
      )}
      {...props}
    />
  );
}

function SliderControl({ className, ...props }: SliderPrimitive.Control.Props) {
  return (
    <SliderPrimitive.Control
      data-slot="slider-control"
      className={cn("relative flex h-4 w-full items-center touch-none", className)}
      {...props}
    />
  );
}

function SliderTrack({ className, children, ...props }: SliderPrimitive.Track.Props) {
  return (
    <SliderPrimitive.Track
      data-slot="slider-track"
      className={cn(
        "relative h-4 w-full overflow-hidden bg-surface-sunken border border-line-soft/30",
        "[background-image:repeating-linear-gradient(135deg,transparent_0,transparent_4px,rgba(0,0,0,0.25)_4px,rgba(0,0,0,0.25)_5px)]",
        className,
      )}
      {...props}
    >
      {children}
    </SliderPrimitive.Track>
  );
}

function SliderIndicator({ className, ...props }: SliderPrimitive.Indicator.Props) {
  const variant = React.useContext(SliderVariantContext);
  return (
    <SliderPrimitive.Indicator
      data-slot="slider-indicator"
      className={cn(
        "absolute top-0 left-0 h-full border-r-2 border-text-high",
        "flex items-center justify-end pr-1",
        variantFill[variant],
        className,
      )}
      {...props}
    >
      <span aria-hidden className="block h-2 w-[2px] bg-surface-sunken" />
    </SliderPrimitive.Indicator>
  );
}

function SliderThumb({ className, ...props }: SliderPrimitive.Thumb.Props) {
  return (
    <SliderPrimitive.Thumb
      data-slot="slider-thumb"
      className={cn(
        "absolute top-0 h-full w-4 -translate-x-1/2 cursor-grab outline-none",
        "focus-visible:ring-2 focus-visible:ring-brand-core/50",
        "data-dragging:cursor-grabbing",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderLabel,
  SliderThumb,
  SliderTrack,
  SliderValue,
};
