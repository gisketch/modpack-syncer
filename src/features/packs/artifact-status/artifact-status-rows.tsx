import { AlertTriangle, Globe, Loader2, Package, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ManifestEntry, ModStatus, ModStatusValue, PublishScanReport } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function entryDisplayName(filename: string) {
  return filename.replace(/\.(jar|zip)$/i, "");
}

export function ModRow({
  entry,
  icon,
  title,
  status,
  loading,
}: {
  entry: ManifestEntry;
  icon: string | null;
  title: string | null;
  status: ModStatusValue | null;
  loading: boolean;
}) {
  const displayName = title ?? entryDisplayName(entry.filename);
  return (
    <TableRow>
      <TableCell>
        <div className="flex size-8 items-center justify-center overflow-hidden rounded border border-line-soft/40 bg-surface-base">
          {icon ? (
            <img src={icon} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <Package className="size-4 text-text-low" />
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-text-high text-xs">{displayName}</span>
          <span className="font-mono text-[10px] text-text-low">{entry.filename}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {entry.source === "url" ? <Globe className="size-3" /> : null}
          {entry.source.toUpperCase()}
        </Badge>
      </TableCell>
      <TableCell className="text-text-low text-xs uppercase">{entry.side}</TableCell>
      <TableCell>
        <StatusChip status={status} loading={loading && status === null} />
      </TableCell>
      <TableCell className="text-right font-mono text-text-low text-xs">
        {formatBytes(entry.size)}
      </TableCell>
    </TableRow>
  );
}

export function DeletedModRow({ mod }: { mod: ModStatus }) {
  const displayName = entryDisplayName(mod.filename);
  return (
    <TableRow className="opacity-45">
      <TableCell>
        <div className="flex size-8 items-center justify-center overflow-hidden rounded border border-line-soft/40 bg-surface-base">
          <Package className="size-4 text-text-low" />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-text-low text-xs line-through">{displayName}</span>
          <span className="font-mono text-[10px] text-text-low">{mod.filename}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">REMOVED</Badge>
      </TableCell>
      <TableCell className="text-text-low text-xs uppercase">--</TableCell>
      <TableCell>
        <StatusChip status="deleted" />
      </TableCell>
      <TableCell className="text-right font-mono text-text-low text-xs">
        {typeof mod.size === "number" ? formatBytes(mod.size) : "--"}
      </TableCell>
    </TableRow>
  );
}

export function UnpublishedModRow({
  mod,
  adminMode,
  deleting,
  onDelete,
}: {
  mod: ModStatus;
  adminMode: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const displayName = entryDisplayName(mod.filename);
  const warningMode = !adminMode;
  return (
    <TableRow className={cn(warningMode ? "bg-signal-alert/8" : "bg-signal-warn/6")}>
      <TableCell>
        <div
          className={cn(
            "flex size-8 items-center justify-center overflow-hidden rounded bg-surface-base",
            warningMode ? "border border-signal-alert/40" : "border border-signal-warn/40",
          )}
        >
          {warningMode ? (
            <AlertTriangle className="size-4 text-signal-alert" />
          ) : (
            <Package className="size-4 text-signal-warn" />
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className={cn("text-xs", warningMode ? "text-signal-alert" : "text-text-high")}>
            {displayName}
          </span>
          <span className="font-mono text-[10px] text-text-low">{mod.filename}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{warningMode ? "WARNING" : "INSTANCE"}</Badge>
      </TableCell>
      <TableCell className="text-text-low text-xs uppercase">local</TableCell>
      <TableCell>{warningMode ? <StrayModChip /> : <StatusChip status="unpublished" />}</TableCell>
      <TableCell className="text-right font-mono text-text-low text-xs">
        <div className="flex items-center justify-end gap-2">
          <span>{typeof mod.size === "number" ? formatBytes(mod.size) : "--"}</span>
          <Button size="sm" variant="outline" onClick={onDelete} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            DELETE
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function StrayModChip() {
  return (
    <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.18em] text-signal-alert">
      <AlertTriangle className="size-3" />
      STRAY MOD
    </span>
  );
}

const STATUS_META: Record<ModStatusValue, { label: string; dot: string; text: string }> = {
  synced: {
    label: "SYNCED",
    dot: "bg-signal-live shadow-[0_0_6px_var(--color-signal-live)]",
    text: "text-signal-live",
  },
  outdated: {
    label: "OUTDATED",
    dot: "bg-signal-warn shadow-[0_0_6px_var(--color-signal-warn)]",
    text: "text-signal-warn",
  },
  missing: {
    label: "MISSING",
    dot: "bg-signal-alert shadow-[0_0_6px_var(--color-signal-alert)]",
    text: "text-signal-alert",
  },
  deleted: {
    label: "DELETED",
    dot: "bg-signal-alert shadow-[0_0_6px_var(--color-signal-alert)]",
    text: "text-signal-alert",
  },
  unpublished: {
    label: "UNPUBLISHED",
    dot: "bg-signal-warn shadow-[0_0_6px_var(--color-signal-warn)]",
    text: "text-signal-warn",
  },
};

function StatusChip({
  status,
  loading = false,
}: {
  status: ModStatusValue | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.18em] text-text-low">
        <Loader2 className="size-3 animate-spin" />
        LOADING
      </span>
    );
  }

  const meta = STATUS_META[status ?? "missing"];
  return (
    <span className={cn("inline-flex items-center gap-2 text-[10px] tracking-[0.18em]", meta.text)}>
      <span className={cn("size-2 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function buildArtifactStatusMap(
  report: PublishScanReport | null | undefined,
  category: "resourcepacks" | "shaderpacks",
) {
  const map = new Map<string, ModStatusValue>();
  for (const item of report?.items ?? []) {
    if (item.category !== category) continue;
    if (item.action === "add") continue;
    map.set(
      item.relativePath,
      item.action === "unchanged" ? "synced" : item.action === "update" ? "outdated" : "missing",
    );
  }
  return map;
}
