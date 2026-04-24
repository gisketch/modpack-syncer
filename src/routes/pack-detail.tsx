import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Check,
  Download,
  FolderOpen,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardWindowBar,
  CardWindowTab,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { formatError } from "@/lib/format-error";
import { useModrinthProjects } from "@/lib/modrinth";
import {
  type ManifestEntry,
  type PackChangelogEntry,
  type PackChangelogItem,
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
  const adminMode = useAppStore((s) => s.adminModeByPack[packId] ?? false);

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
  const instanceDir = useQuery({
    queryKey: ["instance-dir", instanceName],
    queryFn: () => tauri.getInstanceMinecraftDir(instanceName),
    enabled: !!prism.data,
    retry: false,
  });
  const [launchConfirmOpen, setLaunchConfirmOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncDeleteConfirmOpen, setSyncDeleteConfirmOpen] = useState(false);
  const [expandedChangelog, setExpandedChangelog] = useState<Record<string, boolean>>({});
  const [showAllChangelog, setShowAllChangelog] = useState(false);
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
  const changelog = useQuery({
    queryKey: ["pack-changelog", packId],
    queryFn: () => tauri.packChangelog(packId, 12),
    retry: false,
  });
  const statusMap = new Map<string, ModStatusValue>(
    (statuses.data ?? [])
      .filter((s) => s.status !== "deleted" && s.status !== "unpublished")
      .map((s) => [s.filename, s.status]),
  );
  const deletedMods = (statuses.data ?? []).filter((s) => s.status === "deleted");
  const unpublishedMods = (statuses.data ?? [])
    .filter((s) => s.status === "unpublished")
    .sort((left, right) => left.filename.localeCompare(right.filename));
  const launchRiskCount = (statuses.data ?? []).filter(
    (s) => s.status === "missing" || s.status === "outdated",
  ).length;
  const highlightedCommitCount = launchRiskCount > 0 ? 3 : 1;

  useEffect(() => {
    if (!changelog.data?.length) return;
    setExpandedChangelog(
      Object.fromEntries(
        changelog.data.map((entry, index) => [entry.commitSha, index < highlightedCommitCount]),
      ),
    );
  }, [changelog.data, highlightedCommitCount]);

  useEffect(() => {
    setShowAllChangelog(false);
  }, [packId, highlightedCommitCount]);

  const modrinthMap = useModrinthProjects(manifest.data?.mods ?? []);
  const visibleChangelogEntries = (changelog.data ?? []).filter(
    (_, index) => showAllChangelog || index < highlightedCommitCount,
  );
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
        qc.invalidateQueries({ queryKey: ["pack-changelog", packId] }),
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
    onSuccess: async (scan) => {
      await qc.invalidateQueries({ queryKey: ["mod-statuses", packId] });
      setPublishReport(scan);
      toast.success("Publish scan ready", { description: `${scan.items.length} items` });
    },
    onError: (e) => {
      setPublishOpen(false);
      toast.error("Publish scan failed", { description: formatError(e) });
    },
  });
  const publishPush = useMutation({
    mutationFn: async ({ message, version }: { message: string; version: string }) => {
      const applied = await tauri.applyInstancePublish(packId, undefined, version);
      const pushed = await tauri.commitAndPushPublish(packId, message);
      return { applied, pushed };
    },
    onSuccess: async (result) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["manifest", packId] }),
        qc.invalidateQueries({ queryKey: ["mod-statuses", packId] }),
        qc.invalidateQueries({ queryKey: ["pack-changelog", packId] }),
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

  function handleSyncClick() {
    if (unpublishedMods.length > 0) {
      setSyncDeleteConfirmOpen(true);
      return;
    }
    sync.mutate();
  }

  async function handleOpenInstanceFolder() {
    if (!instanceDir.data) return;
    try {
      await openPath(instanceDir.data);
    } catch (error) {
      toast.error("Open folder failed", { description: formatError(error) });
    }
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

  if (publishOpen) {
    return (
      <PublishPreviewPage
        packId={packId}
        onClose={() => setPublishOpen(false)}
        pending={publishScan.isPending}
        report={publishReport}
        publishing={publishPush.isPending}
        onPublish={(message, version) => publishPush.mutate({ message, version })}
      />
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
          <Button
            variant="outline"
            onClick={() => void handleOpenInstanceFolder()}
            disabled={!instanceDir.data || !prism.data}
          >
            <FolderOpen />
            OPEN INSTANCE
          </Button>
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
            onClick={handleSyncClick}
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

      <Card>
        <CardHeader>
          <CardTitle>CHANGELOG</CardTitle>
          <CardDescription>Recent pack commits grouped by change type</CardDescription>
        </CardHeader>
        <CardContent>
          {changelog.isLoading ? (
            <div className="flex items-center gap-3 py-4 text-text-low">
              <Loader2 className="size-4 animate-spin text-brand-core" />
              <span className="text-sm">Loading commit history</span>
            </div>
          ) : changelog.data?.length ? (
            <div className="flex flex-col gap-4">
              <ScrollArea className={cn(showAllChangelog ? "h-[320px] pr-4" : "pr-4")}>
                <div className="flex flex-col gap-4">
                  {visibleChangelogEntries.map((entry) => {
                    const originalIndex = (changelog.data ?? []).findIndex(
                      (candidate) => candidate.commitSha === entry.commitSha,
                    );
                    const highlighted = originalIndex > -1 && originalIndex < highlightedCommitCount;
                    const expanded = expandedChangelog[entry.commitSha] ?? highlighted;
                    return (
                      <ChangelogCard
                        key={entry.commitSha}
                        entry={entry}
                        expanded={expanded}
                        highlighted={highlighted}
                        onToggle={() =>
                          setExpandedChangelog((current) => ({
                            ...current,
                            [entry.commitSha]: !(current[entry.commitSha] ?? highlighted),
                          }))
                        }
                      />
                    );
                  })}
                </div>
              </ScrollArea>
              {(changelog.data?.length ?? 0) > highlightedCommitCount ? (
                <Button
                  variant="outline"
                  onClick={() => setShowAllChangelog((value) => !value)}
                  className="w-full"
                >
                  {showAllChangelog ? "HIDE OLD CHANGELOGS" : "SHOW MORE..."}
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-text-low">No recent commits found.</p>
          )}
        </CardContent>
      </Card>

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
                  {unpublishedMods.map((mod) => (
                    <UnpublishedModRow
                      key={`unpublished:${mod.filename}`}
                      mod={mod}
                      adminMode={adminMode}
                    />
                  ))}
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
                      status={statusMap.get(m.filename) ?? null}
                      loading={statuses.isLoading || statuses.isFetching}
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

      <Dialog open={syncDeleteConfirmOpen} onOpenChange={setSyncDeleteConfirmOpen}>
        <DialogContent variant="destructive" className="overflow-hidden max-w-xl">
          <DialogHeader>
            <DialogTitle>SYNC WILL DELETE UNPUBLISHED MODS</DialogTitle>
            <DialogDescription>
              Sync keeps Prism instance 1:1 with source. Files below exist only in local mods folder and will be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="p-6">
            <div className="flex flex-col gap-4 text-sm text-text-low">
              <div className="flex flex-col gap-2 border border-line-soft/30 bg-surface-sunken p-4">
                {unpublishedMods.map((mod) => (
                  <p key={`sync-delete:${mod.filename}`} className="font-mono text-xs text-signal-alert">
                    {mod.filename}
                  </p>
                ))}
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-alert">
                Continue only if delete list correct.
              </p>
            </div>
          </DialogBody>
          <DialogFooter className="px-6 py-4 sm:justify-between">
            <Button variant="secondary" onClick={() => setSyncDeleteConfirmOpen(false)}>
              CANCEL
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setSyncDeleteConfirmOpen(false);
                sync.mutate();
              }}
            >
              DELETE + SYNC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PublishPreviewPage({
  packId,
  onClose,
  pending,
  report,
  publishing,
  onPublish,
}: {
  packId: string;
  onClose: () => void;
  pending: boolean;
  report: PublishScanReport | null;
  publishing: boolean;
  onPublish: (message: string, version: string) => void;
}) {
  const counts = summarizePublishReport(report);
  const changedItems = report?.items.filter((item) => item.action !== "unchanged") ?? [];
  const hasChanges = changedItems.length > 0;
  const publishVersion = useQuery({
    queryKey: ["suggest-publish-version", packId],
    queryFn: () => tauri.suggestPublishVersion(packId),
    retry: false,
  });
  const [commitTitle, setCommitTitle] = useState("Publish instance changes");
  const [commitDescription, setCommitDescription] = useState("");

  useEffect(() => {
    if (!publishVersion.data) return;
    setCommitTitle(`Update ${publishVersion.data}`);
  }, [publishVersion.data]);

  return (
    <div className="flex min-h-screen flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={publishing}>
          <ArrowLeft /> BACK
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
          :: PUBLISH PREVIEW / {packId}
        </span>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl text-text-high">Publish Preview</h1>
        <p className="text-sm text-text-low">
          {pending
            ? "Scanning linked Prism instance..."
            : report
              ? `${counts.add} add · ${counts.update} update · ${counts.remove} remove`
              : ""}
        </p>
      </header>

      {pending && (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-text-low">
            <Loader2 className="size-4 animate-spin text-brand-core" />
            <span className="text-sm">Reading instance folders</span>
          </CardContent>
        </Card>
      )}

      {report && !pending && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 p-6">
              <Input
                value={publishVersion.data ?? ""}
                placeholder="Pack version"
                disabled
              />
              <Input
                value={commitTitle}
                onChange={(event) => setCommitTitle(event.target.value)}
                placeholder="Commit title"
              />
              <Textarea
                value={commitDescription}
                onChange={(event) => setCommitDescription(event.target.value)}
                placeholder="Commit description"
                className="min-h-32"
              />
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Row k="ADD" v={String(counts.add)} />
                <Row k="UPDATE" v={String(counts.update)} />
                <Row k="REMOVE" v={String(counts.remove)} />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="default"
                  onClick={() =>
                    onPublish(
                      buildCommitMessage(commitTitle, commitDescription),
                      publishVersion.data ?? "",
                    )
                  }
                  disabled={publishing || !hasChanges || publishVersion.isLoading || !!publishVersion.error}
                >
                  {publishing ? <Loader2 className="animate-spin" /> : <FolderGit2 />}
                  COMMIT + PUSH
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CHANGES</CardTitle>
              <CardDescription>Only added, updated, removed entries shown</CardDescription>
            </CardHeader>
            <CardContent>
              {hasChanges ? (
                <ScrollArea className="h-[calc(100vh-23rem)]">
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
                      {changedItems.map((item) => (
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
              ) : (
                <p className="text-sm text-text-low">No changed files to publish.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
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
  loading,
}: {
  entry: ManifestEntry;
  icon: string | null;
  title: string | null;
  status: ModStatusValue | null;
  loading: boolean;
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
        <StatusChip status={status} loading={loading && status === null} />
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

function UnpublishedModRow({ mod, adminMode }: { mod: ModStatus; adminMode: boolean }) {
  const displayName = mod.filename.replace(/\.jar$/i, "");
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
      <TableCell>
        {warningMode ? <StrayModChip /> : <StatusChip status="unpublished" />}
      </TableCell>
      <TableCell className="text-right font-mono text-text-low text-xs">
        {typeof mod.size === "number" ? formatBytes(mod.size) : "--"}
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

function StatusChip({ status, loading = false }: { status: ModStatusValue | null; loading?: boolean }) {
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

function ChangelogCard({
  entry,
  expanded,
  highlighted,
  onToggle,
}: {
  entry: PackChangelogEntry;
  expanded: boolean;
  highlighted: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      variant="window"
      highlighted={highlighted}
      size="sm"
      className={cn(highlighted && "bg-surface-panel-strong/80")}
    >
      <CardWindowBar className="px-0 py-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left"
        >
          <div className="flex items-center gap-3">
            <CardWindowTab>UPDATE {entry.packVersion}</CardWindowTab>
            <p className="truncate text-[10px] text-text-low">{formatGmt8(entry.committedAt)}</p>
          </div>
          {expanded ? <ChevronDown className="size-4 text-text-low" /> : <ChevronRight className="size-4 text-text-low" />}
        </button>
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
              {entry.items.map((item, itemIndex) => {
                const meta = changelogActionMeta(item.action);
                return (
                  <section key={`${entry.commitSha}:${item.category}:${item.action}:${itemIndex}`} className="flex flex-col gap-2">
                    <p className={cn("text-xs", meta.headingClass)}>{formatChangelogHeading(item)}</p>
                    <div className="flex flex-col gap-1 text-xs text-text-low">
                      {item.details.map((detail, detailIndex) => (
                        <p
                          key={`${entry.commitSha}:${item.category}:${item.action}:${detailIndex}`}
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

function buildCommitMessage(title: string, description: string) {
  const cleanTitle = title.trim() || "Publish instance changes";
  const cleanDescription = description.trim();
  return cleanDescription ? `${cleanTitle}\n\n${cleanDescription}` : cleanTitle;
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
