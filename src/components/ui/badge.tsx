import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex min-h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-none border px-2 py-1 text-[10px] leading-none font-normal transition-[color,background-color,border-color] focus-visible:ring-2 focus-visible:ring-brand/25 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-signal-alert aria-invalid:ring-signal-alert/20 [&>svg]:pointer-events-none [&>svg]:size-3! cp-tactical-label tracking-[0.14em]",
  {
    variants: {
      variant: {
        default: "cp-tactical-cut border-brand/20 bg-brand/10 text-brand",
        secondary: "cp-tactical-cut border-line-soft/20 bg-surface-panel-strong text-text-low",
        destructive:
          "cp-tactical-cut border-signal-alert/20 bg-signal-alert/10 text-signal-alert focus-visible:ring-signal-alert/20",
        outline: "cp-tactical-cut border-line-soft/20 bg-transparent text-text-low",
        ghost: "cp-tactical-cut border-transparent bg-transparent text-text-low hover:text-brand",
        link: "h-auto border-transparent bg-transparent px-0 py-0 text-brand underline-offset-4 hover:text-brand-accent hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(
          badgeVariants({ variant }),
          variant === "link" ? "tracking-[0.16em]" : "rounded-none",
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
