import { ScrollArea } from "@/components/ui/scroll-area";
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

export function ShaderDiffTable({
  title,
  description,
  changes,
}: {
  title: string;
  description: string;
  changes: ShaderSettingsChange[];
}) {
  const sortedChanges = sortShaderSettingsChanges(changes);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden border border-line-soft/20 bg-surface-sunken/30">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft/20 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-text-low">{title}</p>
          <p className="text-xs text-text-low [text-wrap:pretty]">{description}</p>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-text-low">
          {sortedChanges.length}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        {sortedChanges.length > 0 ? (
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 py-2">ACTION</TableHead>
                  <TableHead className="px-3 py-2">KEY</TableHead>
                  <TableHead className="px-3 py-2">PACK VALUE</TableHead>
                  <TableHead className="px-3 py-2">LOCAL VALUE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y-0">
                {sortedChanges.map((change) => (
                  <TableRow
                    key={`${title}:${change.key}`}
                    className={cn("h-8 border-l-2", getOptionsChangeRowTone(change.action))}
                  >
                    <TableCell className="px-3 py-1.5 align-top">
                      <SyncPlanActionChip action={change.action} />
                    </TableCell>
                    <TableCell className="px-3 py-1.5 align-top">
                      <OptionsPreviewKey optionKey={change.key} />
                    </TableCell>
                    <TableCell className="px-3 py-1.5 align-top">
                      <OptionsPreviewValue
                        optionKey={change.key}
                        value={change.packValue ?? null}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5 align-top">
                      <OptionsPreviewValue
                        optionKey={change.key}
                        value={change.instanceValue ?? null}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-text-low">No changed keys.</div>
        )}
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

function sortShaderSettingsChanges(changes: ShaderSettingsChange[]) {
  return [...changes].sort(
    (left, right) =>
      actionOrder(left.action) - actionOrder(right.action) || left.key.localeCompare(right.key),
  );
}

function actionOrder(action: PublishAction) {
  return action === "remove" ? 0 : action === "update" ? 1 : action === "add" ? 2 : 3;
}
