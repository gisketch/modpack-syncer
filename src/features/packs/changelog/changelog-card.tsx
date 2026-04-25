import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardWindowBar, CardWindowTab } from "@/components/ui/card";
import type { PackChangelogEntry, PackChangelogItem } from "@/lib/tauri";
import { cn } from "@/lib/utils";

type ChangelogCardProps = {
  entry: PackChangelogEntry;
  expanded: boolean;
  highlighted: boolean;
  onToggle?: () => void;
  collapsible?: boolean;
  className?: string;
};

export function ChangelogCard({
  entry,
  expanded,
  highlighted,
  onToggle,
  collapsible = true,
  className,
}: ChangelogCardProps) {
  return (
    <Card
      variant="window"
      highlighted={highlighted}
      size="sm"
      className={cn("h-full", highlighted && "bg-surface-panel-strong/80", className)}
    >
      <CardWindowBar className="px-0 py-0">
        <div className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left">
          <div className="flex items-center gap-3">
            <CardWindowTab>UPDATE {entry.packVersion}</CardWindowTab>
            <p className="truncate text-[10px] text-text-low">{formatGmt8(entry.committedAt)}</p>
          </div>
          {collapsible ? (
            <button type="button" onClick={onToggle} className="text-text-low">
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : highlighted ? (
            <Badge>NEW</Badge>
          ) : null}
        </div>
      </CardWindowBar>

      {expanded ? (
        <CardContent className="flex flex-col gap-4 border-t border-line-soft/20 pt-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-high">{entry.title}</p>
            {entry.description ? (
              <p className="whitespace-pre-wrap text-xs text-text-low">{entry.description}</p>
            ) : null}
          </div>

          {entry.items.length ? (
            <div className="flex flex-col gap-4">
              {entry.items.map((item) => {
                const meta = changelogActionMeta(item.action);
                return (
                  <section
                    key={`${entry.commitSha}:${item.category}:${item.action}:${item.details.join("|")}`}
                    className="flex flex-col gap-2"
                  >
                    <p className={cn("text-xs", meta.headingClass)}>
                      {formatChangelogHeading(item)}
                    </p>
                    <div className="flex flex-col gap-1 text-xs text-text-low">
                      {item.details.map((detail) => (
                        <p
                          key={`${entry.commitSha}:${item.category}:${item.action}:${detail}`}
                          className={cn(meta.detailClass)}
                        >
                          <span className={cn("mr-2 inline-block w-3 font-mono", meta.prefixClass)}>
                            {meta.prefix}
                          </span>
                          {detail}
                        </p>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-low">No tracked content changes</p>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function formatChangelogSummary(newUpdateCount: number, totalEntries: number) {
  if (newUpdateCount > 0) {
    return `${newUpdateCount} NEW ${newUpdateCount === 1 ? "UPDATE" : "UPDATES"}!`;
  }
  if (totalEntries > 0) {
    return "UP TO DATE";
  }
  return "NO HISTORY";
}

function formatGmt8(unixSeconds: number) {
  const date = new Date(unixSeconds * 1000);
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return formatted.toUpperCase().replace(",", ", ");
}

function formatChangelogHeading(item: PackChangelogItem) {
  const action = item.action === "add" ? "Added" : item.action === "update" ? "Updated" : "Removed";
  const category =
    item.category === "mods"
      ? item.count === 1
        ? "Mod"
        : "Mods"
      : item.category === "resourcepacks"
        ? item.count === 1
          ? "Resourcepack"
          : "Resourcepacks"
        : item.category === "shaderpacks"
          ? item.count === 1
            ? "Shaderpack"
            : "Shaderpacks"
          : item.category === "config"
            ? item.count === 1
              ? "Config"
              : "Configs"
            : item.category === "kubejs"
              ? item.count === 1
                ? "KubeJS File"
                : "KubeJS Files"
              : item.count === 1
                ? "Root File"
                : "Root Files";
  return `${action} ${item.count} ${category}`;
}

function changelogActionMeta(action: PackChangelogItem["action"]) {
  if (action === "add") {
    return {
      prefix: "+",
      headingClass: "text-signal-live",
      detailClass: "text-text-high",
      prefixClass: "text-signal-live",
    };
  }
  if (action === "update") {
    return {
      prefix: "~",
      headingClass: "text-signal-warn",
      detailClass: "text-text-high",
      prefixClass: "text-signal-warn",
    };
  }
  return {
    prefix: "-",
    headingClass: "text-signal-alert",
    detailClass: "text-text-low line-through",
    prefixClass: "text-signal-alert",
  };
}
