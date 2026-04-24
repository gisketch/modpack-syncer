import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-9 w-full border border-[--line-soft] bg-[--surface-sunken] px-3 py-1 text-sm text-[--text-high] font-mono placeholder:text-[--text-low] placeholder:opacity-60 focus-visible:outline-none focus-visible:border-[--brand-core] focus-visible:shadow-[0_0_0_1px_var(--brand-core)] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
