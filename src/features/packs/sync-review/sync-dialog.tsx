import { Check, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardStatus, CardWindowBar, CardWindowTab } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@/components/ui/slider";
import type { ModStatusValue, SyncInstanceReport, SyncProgressEvent } from "@/lib/tauri";
import { cn } from "@/lib/utils";

type SyncDialogProps = {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  progress: SyncProgressEvent | null;
  progressView: { icon: string | null; title: string | null; filename: string | null } | null;
  report: SyncInstanceReport | null;
};

export function SyncDialog({
  open,
  onClose,
  pending,
  progress,
  progressView,
  report,
}: SyncDialogProps) {
  const total = Math.max(progress?.total ?? 0, 1);
  const completed = Math.min(progress?.completed ?? 0, total);
  const currentLabel = progressView?.title ?? progressView?.filename ?? "Preparing sync";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[min(92vh,48rem)] max-h-[92vh] flex-col overflow-hidden max-w-[96vw] sm:max-w-[72rem] xl:max-w-[80rem]">
        <DialogHeader>
          <DialogTitle>{pending ? "SYNCING" : report ? "SYNC OK" : "SYNC"}</DialogTitle>
          <DialogDescription>
            {pending
              ? syncProgressDescription(progress)
              : report
                ? `${report.instance.mods_written} mods · ${report.instance.resourcepacks_written} packs · ${report.instance.overrides_copied} overrides`
                : ""}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 overflow-y-auto p-5 xl:p-6">
          {pending && (
            <div className="flex flex-col gap-5">
              <Card variant="window">
                <CardWindowBar>
                  <CardWindowTab>{syncProgressLabel(progress)}</CardWindowTab>
                  <CardStatus>
                    {progress?.completed ?? 0}/{progress?.total ?? 0}
                  </CardStatus>
                </CardWindowBar>
                <CardContent className="flex flex-col gap-5 p-5">
                  <Slider value={[completed]} max={total} disabled>
                    <SliderControl>
                      <SliderTrack>
                        <SliderIndicator />
                      </SliderTrack>
                      <SliderThumb className="opacity-0" />
                    </SliderControl>
                  </Slider>

                  <div className="flex items-center gap-3 border border-line-soft/30 bg-surface-sunken px-4 py-4">
                    <div className="flex size-10 items-center justify-center overflow-hidden border border-line-soft/40 bg-surface-base">
                      {progressView?.icon ? (
                        <img
                          src={progressView.icon}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : progress?.status === "downloaded" || progress?.status === "cached" ? (
                        <Check className="size-4 text-brand-core" />
                      ) : progress?.status === "downloading" ||
                        progress?.status === "writing-instance" ? (
                        <Loader2 className="size-4 animate-spin text-brand-core" />
                      ) : (
                        <Package className="size-4 text-text-low" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-high">{currentLabel}</p>
                      <p className="truncate font-mono text-[10px] text-text-low">
                        {progress?.status === "writing-instance"
                          ? "Writing Prism instance"
                          : (progressView?.filename ?? "Waiting for next artifact")}
                      </p>
                    </div>
                    <StatusChip status={syncProgressToStatus(progress)} />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <SummaryRow k="CACHED" v={String(progress?.cached ?? 0)} />
                    <SummaryRow k="DOWNLOADED" v={String(progress?.downloaded ?? 0)} />
                    <SummaryRow
                      k="FAILURES"
                      v={String(progress?.failures ?? 0)}
                      alert={(progress?.failures ?? 0) > 0}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {report && !pending && (
            <Card variant="window">
              <CardWindowBar>
                <CardWindowTab>SYNC REPORT</CardWindowTab>
                <CardStatus>COMPLETE</CardStatus>
              </CardWindowBar>
              <CardContent className="flex flex-col gap-2 p-5 text-xs">
                <SummaryRow k="MODS WRITTEN" v={String(report.instance.mods_written)} />
                <SummaryRow
                  k="RESOURCEPACKS WRITTEN"
                  v={String(report.instance.resourcepacks_written)}
                />
                <SummaryRow
                  k="SHADERPACKS WRITTEN"
                  v={String(report.instance.shaderpacks_written)}
                />
                <SummaryRow k="OVERRIDES COPIED" v={String(report.instance.overrides_copied)} />
                <SummaryRow k="CACHE HIT" v={`${report.fetch.cached} / ${report.fetch.total}`} />
                <SummaryRow k="DOWNLOADED" v={String(report.fetch.downloaded)} />
                {report.fetch.failures.length > 0 && (
                  <SummaryRow k="FAILURES" v={String(report.fetch.failures.length)} alert />
                )}
                <p className="mt-2 truncate font-mono text-[10px] text-[--text-low]">
                  {report.instance.instance_dir}
                </p>
              </CardContent>
            </Card>
          )}
        </DialogBody>

        <DialogFooter className="px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            CLOSE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ k, v, alert }: { k: string; v: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between border-line-soft/30 border-b pb-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">{k}</span>
      <span className={`font-mono text-xs ${alert ? "text-signal-alert" : "text-text-high"}`}>
        {v}
      </span>
    </div>
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

function syncProgressLabel(progress: SyncProgressEvent | null) {
  if (!progress) return "WORKING";
  if (progress.status === "writing-instance") return "WRITING";
  if (progress.status === "cached") return "CACHED";
  if (progress.status === "downloaded") return "DOWNLOADED";
  if (progress.status === "failed") return "FAILED";
  if (progress.status === "done") return "DONE";
  return "DOWNLOADING";
}

function syncProgressDescription(progress: SyncProgressEvent | null) {
  if (!progress) return "Downloading + writing Prism instance...";
  if (progress.status === "writing-instance") {
    return `Writing instance files · ${progress.completed}/${progress.total}`;
  }
  return `${progress.completed}/${progress.total} artifacts processed`;
}

function syncProgressToStatus(progress: SyncProgressEvent | null): ModStatusValue {
  if (!progress) return "missing";
  if (
    progress.status === "cached" ||
    progress.status === "downloaded" ||
    progress.status === "done"
  ) {
    return "synced";
  }
  if (progress.status === "failed") return "deleted";
  return "outdated";
}
