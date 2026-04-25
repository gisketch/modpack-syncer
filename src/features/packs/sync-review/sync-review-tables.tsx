import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OptionsSyncPreview, PublishAction, ShaderSettingsChange } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { OptionsPreviewKey, OptionsPreviewValue } from "./option-value-cells";

export function Row({ k, v, alert }: { k: string; v: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-line-soft/20 bg-surface-sunken/60 px-3 py-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">{k}</span>
      <span
        className={cn(
          "truncate text-right font-mono text-xs tabular-nums",
          alert ? "text-signal-alert" : "text-text-high",
        )}
      >
        {v}
      </span>
    </div>
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

export function ShaderSettingsChangesTable({
  changes,
}: {
  changes: Array<ShaderSettingsChange & { source?: string }>;
}) {
  const sortedChanges = sortShaderSettingsChanges(changes);

  if (sortedChanges.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-text-low">No changed keys.</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3 py-2">ACTION</TableHead>
          <TableHead className="px-3 py-2">SETTING</TableHead>
          <TableHead className="px-3 py-2">LOCAL VALUE</TableHead>
          <TableHead className="px-3 py-2">PACK VALUE</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y-0">
        {sortedChanges.map((change) => (
          <TableRow
            key={`${change.source ?? "shader"}:${change.action}:${change.key}`}
            className={cn("h-8 border-l-2", getOptionsChangeRowTone(change.action))}
          >
            <TableCell className="px-3 py-1.5 align-top">
              <SyncPlanActionChip action={change.action} />
            </TableCell>
            <TableCell className="px-3 py-1.5 align-top">
              <OptionsPreviewKey optionKey={change.key} />
            </TableCell>
            <TableCell className="px-3 py-1.5 align-top">
              <OptionsPreviewValue optionKey={change.key} value={change.instanceValue ?? null} />
            </TableCell>
            <TableCell className="px-3 py-1.5 align-top">
              <OptionsPreviewValue optionKey={change.key} value={change.packValue ?? null} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ShaderSelectionLine({
  localShader,
  packShader,
}: {
  localShader: string;
  packShader: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1 text-xs">
      <div className="min-w-0">
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
          SHADER SELECTED:
        </span>
        <span className="ml-2 font-mono text-text-high" title={localShader}>
          {localShader}
        </span>
      </div>
      <div className="min-w-0">
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">PACK:</span>
        <span className="ml-2 font-mono text-text-high" title={packShader}>
          {packShader}
        </span>
      </div>
    </div>
  );
}

export function sortOptionsSyncChanges(changes: OptionsSyncPreview["groups"][number]["changes"]) {
  return [...changes].sort((left, right) => {
    if (left.ignored !== right.ignored) {
      return left.ignored ? 1 : -1;
    }
    return (
      actionOrder(left.action) - actionOrder(right.action) || left.key.localeCompare(right.key)
    );
  });
}

export function getOptionsChangeRowTone(action: PublishAction) {
  if (action === "remove") {
    return "border-signal-live/50";
  }
  if (action === "update") {
    return "border-signal-warn/50";
  }
  return "border-signal-alert/50";
}

function sortShaderSettingsChanges<T extends ShaderSettingsChange>(changes: T[]) {
  return [...changes].sort(
    (left, right) =>
      actionOrder(left.action) - actionOrder(right.action) || left.key.localeCompare(right.key),
  );
}

function actionOrder(action: PublishAction) {
  return action === "remove" ? 0 : action === "update" ? 1 : action === "add" ? 2 : 3;
}
