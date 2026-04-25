import { AlertTriangle, Globe, Loader2, Package, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  disabled = false,
  canDisable = false,
  togglingDisabled = false,
  onToggleDisabled,
}: {
  entry: ManifestEntry;
  icon: string | null;
  title: string | null;
  status: ModStatusValue | null;
  loading: boolean;
  disabled?: boolean;
  canDisable?: boolean;
  togglingDisabled?: boolean;
  onToggleDisabled?: (disabled: boolean) => void;
}) {
  const displayName = title ?? entryDisplayName(entry.filename);
  const enabled = !disabled;
  const toggleEnabled = () => {
    if (!canDisable || togglingDisabled) return;
    onToggleDisabled?.(enabled);
  };
  const enabledControl = (
    <Checkbox
      checked={enabled}
      disabled={!canDisable || togglingDisabled}
      aria-label={`Enabled ${entry.filename}`}
      className={cn("pointer-events-none", !canDisable && "opacity-45")}
    />
  );
  return (
    <TableRow className={cn("h-9", disabled && "opacity-45")}>
      <TableCell className="py-1.5">
        <div className="flex size-7 items-center justify-center overflow-hidden rounded border border-line-soft/40 bg-surface-base">
          {icon ? (
            <img src={icon} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <Package className="size-4 text-text-low" />
          )}
        </div>
      </TableCell>
      <TableCell className="py-1.5">
        <span
          className={cn(
            "block max-w-[22rem] truncate text-xs",
            disabled ? "text-text-low line-through" : "text-text-high",
          )}
          title={entry.filename}
        >
          {displayName}
        </span>
      </TableCell>
      <TableCell className="py-1.5">
        <Badge variant="outline">
          {entry.source === "url" ? <Globe className="size-3" /> : null}
          {entry.source.toUpperCase()}
        </Badge>
      </TableCell>
      <TableCell className="py-1.5 text-text-low text-xs uppercase">{entry.side}</TableCell>
      <TableCell className="py-1.5 text-right">
        <StatusChip status={disabled ? "disabled" : status} loading={loading && status === null} />
      </TableCell>
      <TableCell
        className={cn(
          "py-1.5 text-center",
          canDisable && !togglingDisabled ? "cursor-pointer" : "cursor-not-allowed",
        )}
        role={canDisable ? "button" : undefined}
        tabIndex={canDisable && !togglingDisabled ? 0 : -1}
        onClick={toggleEnabled}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && canDisable && !togglingDisabled) {
            event.preventDefault();
            toggleEnabled();
          }
        }}
      >
        <div className="flex items-center justify-center">
          {togglingDisabled && canDisable ? (
            <Loader2 className="mr-2 size-3 animate-spin text-text-low" />
          ) : null}
          {!canDisable ? (
            <TooltipProvider delay={0}>
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  {enabledControl}
                </TooltipTrigger>
                <TooltipContent>CANT DISABLE REQUIRED MOD</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            enabledControl
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function DeletedModRow({ mod }: { mod: ModStatus }) {
  const displayName = entryDisplayName(mod.filename);
  return (
    <TableRow className="h-9 opacity-45">
      <TableCell className="py-1.5">
        <div className="flex size-7 items-center justify-center overflow-hidden rounded border border-line-soft/40 bg-surface-base">
          <Package className="size-4 text-text-low" />
        </div>
      </TableCell>
      <TableCell className="py-1.5">
        <span
          className="block max-w-[22rem] truncate text-text-low text-xs line-through"
          title={mod.filename}
        >
          {displayName}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">REMOVED</Badge>
      </TableCell>
      <TableCell className="text-text-low text-xs uppercase">--</TableCell>
      <TableCell className="text-right">
        <StatusChip status="deleted" />
      </TableCell>
      <TableCell className="text-right text-text-low text-xs">--</TableCell>
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
    <TableRow className={cn("h-9", warningMode ? "bg-signal-alert/8" : "bg-signal-warn/6")}>
      <TableCell className="py-1.5">
        <div
          className={cn(
            "flex size-7 items-center justify-center overflow-hidden rounded bg-surface-base",
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
      <TableCell className="py-1.5">
        <span
          className={cn(
            "block max-w-[22rem] truncate text-xs",
            warningMode ? "text-signal-alert" : "text-text-high",
          )}
          title={mod.filename}
        >
          {displayName}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{warningMode ? "WARNING" : "INSTANCE"}</Badge>
      </TableCell>
      <TableCell className="text-text-low text-xs uppercase">local</TableCell>
      <TableCell className="text-right">
        {warningMode ? <StrayModChip /> : <StatusChip status="unpublished" />}
      </TableCell>
      <TableCell className="text-right text-text-low text-xs">
        <div className="flex items-center justify-end gap-2">
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
  disabled: {
    label: "DISABLED",
    dot: "bg-text-low",
    text: "text-text-low",
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
