import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-[--color-muted] bg-transparent px-3 py-1 text-sm shadow-sm placeholder:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
