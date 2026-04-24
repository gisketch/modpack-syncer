import type * as React from "react";
import { Card, CardContent, CardWindowBar, CardWindowTab } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ToolCallStatus = "live" | "done" | "error";

const statusClass: Record<ToolCallStatus, string> = {
  live: "border-signal-alert/40 bg-signal-alert/10 text-signal-alert animate-pulse",
  done: "border-brand-core/40 bg-brand-core/10 text-brand-core",
  error: "border-signal-alert/60 bg-signal-alert/15 text-signal-alert",
};

function ToolCallCard({
  className,
  title,
  status = "live",
  icon,
  children,
  ...props
}: React.ComponentProps<typeof Card> & {
  title: string;
  status?: ToolCallStatus;
  icon?: React.ReactNode;
}) {
  return (
    <Card
      variant="window"
      data-slot="tool-call-card"
      data-status={status}
      className={cn(
        "w-full",
        "shadow-[0_0_20px_color-mix(in_srgb,var(--brand-core)_6%,transparent)]",
        className,
      )}
      {...props}
    >
      <CardWindowBar>
        <CardWindowTab className="flex items-center gap-2">
          {icon}
          <span>TOOL_CALL: {title}</span>
        </CardWindowTab>
        <span
          className={cn(
            "border px-2 py-0.5 font-heading text-[10px] uppercase tracking-widest",
            statusClass[status],
          )}
        >
          {status === "live" ? "● LIVE" : status === "done" ? "DONE" : "ERR"}
        </span>
      </CardWindowBar>
      <CardContent className="space-y-3 py-4">{children}</CardContent>
    </Card>
  );
}

export { ToolCallCard };
