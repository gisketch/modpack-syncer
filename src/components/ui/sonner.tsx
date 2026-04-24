import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/components/theme-provider";

import { cn } from "@/lib/utils";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-brand-core" />,
        info: <InfoIcon className="size-4 text-text-low" />,
        warning: <TriangleAlertIcon className="size-4 text-signal-alert" />,
        error: <OctagonXIcon className="size-4 text-signal-alert" />,
        loading: <Loader2Icon className="size-4 animate-spin text-text-low" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface-panel-strong)",
          "--normal-text": "var(--text-high)",
          "--normal-border": "color-mix(in srgb, var(--line-soft) 30%, transparent)",
          "--border-radius": "0px",
        } as React.CSSProperties
      }
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: cn(
            "group cp-toast relative flex items-start gap-3 border border-line-soft/30",
            "bg-surface-panel-strong text-text-high",
            "p-3 pr-8 rounded-none font-body text-xs",
            "border-l-4 border-l-line-soft/60 clip-diagonal-sm scanlines-overlay glow-toast-neutral",
          ),
          title: "font-heading text-xs font-bold uppercase tracking-widest text-text-high",
          description: "font-body text-[11px] text-text-low mt-0.5",
          icon: "mt-0.5",
          actionButton: cn(
            "text-[10px] font-heading font-bold uppercase tracking-widest",
            "text-brand-core hover:text-brand-accent underline underline-offset-2",
          ),
          cancelButton: cn(
            "text-[10px] font-heading uppercase tracking-widest",
            "text-text-low hover:text-text-high",
          ),
          closeButton: cn(
            "text-text-low hover:text-text-high rounded-none border-none",
            "absolute right-2 top-2 bg-transparent",
          ),
          success:
            "!bg-[color-mix(in_srgb,var(--brand-core)_8%,var(--surface-panel-strong))] !border-l-brand-core [&_[data-title]]:text-brand-core !glow-toast-brand",
          error:
            "!bg-[color-mix(in_srgb,var(--signal-alert)_8%,var(--surface-panel-strong))] !border-l-signal-alert [&_[data-title]]:text-signal-alert !glow-toast-alert",
          warning:
            "!bg-[color-mix(in_srgb,var(--signal-alert)_6%,var(--surface-panel-strong))] !border-l-signal-alert [&_[data-title]]:text-signal-alert !glow-toast-alert",
          info: "!border-l-text-low",
          loading: "!border-l-text-low",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
