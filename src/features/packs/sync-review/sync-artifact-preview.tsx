import { Card, CardContent, CardStatus, CardWindowBar, CardWindowTab } from "@/components/ui/card";
import type { PublishAction, PublishCategory, PublishScanReport } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export type SyncCategorySummary = {
  category: "mods" | "resourcepacks" | "shaderpacks";
  label: string;
  add: number;
  update: number;
  remove: number;
};

export type SyncReviewTab = {
  id: SyncCategorySummary["category"];
  label: string;
  items: PublishScanReport["items"];
  count: number;
};

export function buildSyncSummary(
  report: PublishScanReport | null | undefined,
): SyncCategorySummary[] {
  const categories: SyncCategorySummary["category"][] = ["mods", "resourcepacks", "shaderpacks"];
  return categories.map((category) => {
    const items = (report?.items ?? []).filter((item) => item.category === category);
    return {
      category,
      label: labelCategory(category),
      add: items.filter((item) => item.action === "remove").length,
      update: items.filter((item) => item.action === "update").length,
      remove: items.filter((item) => item.action === "add").length,
    };
  });
}

export function buildSyncReviewTabs(report: PublishScanReport | null | undefined): SyncReviewTab[] {
  const categories: SyncCategorySummary["category"][] = ["mods", "resourcepacks", "shaderpacks"];
  return categories.map((category) => {
    const items = (report?.items ?? []).filter(
      (item) => item.category === category && item.action !== "unchanged",
    );
    return {
      id: category,
      label: labelCategory(category),
      items,
      count: items.length,
    };
  });
}

export function SyncPreviewCard({ summary }: { summary: SyncCategorySummary }) {
  return (
    <Card variant="window">
      <CardWindowBar>
        <CardWindowTab>{summary.label}</CardWindowTab>
        <CardStatus>{summary.add + summary.update + summary.remove} CHANGES</CardStatus>
      </CardWindowBar>
      <CardContent className="grid grid-cols-3 gap-2 p-4 text-xs">
        <SummaryRow k="ADD" v={String(summary.add)} />
        <SummaryRow k="UPDATE" v={String(summary.update)} />
        <SummaryRow k="DELETE" v={String(summary.remove)} />
      </CardContent>
    </Card>
  );
}

export function SyncPlanActionChip({ action }: { action: PublishAction }) {
  const label = action === "remove" ? "ADD" : action === "update" ? "UPDATE" : "DELETE";
  const text =
    action === "remove"
      ? "text-signal-live"
      : action === "update"
        ? "text-signal-warn"
        : "text-signal-alert";
  return <span className={cn("text-[10px] uppercase tracking-[0.18em]", text)}>{label}</span>;
}

function labelCategory(category: PublishCategory, relativePath?: string) {
  if (category === "root" && relativePath === "options.txt") {
    return "OPTIONS";
  }
  if (category === "shader-settings") {
    return "SHADER SETTINGS";
  }
  if (category === "root") {
    return "ROOT";
  }
  return category.toUpperCase();
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-line-soft/30 border-b pb-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">{k}</span>
      <span className="font-mono text-xs text-text-high">{v}</span>
    </div>
  );
}
