import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap border bg-clip-padding text-[0.72rem] leading-none font-bold outline-none select-none transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-brand/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-signal-alert aria-invalid:ring-2 aria-invalid:ring-signal-alert/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cp-tactical-label",
  {
    variants: {
      variant: {
        default:
          "cp-tactical-cut cp-tactical-glow cp-tactical-primary-fill cp-tactical-scanlines cp-flicker-hover border-brand-accent/35 bg-brand text-text-on-brand hover:border-brand-accent/55",
        outline:
          "cp-tactical-cut border-line-soft/30 bg-surface-panel text-text-high hover:border-brand/40 hover:text-brand",
        secondary:
          "cp-tactical-cut border-line-soft/30 bg-surface-panel-strong text-brand-muted hover:border-brand/40 hover:text-brand",
        ghost:
          "cp-tactical-cut border-line-soft/30 bg-transparent text-text-low hover:border-brand/50 hover:text-brand",
        destructive:
          "cp-tactical-cut border-signal-alert/30 bg-transparent text-signal-alert hover:border-signal-alert/45 hover:bg-signal-alert/10",
        link: "h-auto border-transparent bg-transparent px-0 py-0 text-brand underline-offset-4 hover:text-brand-accent hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-6 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        xs: "h-8 gap-1.5 px-3 text-[0.65rem] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3.5 text-[0.68rem] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-6 text-[0.78rem] has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10 px-0",
        "icon-xs": "size-8 px-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 px-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const isLink = variant === "link";

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size }),
        isLink && "rounded-none tracking-[0.16em]",
        !isLink && "rounded-none",
        className,
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };
