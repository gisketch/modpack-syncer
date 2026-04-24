import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Download,
  FolderGit2,
  Globe,
  Loader2,
  Package,
  Play,
  RefreshCw,
  UploadCloudIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DialogBody,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatError } from "@/lib/format-error";
import { useModrinthProjects } from "@/lib/modrinth";
import {
  type ManifestEntry,
  type ModStatus,
  type ModStatusValue,
  type PublishAction,
  type PublishCategory,
  type PublishScanReport,
  type SyncProgressEvent,
  type SyncInstanceReport,
  tauri,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useNav } from "@/stores/nav-store";

export function PackDetailRoute({ packId }: { packId: string }) {
  const go = useNav((s) => s.go);
  const qc = useQueryClient();
  const adminMode = useAppStore((s) => s.adminMode);

  const pack = useQuery({
    queryKey: ["packs"],
    queryFn: () => tauri.listPacks(),
    select: (list) => list.find((p) => p.id === packId) ?? null,
  });

  const manifest = useQuery({
    queryKey: ["manifest", packId],
    queryFn: () => tauri.loadManifest(packId),
    retry: false,
  });

  const prism = useQuery({
    queryKey: ["prism"],
    queryFn: () => tauri.detectPrism(),
    retry: false,
  });

  const instanceName = `modsync-${packId}`;
  const [launchConfirmOpen, setLaunchConfirmOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null);
  const [publishReport, setPublishReport] = useState<PublishScanReport | null>(null);
  const [report, setReport] = useState<SyncInstanceReport | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    void listen<SyncProgressEvent>("sync-progress", (event) => {
      if (event.payload.packId !== packId) return;
      setProgress(event.payload);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [packId]);

  const statuses = useQuery({
    queryKey: ["mod-statuses", packId],
    queryFn: () => tauri.modStatuses(packId),
    enabled: !!manifest.data,
    retry: false,
  });
  const statusMap = new Map<string, ModStatusValue>(
    (statuses.data ?? [])
      .filter((s) => s.status !== "deleted")
      .map((s) => [s.filename, s.status]),
  );
  const deletedMods = (statuses.data ?? []).filter((s) => s.status === "deleted");
  const launchRiskCount = (statuses.data ?? []).filter(
    (s) => s.status === "missing" || s.status === "outdated",
  ).length;

  const modrinthMap = useModrinthProjects(manifest.data?.mods ?? []);
  const progressEntry = progress?.filename
    ? (manifest.data?.mods.find((m) => m.filename === progress.filename) ?? null)
    : null;
  const progressView = progress
    ? {
        icon:
          progressEntry?.source === "modrinth" && progressEntry.projectId
            ? (modrinthMap.get(progressEntry.projectId)?.icon_url ?? null)
            : null,
        title:
          progressEntry?.source === "modrinth" && progressEntry.projectId
            ? (modrinthMap.get(progressEntry.projectId)?.title ?? null)
            : null,
        filename: progress.filename ?? null,
      }
    : null;

  const fetchPack = useMutation({
    mutationFn: () => tauri.updatePack(packId),
    onSuccess: async (updatedPack) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["packs"] }),
        qc.invalidateQueries({ queryKey: ["manifest", packId] }),
        qc.invalidateQueries({ queryKey: ["mod-statuses", packId] }),
      ]);
      toast.success("Pack updated", {
        description: updatedPack.head_sha.slice(0, 10),
      });
    },
    onError: (e) => {
      toast.error("Fetch failed", { description: formatError(e) });
    },
  });

  const sync = useMutation({
    mutationFn: () => tauri.syncInstance(packId),
    onMutate: () => {
      setSyncOpen(true);
      setProgress({
        packId,
        status: "downloading",
        filename: null,
        completed: 0,
        total: manifest.data?.mods.length ?? 0,
        cached: 0,
        downloaded: 0,
        failures: 0,
      });
      setReport(null);
    },
    onSuccess: (r) => {
      setReport(r);
      statuses.refetch();
      toast.success("Sync complete", {
        description: `${r.instance.mods_written} mods · ${r.instance.resourcepacks_written} packs · ${r.instance.overrides_copied} overrides`,
      });
    },
    onError: (e) => {
      setSyncOpen(false);
      toast.error("Sync failed", { description: formatError(e) });
    },
  });

  const launch = useMutation({
    mutationFn: () => tauri.launchInstance(instanceName),
    onSuccess: () => toast.success("Prism launched"),
    onError: (e) => toast.error("Launch failed", { description: formatError(e) }),
  });

  const publishScan = useMutation({
    mutationFn: () => tauri.scanInstancePublish(packId),
    onMutate: () => {
      setPublishOpen(true);
      setPublishReport(null);
    },
    onSuccess: (scan) => {
      setPublishReport(scan);
      toast.success("Publish scan ready", { description: `${scan.items.length} items` });
    },
    onError: (e) => {
      setPublishOpen(false);
      toast.error("Publish scan failed", { description: formatError(e) });
    },
  });
  const publishApply = useMutation({
    mutationFn: () => tauri.applyInstancePublish(packId),
    onSuccess: async (result) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["manifest", packId] }),
        qc.invalidateQueries({ queryKey: ["mod-statuses", packId] }),
      ]);
      setPublishOpen(false);
      toast.success("Publish applied", {
        description: `${result.repoFilesWritten} files written · ${result.repoFilesRemoved} removed`,
      });
    },
    onError: (e) => {
      toast.error("Publish apply failed", { description: formatError(e) });
    },
  });
  const publishPush = useMutation({
    mutationFn: async (message: string) => {
      const applied = await tauri.applyInstancePublish(packId);
      const pushed = await tauri.commitAndPushPublish(packId, message);
      return { applied, pushed };
    },
    onSuccess: async (result) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["manifest", packId] }),
        qc.invalidateQueries({ queryKey: ["mod-statuses", packId] }),
        qc.invalidateQueries({ queryKey: ["packs"] }),
      ]);
      setPublishOpen(false);
      toast.success("Publish pushed", {
        description: `${result.pushed.commitSha.slice(0, 10)} via ${result.pushed.method.toUpperCase()}`,
      });
    },
    onError: (e) => {
      toast.error("Publish push failed", { description: formatError(e) });
    },
  });

  function handleLaunchClick() {
    if (launchRiskCount > 0) {
      setLaunchConfirmOpen(true);
      return;
    }
    launch.mutate();
  }

  if (pack.data === null && !pack.isLoading) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertTitle>Pack not found</AlertTitle>
          <AlertDescription>The requested pack does not exist.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => go({ kind: "packs" })}>
          <ArrowLeft /> BACK
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
          :: PACK INSPECTOR
        </span>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl text-text-high">{manifest.data?.pack.name ?? packId}</h1>
          {manifest.data && (
            <div className="flex flex-wrap gap-2">
              <Badge>v{manifest.data.pack.version}</Badge>
              <Badge variant="outline">MC {manifest.data.pack.mcVersion}</Badge>
              <Badge variant="outline">
                {manifest.data.pack.loader.toUpperCase()} {manifest.data.pack.loaderVersion}
              </Badge>
              <Badge variant="outline">
                <Package className="size-3" />
                {manifest.data.mods.length} mods
              </Badge>
            </div>
          )}
          {pack.data && (
            <p className="font-mono text-[--text-low] text-xs">
              {pack.data.head_sha.slice(0, 10)} :: {pack.data.url}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {adminMode && (
            <Button
              variant="outline"
              onClick={() => publishScan.mutate()}
              disabled={publishScan.isPending || sync.isPending || fetchPack.isPending}
            >
              {publishScan.isPending ? <Loader2 className="animate-spin" /> : <UploadCloudIcon />}
              PUBLISH
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => fetchPack.mutate()}
            disabled={fetchPack.isPending || sync.isPending || launch.isPending}
          >
            {fetchPack.isPending ? <Loader2 className="animate-spin" /> : <FolderGit2 />}
            FETCH
          </Button>
          <Button
            variant="secondary"
            onClick={() => sync.mutate()}
            disabled={fetchPack.isPending || sync.isPending || !manifest.data || !prism.data}
          >
            {sync.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            SYNC
          </Button>
          <Button
            onClick={handleLaunchClick}
            disabled={fetchPack.isPending || launch.isPending || !prism.data || sync.isPending}
          >
            {launch.isPending ? <Loader2 className="animate-spin" /> : <Play />}
            LAUNCH
          </Button>
        </div>
      </header>

      {!prism.data && !prism.isLoading && (
        <Alert variant="destructive">
          <AlertTitle>Prism Launcher not detected</AlertTitle>
          <AlertDescription>
            Install Prism Launcher before syncing or launching this pack.
          </AlertDescription>
        </Alert>
      )}

      {manifest.isError && (
        <Alert variant="destructive">
          <AlertTitle>Manifest missing</AlertTitle>
          <AlertDescription>
            No <code>manifest.json</code> found in this repo yet.
          </AlertDescription>
        </Alert>
      )}

      {report && (
        <Alert>
          <AlertTitle>Sync report</AlertTitle>
          <AlertDescription>
            Wrote {report.instance.mods_written} mods, {report.instance.resourcepacks_written} resourcepacks,
            {" "}{report.instance.shaderpacks_written} shaderpacks, {report.instance.overrides_copied} overrides.
            Cached {report.fetch.cached} / downloaded {report.fetch.downloaded} / total{" "}
            {report.fetch.total}.
            {report.fetch.failures.length > 0 && (
              <span className="block text-signal-alert">
                {report.fetch.failures.length} failures
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {manifest.data && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Download className="inline size-4" /> MODS
            </CardTitle>
            <CardDescription>
              {manifest.data.mods.length} entries tracked by manifest
              {deletedMods.length > 0 ? ` · ${deletedMods.length} deleted in instance` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>NAME</TableHead>
                    <TableHead>SOURCE</TableHead>
                    <TableHead>SIDE</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead className="text-right">SIZE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manifest.data.mods.map((m) => (
                    <ModRow
                      key={m.id}
                      entry={m}
                      icon={
                        m.source === "modrinth" && m.projectId
                          ? (modrinthMap.get(m.projectId)?.icon_url ?? null)
                          : null
                      }
                      title={
                        m.source === "modrinth" && m.projectId
                          ? (modrinthMap.get(m.projectId)?.title ?? null)
                          : null
                      }
                      status={statusMap.get(m.filename) ?? "missing"}
                    />
                  ))}
                  {deletedMods.map((m) => (
                    <DeletedModRow key={`deleted:${m.filename}`} mod={m} />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <SyncDialog
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        pending={sync.isPending}
        progress={progress}
        progressView={progressView}
        report={report}
      />

      <Dialog open={launchConfirmOpen} onOpenChange={setLaunchConfirmOpen}>
        <DialogContent variant="destructive" className="overflow-hidden max-w-md">
          <DialogHeader>
            <DialogTitle>PLEASE UPDATE FIRST BEFORE LAUNCHING</DialogTitle>
            <DialogDescription>
              {launchRiskCount} mod{launchRiskCount === 1 ? " is" : "s are"} missing or outdated.
              Launching now may break pack.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="p-6">
            <div className="flex flex-col gap-3 text-sm text-text-low">
              <p>Sync pack first for clean instance.</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-alert">
                Proceed only if you know instance mismatch is safe.
              </p>
            </div>
          </DialogBody>
          <DialogFooter className="px-6 py-4 sm:justify-between">
            <Button variant="secondary" onClick={() => setLaunchConfirmOpen(false)}>
              OKAY
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLaunchConfirmOpen(false);
                launch.mutate();
              }}
            >
              LAUNCH ANYWAY
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PublishPreviewDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        pending={publishScan.isPending}
        report={publishReport}
        applying={publishApply.isPending}
        onApply={() => publishApply.mutate()}
        publishing={publishPush.isPending}
        onPublish={(message) => publishPush.mutate(message)}
      />
    </div>
  );
}

function PublishPreviewDialog({
  open,
  onClose,
  pending,
  report,
  applying,
  onApply,
  publishing,
  onPublish,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  report: PublishScanReport | null;
  applying: boolean;
  onApply: () => void;
  publishing: boolean;
  onPublish: (message: string) => void;
}) {
  const counts = summarizePublishReport(report);
  const hasChanges = Boolean(report?.items.some((item) => item.action !== "unchanged"));
  const [commitMessage, setCommitMessage] = useState("Publish instance changes");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="overflow-hidden max-w-4xl">
        <DialogHeader>
          <DialogTitle>PUBLISH PREVIEW</DialogTitle>
          <DialogDescription>
            {pending
              ? "Scanning linked Prism instance…"
              : report
                ? `${counts.add} add · ${counts.update} update · ${counts.remove} remove`
                : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="p-6">
          {pending && (
            <div className="flex items-center gap-3 py-6 text-text-low">
              <Loader2 className="size-4 animate-spin text-brand-core" />
              <span className="text-sm">Reading instance folders</span>
            </div>
          )}

          {report && !pending && (
            <div className="flex flex-col gap-4">
              <Input
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                placeholder="Publish instance changes"
              />
              <div className="grid grid-cols-4 gap-3 text-xs">
                <Row k="ADD" v={String(counts.add)} />
                <Row k="UPDATE" v={String(counts.update)} />
                <Row k="REMOVE" v={String(counts.remove)} />
                <Row k="UNCHANGED" v={String(counts.unchanged)} />
              </div>

              <ScrollArea className="max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CATEGORY</TableHead>
                      <TableHead>PATH</TableHead>
                      <TableHead>ACTION</TableHead>
                      <TableHead>SOURCE</TableHead>
                      <TableHead className="text-right">SIZE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.items.map((item) => (
                      <TableRow key={`${item.category}:${item.relativePath}:${item.action}`}>
                        <TableCell>
                          <Badge variant="outline">{labelCategory(item.category)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-text-low">
                          {item.relativePath}
                        </TableCell>
                        <TableCell>
                          <PublishActionChip action={item.action} />
                        </TableCell>
                        <TableCell className="text-xs text-text-low">
                          {item.source ?? "instance-local"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-text-low">
                          {typeof item.size === "number" ? formatBytes(item.size) : "--"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </DialogBody>
        <DialogFooter className="px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={pending || applying || publishing}>
            CLOSE
          </Button>
          <Button onClick={onApply} disabled={pending || applying || publishing || !hasChanges}>
            {applying ? <Loader2 className="animate-spin" /> : <UploadCloudIcon />}
            APPLY TO REPO
          </Button>
          <Button
            variant="default"
            onClick={() => onPublish(commitMessage.trim() || "Publish instance changes")}
            disabled={pending || applying || publishing || !report}
          >
            {publishing ? <Loader2 className="animate-spin" /> : <FolderGit2 />}
            COMMIT + PUSH
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SyncDialog({
  open,
  onClose,
  pending,
  progress,
  progressView,
  report,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  progress: SyncProgressEvent | null;
  progressView: { icon: string | null; title: string | null; filename: string | null } | null;
  report: SyncInstanceReport | null;
}) {
  const total = Math.max(progress?.total ?? 0, 1);
  const completed = Math.min(progress?.completed ?? 0, total);
  const currentLabel = progressView?.title ?? progressView?.filename ?? "Preparing sync";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="overflow-hidden">
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

            <DialogBody className="p-6">
              {pending && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
                      :: {syncProgressLabel(progress)}
                    </span>
                    <span className="font-heading text-xs tracking-[0.18em] text-brand-core">
                      {progress?.completed ?? 0}/{progress?.total ?? 0}
                    </span>
                  </div>

                  <Slider value={[completed]} max={total} disabled>
                    <SliderControl>
                      <SliderTrack>
                        <SliderIndicator />
                      </SliderTrack>
                      <SliderThumb className="opacity-0" />
                    </SliderControl>
                  </Slider>

                  <div className="flex items-center gap-3 border border-line-soft/30 bg-surface-sunken px-4 py-4">
                    <div className="flex size-10 items-center justify-center overflow-hidden rounded border border-line-soft/40 bg-surface-base">
                      {progressView?.icon ? (
                        <img
                          src={progressView.icon}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : progress?.status === "downloaded" || progress?.status === "cached" ? (
                        <Check className="size-4 text-brand-core" />
                      ) : progress?.status === "downloading" || progress?.status === "writing-instance" ? (
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
                          : progressView?.filename ?? "Waiting for next mod"}
                      </p>
                    </div>
                    <StatusChip status={syncProgressToStatus(progress)} />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <Row k="CACHED" v={String(progress?.cached ?? 0)} />
                    <Row k="DOWNLOADED" v={String(progress?.downloaded ?? 0)} />
                    <Row k="FAILURES" v={String(progress?.failures ?? 0)} alert={(progress?.failures ?? 0) > 0} />
                  </div>
                </div>
              )}

              {report && !pending && (
                <div className="flex flex-col gap-2 text-xs">
                  <Row k="MODS WRITTEN" v={String(report.instance.mods_written)} />
                  <Row k="RESOURCEPACKS WRITTEN" v={String(report.instance.resourcepacks_written)} />
                  <Row k="SHADERPACKS WRITTEN" v={String(report.instance.shaderpacks_written)} />
                  <Row k="OVERRIDES COPIED" v={String(report.instance.overrides_copied)} />
                  <Row k="CACHE HIT" v={`${report.fetch.cached} / ${report.fetch.total}`} />
                  <Row k="DOWNLOADED" v={String(report.fetch.downloaded)} />
                  {report.fetch.failures.length > 0 && (
                    <Row k="FAILURES" v={String(report.fetch.failures.length)} alert />
                  )}
                  <p className="mt-2 truncate font-mono text-[10px] text-[--text-low]">
                    {report.instance.instance_dir}
                  </p>
                </div>
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

function Row({ k, v, alert }: { k: string; v: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between border-line-soft/30 border-b pb-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">{k}</span>
      <span className={`font-mono text-xs ${alert ? "text-signal-alert" : "text-text-high"}`}>
        {v}
      </span>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ModRow({
  entry,
  icon,
  title,
  status,
}: {
  entry: ManifestEntry;
  icon: string | null;
  title: string | null;
  status: ModStatusValue;
}) {
  const displayName = title ?? entry.filename.replace(/\.jar$/i, "");
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
        <StatusChip status={status} />
      </TableCell>
      <TableCell className="text-right font-mono text-text-low text-xs">
        {formatBytes(entry.size)}
      </TableCell>
    </TableRow>
  );
}


function DeletedModRow({ mod }: { mod: ModStatus }) {
  const displayName = mod.filename.replace(/\.jar$/i, "");
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
};

function StatusChip({ status }: { status: ModStatusValue }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-[10px] tracking-[0.18em]", meta.text)}>
      <span className={cn("size-2 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function PublishActionChip({ action }: { action: PublishAction }) {
  const text =
    action === "add"
      ? "text-brand-core"
      : action === "update"
        ? "text-signal-warn"
        : action === "remove"
          ? "text-signal-alert"
          : "text-text-low";

  return <span className={cn("text-[10px] uppercase tracking-[0.18em]", text)}>{action}</span>;
}

function summarizePublishReport(report: PublishScanReport | null) {
  return {
    add: report?.items.filter((item) => item.action === "add").length ?? 0,
    update: report?.items.filter((item) => item.action === "update").length ?? 0,
    remove: report?.items.filter((item) => item.action === "remove").length ?? 0,
    unchanged: report?.items.filter((item) => item.action === "unchanged").length ?? 0,
  };
}

function labelCategory(category: PublishCategory) {
  return category.toUpperCase();
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
  if (!progress) return "Downloading + writing Prism instance…";
  if (progress.status === "writing-instance") {
    return `Writing instance files · ${progress.completed}/${progress.total}`;
  }
  return `${progress.completed}/${progress.total} mods processed`;
}

function syncProgressToStatus(progress: SyncProgressEvent | null): ModStatusValue {
  if (!progress) return "missing";
  if (progress.status === "cached" || progress.status === "downloaded" || progress.status === "done") {
    return "synced";
  }
  if (progress.status === "failed") return "deleted";
  return "outdated";
}
