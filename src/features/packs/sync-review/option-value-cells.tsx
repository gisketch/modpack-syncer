import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function OptionsPreviewKey({ optionKey }: { optionKey: string }) {
  const display = formatOptionKeyDisplay(optionKey);
  return (
    <TooltipProvider delay={0}>
      <TooltipLabel
        primary={display.primary}
        secondary={display.secondary}
        className="text-[11px] leading-4 text-text-high"
        tooltipClassName="font-mono text-brand-core shadow-none"
      />
    </TooltipProvider>
  );
}

export function OptionsPreviewValue({
  optionKey,
  value,
}: {
  optionKey: string;
  value: string | null;
}) {
  const display = formatOptionValueDisplay(optionKey, value);
  const keybind = isKeybindOptionKey(optionKey);
  return (
    <TooltipProvider delay={0}>
      <TooltipLabel
        primary={display.primary}
        secondary={display.secondary}
        className={cn(
          "w-fit max-w-full truncate text-[11px] leading-4",
          keybind
            ? "border border-line-soft/30 bg-surface-sunken/70 px-1.5 py-0.5 font-semibold tracking-[0.08em] text-text-high"
            : "font-mono text-text-low",
        )}
        tooltipClassName="font-mono text-brand-core shadow-none"
      />
    </TooltipProvider>
  );
}

function TooltipLabel({
  primary,
  secondary,
  className,
  tooltipClassName,
}: {
  primary: string;
  secondary: string | null;
  className?: string;
  tooltipClassName?: string;
}) {
  if (!secondary) {
    return (
      <span className={className} title={primary}>
        {primary}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<span className={className} title={secondary} />}>
        {primary}
      </TooltipTrigger>
      <TooltipContent className={tooltipClassName}>{secondary}</TooltipContent>
    </Tooltip>
  );
}

function formatOptionKeyDisplay(optionKey: string) {
  if (!isKeybindOptionKey(optionKey)) {
    return {
      primary: humanizeOptionToken(optionKey),
      secondary: /[A-Z_.]/.test(optionKey) ? optionKey : null,
    };
  }

  let raw = optionKey.slice(4);
  if (raw.startsWith("key.")) {
    raw = raw.slice(4);
  }
  const parts = raw
    .split(".")
    .filter(Boolean)
    .filter((part) => part !== "keybind");
  return {
    primary: parts.map(humanizeOptionToken).join(" "),
    secondary: optionKey,
  };
}

function formatOptionValueDisplay(optionKey: string, value: string | null) {
  if (!value) {
    return { primary: "--", secondary: null };
  }
  if (!isKeybindOptionKey(optionKey)) {
    return { primary: value, secondary: null };
  }

  const primary = humanizeKeybindValue(value);
  return {
    primary,
    secondary: primary === value ? null : value,
  };
}

function isKeybindOptionKey(optionKey: string) {
  return optionKey.startsWith("key_");
}

function humanizeKeybindValue(value: string) {
  if (value === "key.keyboard.unknown") {
    return "UNBOUND";
  }
  if (value.startsWith("key.keyboard.")) {
    return humanizeOptionToken(value.slice("key.keyboard.".length));
  }
  if (value.startsWith("key.mouse.")) {
    return `Mouse ${humanizeOptionToken(value.slice("key.mouse.".length))}`;
  }
  if (value.startsWith("scancode.")) {
    return `Scancode ${value.slice("scancode.".length)}`;
  }
  return humanizeOptionToken(value);
}

function humanizeOptionToken(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\./g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (/^f\d+$/i.test(part) || /^\d+$/.test(part)) {
        return part.toUpperCase();
      }
      if (part.length <= 2 && part === part.toLowerCase()) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}
