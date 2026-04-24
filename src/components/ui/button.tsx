import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 text-xs cp-tactical-label transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--brand-core] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "clip-diagonal-btn bg-[--brand-core] text-[--text-on-brand] hover:bg-[--brand-accent] hover:shadow-[0_0_16px_color-mix(in_srgb,var(--brand-core)_40%,transparent)] active:brightness-90",
        secondary:
          "clip-diagonal-btn-secondary border border-[--line-strong] bg-[--surface-elevated] text-[--text-high] hover:border-[--brand-core] hover:text-[--brand-core]",
        ghost: "text-[--text-low] hover:bg-[--surface-elevated] hover:text-[--brand-core]",
        outline:
          "clip-diagonal-btn border border-[--line-strong] bg-transparent text-[--text-high] hover:border-[--brand-core] hover:text-[--brand-core]",
        danger:
          "clip-diagonal-btn border border-[--signal-alert] bg-transparent text-[--signal-alert] hover:bg-[--signal-alert] hover:text-[--surface-base]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
