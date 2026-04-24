import { PaperclipIcon, SendIcon, TerminalIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

type ChatInputProps = Omit<React.ComponentProps<"form">, "onSubmit" | "children"> & {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onAttach?: () => void;
  sendLabel?: string;
};

function ChatInput({
  className,
  value,
  defaultValue,
  placeholder = "INPUT_COMMAND_STRING...",
  disabled,
  onValueChange,
  onSubmit,
  onAttach,
  sendLabel = "EXECUTE",
  ...props
}: ChatInputProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const update = (next: string) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  const submit = () => {
    if (!current?.trim()) return;
    onSubmit?.(current);
    if (!isControlled) setInternal("");
  };

  return (
    <form
      data-slot="chat-input"
      className={cn(
        "flex w-full items-end gap-3 bg-surface-panel-strong/60 p-3",
        "border-t border-line-soft/20",
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      {...props}
    >
      <button
        type="button"
        onClick={onAttach}
        aria-label="Attach file"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center clip-diagonal-tab",
          "border border-line-soft/40 bg-surface-panel text-text-low",
          "transition-colors hover:border-brand-core/50 hover:text-brand-core",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand-core/60",
        )}
      >
        <PaperclipIcon className="size-4" />
      </button>

      <div
        className={cn(
          "relative flex flex-1 items-center gap-2 px-3",
          "border border-line-soft/30 bg-surface-panel clip-diagonal-tab",
          "focus-within:border-brand-core/60",
        )}
      >
        <TerminalIcon className="size-4 shrink-0 text-brand-core/60" />
        <textarea
          data-slot="chat-input-textarea"
          value={current}
          onChange={(e) => update(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "h-12 w-full resize-none bg-transparent py-3 font-body text-sm text-text-high",
            "placeholder:text-text-low/60 focus:outline-none disabled:opacity-50",
          )}
        />
      </div>

      <button
        type="submit"
        disabled={disabled || !current?.trim()}
        className={cn(
          "flex h-12 shrink-0 items-center gap-2 px-6 clip-diagonal-btn-secondary",
          "bg-brand-core text-text-on-brand",
          "font-heading text-xs font-bold uppercase tracking-widest",
          "shadow-[0_0_15px_color-mix(in_srgb,var(--brand-core)_25%,transparent)]",
          "transition-colors hover:bg-brand-accent",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <span>{sendLabel}</span>
        <SendIcon className="size-3.5" />
      </button>
    </form>
  );
}

export { ChatInput };
