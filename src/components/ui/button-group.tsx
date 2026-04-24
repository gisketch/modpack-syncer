import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonGroupContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  size: "sm" | "default";
};

const ButtonGroupContext = React.createContext<ButtonGroupContextValue | null>(null);

function useButtonGroup() {
  const ctx = React.useContext(ButtonGroupContext);
  if (!ctx) {
    throw new Error("ButtonGroupItem must be used within a ButtonGroup");
  }
  return ctx;
}

const buttonGroupVariants = cva(
  "inline-flex items-center justify-center p-1 gap-0.5 clip-diagonal-sm",
  {
    variants: {
      variant: {
        default: "bg-surface-panel-strong border border-line-soft/30",
        ghost: "bg-transparent",
      },
      size: {
        default: "h-9",
        sm: "h-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonGroupProps = Omit<React.ComponentPropsWithoutRef<"div">, "defaultValue" | "onChange"> &
  VariantProps<typeof buttonGroupVariants> & {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
  };

function ButtonGroup({
  className,
  variant,
  size,
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: ButtonGroupProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const currentValue = value ?? internalValue;
  const handleChange = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternalValue(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );

  const ctx = React.useMemo<ButtonGroupContextValue>(
    () => ({
      value: currentValue,
      onValueChange: handleChange,
      size: size ?? "default",
    }),
    [currentValue, handleChange, size],
  );

  return (
    <ButtonGroupContext.Provider value={ctx}>
      <div
        role="group"
        data-slot="button-group"
        data-variant={variant ?? "default"}
        data-size={size ?? "default"}
        className={cn(buttonGroupVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </div>
    </ButtonGroupContext.Provider>
  );
}

type ButtonGroupItemProps = React.ComponentPropsWithoutRef<"button"> & {
  value: string;
};

function ButtonGroupItem({ className, value, onClick, ...props }: ButtonGroupItemProps) {
  const { value: active, onValueChange } = useButtonGroup();
  const isActive = active === value;

  return (
    <button
      type="button"
      data-slot="button-group-item"
      data-active={isActive ? "" : undefined}
      aria-pressed={isActive}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onValueChange(value);
      }}
      className={cn(
        "relative inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap",
        "px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-widest",
        "text-text-low transition-colors outline-none",
        "hover:text-text-high",
        "focus-visible:ring-1 focus-visible:ring-brand-core/40",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-active:clip-diagonal-tab data-active:bg-brand-core data-active:text-surface-sunken data-active:glow-brand",
        "data-active:hover:text-surface-sunken",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export { ButtonGroup, ButtonGroupItem, buttonGroupVariants };
