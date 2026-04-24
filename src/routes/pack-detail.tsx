import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";
import { exeExtension } from "@tauri-apps/plugin-os";
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
  HardDrive,
  Link2,
  Loader2,
  MemoryStick,
  Package,
  Play,
  Plus,
  Rocket,
  RefreshCw,
  Settings2,
  Trash2,
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
  CardFooter,
  CardHeader,
  CardStatus,
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  type JavaInstallProgressEvent,
  type LaunchProfile,
  type Loader,
  type ModrinthAddPreview,
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
  const lastSyncedCommit = useAppStore((s) => s.lastSyncedCommitByPack[packId] ?? null);
  const setLastSyncedCommit = useAppStore((s) => s.setLastSyncedCommit);

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
  const [launchProfileDraft, setLaunchProfileDraft] = useState<LaunchProfile | null>(null);
  const [javaInstallOpen, setJavaInstallOpen] = useState(false);
  const [selectedJavaChoiceId, setSelectedJavaChoiceId] = useState("temurin-21-jre");
  const [javaInstallProgress, setJavaInstallProgress] = useState<JavaInstallProgressEvent | null>(null);
  const [javaInstallLogs, setJavaInstallLogs] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [addModsOpen, setAddModsOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncDeleteConfirmOpen, setSyncDeleteConfirmOpen] = useState(false);
  const [syncAlreadySyncedConfirmOpen, setSyncAlreadySyncedConfirmOpen] = useState(false);
  const [expandedChangelog, setExpandedChangelog] = useState<Record<string, boolean>>({});
  const [showAllChangelog, setShowAllChangelog] = useState(false);
  const [publishLogs, setPublishLogs] = useState<string[]>([]);
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

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    void listen<JavaInstallProgressEvent>("java-install-progress", (event) => {
      if (event.payload.packId !== packId) return;
      setJavaInstallProgress(event.payload);
      if (event.payload.logLine) {
        setJavaInstallLogs((current) => [...current, event.payload.logLine as string]);
      }
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
    queryKey: ["pack-changelog", packId, lastSyncedCommit],
    queryFn: () => tauri.packChangelog(packId, 12, lastSyncedCommit),
    retry: false,
  });
  const launchProfile = useQuery({
    queryKey: ["launch-profile", packId],
    queryFn: () => tauri.getLaunchProfile(packId),
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
  const javaChoices = getJavaInstallChoices(manifest.data?.pack.mcVersion, manifest.data?.pack.loader);
  const syncedModCount = (statuses.data ?? []).filter((s) => s.status === "synced").length;
  const alreadySynced =
    !!manifest.data &&
    !!statuses.data &&
    launchRiskCount === 0 &&
    deletedMods.length === 0 &&
    unpublishedMods.length === 0 &&
    syncedModCount === manifest.data.mods.length;
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

  useEffect(() => {
    if (!launchProfile.data) return;
    setLaunchProfileDraft(launchProfile.data);
  }, [launchProfile.data]);

  useEffect(() => {
    if (!javaChoices.length) return;
    if (javaChoices.some((choice) => choice.id === selectedJavaChoiceId)) return;
    setSelectedJavaChoiceId(javaChoices[0].id);
  }, [javaChoices, selectedJavaChoiceId]);

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
    onSuccess: async (r) => {
      setReport(r);
      const syncHeadSha = pack.data?.head_sha;
      if (syncHeadSha) {
        setLastSyncedCommit(packId, syncHeadSha);
      }
      await Promise.all([
        statuses.refetch(),
        qc.invalidateQueries({ queryKey: ["pack-changelog", packId] }),
      ]);
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
    mutationFn: async (profile: LaunchProfile) => {
      await tauri.setLaunchProfile(packId, profile);
      await tauri.launchPack(packId, instanceName);
    },
    onSuccess: () => toast.success("Prism launched"),
    onError: (e) => toast.error("Launch failed", { description: formatError(e) }),
  });
  const installJava = useMutation({
    mutationFn: ({ major, imageType }: { major: number; imageType: "jre" | "jdk" }) =>
      tauri.installAdoptiumJava(packId, major, imageType),
    onMutate: () => {
      setJavaInstallProgress({
        packId,
        stage: "queued",
        progress: 0,
        currentBytes: null,
        totalBytes: null,
        logLine: null,
      });
      setJavaInstallLogs(["> queue install job"]);
    },
    onSuccess: (runtime) => {
      setLaunchProfileDraft((current) =>
        current
          ? {
              ...current,
              autoJava: false,
              javaPath: runtime.javaPath,
            }
          : current,
      );
      setJavaInstallOpen(false);
      setJavaInstallProgress((current) =>
        current
          ? {
              ...current,
              stage: "done",
              progress: 100,
            }
          : current,
      );
      toast.success("Java installed", { description: runtime.displayName });
    },
    onError: (error) => {
      toast.error("Java install failed", { description: formatError(error) });
    },
  });

  const publishScan = useMutation({
    mutationFn: () => tauri.scanInstancePublish(packId),
    onMutate: () => {
      setPublishOpen(true);
      setPublishReport(null);
      setPublishLogs([]);
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
  const deleteInstanceMod = useMutation({
    mutationFn: (filename: string) => tauri.deleteInstanceMod(packId, filename),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["mod-statuses", packId] });
      toast.success("Local mod deleted");
    },
    onError: (error) => {
      toast.error("Delete failed", { description: formatError(error) });
    },
  });
  const publishPush = useMutation({
    mutationFn: async ({ message, version }: { message: string; version: string }) => {
      setPublishLogs((current) => [...current, "> apply manifest changes"]);
      const applied = await tauri.applyInstancePublish(packId, undefined, version);
      setPublishLogs((current) => [
        ...current,
        `apply done :: ${applied.manifestEntriesWritten} entries / ${applied.repoFilesWritten} repo writes / ${applied.repoFilesRemoved} removals`,
        "> commit + push origin",
      ]);
      const pushed = await tauri.commitAndPushPublish(packId, message);
      setPublishLogs((current) => [
        ...current,
        `push done :: ${pushed.commitSha.slice(0, 10)} via ${pushed.method.toUpperCase()}`,
      ]);
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
      setPublishLogs((current) => [...current, `error :: ${formatError(e)}`]);
      toast.error("Publish push failed", { description: formatError(e) });
    },
  });

  function handleLaunchClick() {
    setLaunchConfirmOpen(true);
  }

  async function handleBrowseJavaPath() {
    try {
      const extension = exeExtension();
      const selected = await open({
        title: "Select Java binary",
        filters: extension ? [{ name: "Executable", extensions: [extension] }] : undefined,
      });
      if (typeof selected !== "string") return;
      setLaunchProfileDraft((current) =>
        current
          ? {
              ...current,
              autoJava: false,
              javaPath: selected,
            }
          : current,
      );
    } catch (error) {
      toast.error("Browse Java failed", { description: formatError(error) });
    }
  }

  function handleUsePrismAutoJava() {
    setLaunchProfileDraft((current) =>
      current
        ? {
            ...current,
            autoJava: true,
            javaPath: null,
          }
        : current,
    );
  }

  function handleOpenJavaInstall() {
    setJavaInstallOpen(true);
  }

  function handleInstallJavaSubmit() {
    const choice = javaChoices.find((item) => item.id === selectedJavaChoiceId);
    if (!choice) return;
    installJava.mutate({ major: choice.major, imageType: choice.imageType });
  }

  function handleLaunchSubmit() {
    if (!launchProfileDraft) return;
    launch.mutate(launchProfileDraft);
  }

  function handleSyncClick() {
    if (unpublishedMods.length > 0) {
      setSyncDeleteConfirmOpen(true);
      return;
    }
    if (alreadySynced) {
      setSyncAlreadySyncedConfirmOpen(true);
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
        publishLogs={publishLogs}
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
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <CardTitle>
                  <Download className="inline size-4" /> MODS
                </CardTitle>
                <CardDescription>
                  {manifest.data.mods.length} entries tracked by manifest
                  {deletedMods.length > 0 ? ` · ${deletedMods.length} deleted in instance` : ""}
                </CardDescription>
              </div>
              {adminMode ? (
                <Button variant="outline" onClick={() => setAddModsOpen(true)}>
                  <Plus /> ADD MODS
                </Button>
              ) : null}
            </div>
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
                      deleting={deleteInstanceMod.isPending}
                      onDelete={() => deleteInstanceMod.mutate(mod.filename)}
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

      <AddModDialog open={addModsOpen} onClose={() => setAddModsOpen(false)} packId={packId} />

      <Dialog open={launchConfirmOpen} onOpenChange={setLaunchConfirmOpen}>
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden max-w-[96vw] sm:max-w-[72rem] xl:max-w-[80rem]">
          <DialogHeader>
            <DialogTitle>LAUNCHER SETUP</DialogTitle>
          </DialogHeader>
          <DialogBody className="min-h-0 overflow-y-auto p-5 xl:p-6">
            {launchProfileDraft ? (
              <LaunchSetupPanel
                packName={manifest.data?.pack.name ?? packId}
                profile={launchProfileDraft}
                packSynced={launchRiskCount === 0}
                launchRiskCount={launchRiskCount}
                onChange={setLaunchProfileDraft}
                onBrowseJavaPath={() => void handleBrowseJavaPath()}
                onUsePrismAutoJava={handleUsePrismAutoJava}
                onOpenJavaInstall={handleOpenJavaInstall}
              />
            ) : (
              <div className="flex items-center gap-3 text-sm text-text-low">
                <Loader2 className="size-4 animate-spin text-brand-core" />
                <span>Loading launcher profile</span>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="px-6 py-4 sm:justify-between">
            <Button variant="secondary" onClick={() => setLaunchConfirmOpen(false)}>
              CLOSE
            </Button>
            <Button
              variant={launchRiskCount > 0 ? "destructive" : "default"}
              onClick={handleLaunchSubmit}
              disabled={launch.isPending || !launchProfileDraft}
            >
              {launch.isPending ? <Loader2 className="animate-spin" /> : <Rocket />}
              {launchRiskCount > 0 ? "LAUNCH ANYWAY" : "LAUNCH"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={javaInstallOpen} onOpenChange={(open) => !installJava.isPending && setJavaInstallOpen(open)}>
        <DialogContent className="max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>INSTALL JAVA</DialogTitle>
            <DialogDescription>
              NeoForge 1.21.1 + Fabric 1.21.1 run on Java 21. Pick managed Adoptium runtime to download.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="p-6">
            <div className="grid gap-3">
              {javaChoices.map((choice) => {
                const selected = selectedJavaChoiceId === choice.id;

                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setSelectedJavaChoiceId(choice.id)}
                    className={cn(
                      "grid gap-2 border px-4 py-4 text-left transition-colors",
                      selected
                        ? "border-brand-core bg-brand-core/10"
                        : "border-line-soft/20 bg-surface-sunken/60 hover:border-brand-core/40 hover:bg-brand-core/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-sm text-text-high">{choice.title}</span>
                        {choice.recommended ? <Badge variant="default">RECOMMENDED</Badge> : null}
                      </div>
                      <span className="font-mono text-xs text-text-low">JAVA {choice.major}</span>
                    </div>
                    <p className="text-sm text-text-low">{choice.detail}</p>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-text-low">
              This downloads Temurin into modsync app data and points launch profile at installed binary. Prism auto mode stays separate.
            </p>
            <div className="mt-4 flex flex-col gap-3 border border-line-soft/20 bg-surface-sunken/60 p-4">
              <div className="flex items-center justify-between gap-3 text-xs text-text-low">
                <span className="font-heading uppercase tracking-[0.18em]">INSTALL PROGRESS</span>
                <span className="font-mono">{javaInstallProgress?.progress ?? 0}%</span>
              </div>
              <div className="h-2 overflow-hidden border border-line-soft/30 bg-surface">
                <div
                  className="h-full bg-brand-core transition-[width] duration-200"
                  style={{ width: `${Math.max(javaInstallProgress?.progress ?? 0, installJava.isPending ? 4 : 0)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px] text-text-low">
                <span>{javaInstallProgress?.stage?.toUpperCase() ?? "IDLE"}</span>
                <span>
                  {javaInstallProgress?.currentBytes != null
                    ? `${formatByteCount(javaInstallProgress.currentBytes)}${javaInstallProgress.totalBytes != null ? ` / ${formatByteCount(javaInstallProgress.totalBytes)}` : ""}`
                    : ""}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto border border-line-soft/20 bg-black/30 p-3 font-mono text-[11px] text-text-low">
                {javaInstallLogs.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {javaInstallLogs.map((line, index) => (
                      <span key={`java-install-log:${index}`}>{line}</span>
                    ))}
                  </div>
                ) : (
                  <span>No install activity yet.</span>
                )}
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="px-6 py-4 sm:justify-between">
            <Button variant="secondary" onClick={() => setJavaInstallOpen(false)} disabled={installJava.isPending}>
              CANCEL
            </Button>
            <Button onClick={handleInstallJavaSubmit} disabled={installJava.isPending || !javaChoices.length}>
              {installJava.isPending ? <Loader2 className="animate-spin" /> : <Download />}
              INSTALL SELECTED JAVA
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

      <Dialog open={syncAlreadySyncedConfirmOpen} onOpenChange={setSyncAlreadySyncedConfirmOpen}>
        <DialogContent className="overflow-hidden max-w-xl">
          <DialogHeader>
            <DialogTitle>INSTANCE ALREADY SYNCED</DialogTitle>
            <DialogDescription>
              Manifest + Prism instance already match. Run sync again only if local state looks wrong and refresh needed.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="p-6">
            <div className="flex flex-col gap-4 text-sm text-text-low">
              <div className="border border-line-soft/30 bg-surface-sunken p-4 font-mono text-[10px] uppercase tracking-[0.18em] text-text-low">
                No missing mods. No outdated mods. No unpublished local files.
              </div>
              <p>Continue for forced resync.</p>
            </div>
          </DialogBody>
          <DialogFooter className="px-6 py-4 sm:justify-between">
            <Button variant="secondary" onClick={() => setSyncAlreadySyncedConfirmOpen(false)}>
              CANCEL
            </Button>
            <Button
              onClick={() => {
                setSyncAlreadySyncedConfirmOpen(false);
                sync.mutate();
              }}
            >
              SYNC AGAIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LaunchSetupPanel({
  packName,
  profile,
  packSynced,
  launchRiskCount,
  onChange,
  onBrowseJavaPath,
  onUsePrismAutoJava,
  onOpenJavaInstall,
}: {
  packName: string;
  profile: LaunchProfile;
  packSynced: boolean;
  launchRiskCount: number;
  onChange: (profile: LaunchProfile) => void;
  onBrowseJavaPath: () => void;
  onUsePrismAutoJava: () => void;
  onOpenJavaInstall: () => void;
}) {
  const sliderValue = [profile.maxMemoryMb];
  const packValue = packSynced ? "SYNCED" : `${launchRiskCount} RISKS`;
  const presets = [
    { label: "LOW", detail: "4 GB / safe baseline", minMemoryMb: 2048, maxMemoryMb: 4096 },
    { label: "MED", detail: "6 GB / default play", minMemoryMb: 3072, maxMemoryMb: 6144 },
    { label: "HIGH", detail: "8 GB / heavy packs", minMemoryMb: 4096, maxMemoryMb: 8192 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <CompactLaunchStat
            icon={<Package className="size-3.5" />}
            label="PACK"
            value={packValue}
            detail={packSynced ? packName : "Sync recommended"}
            tone={packSynced ? "ok" : "warn"}
          />
          <CompactLaunchStat
            icon={<HardDrive className="size-3.5" />}
            label="JAVA"
            value={profile.autoJava ? "AUTO" : profile.javaPath ? "CUSTOM" : "GLOBAL"}
            detail={profile.autoJava ? "Prism auto Java" : profile.javaPath ?? "Prism global Java"}
            tone={profile.autoJava || profile.javaPath ? "ok" : "warn"}
          />
          <CompactLaunchStat
            icon={<MemoryStick className="size-3.5" />}
            label="RAM"
            value={`${Math.round(profile.maxMemoryMb / 1024)} GB`}
            detail={`Min ${profile.minMemoryMb} MiB`}
            tone="ok"
          />
        </CardContent>
      </Card>

      {!packSynced ? (
        <div className="border border-signal-alert/35 bg-signal-alert/8 px-4 py-3 text-sm text-text-low">
          <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-signal-alert">Pack not fully synced</span>
          <p className="mt-1 text-xs">{launchRiskCount} mod{launchRiskCount === 1 ? " is" : "s are"} missing or outdated. Launching may break pack.</p>
        </div>
      ) : null}

      <Card variant="window">
        <CardWindowBar>
          <CardWindowTab>LAUNCH PROFILE</CardWindowTab>
          <CardStatus>{profile.autoJava ? "Auto Java" : "Manual Java"}</CardStatus>
        </CardWindowBar>
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[16rem_minmax(0,1.1fr)_minmax(20rem,0.95fr)] xl:gap-6 xl:p-6">
          <div className="flex flex-col gap-3 border border-line-soft/20 bg-surface-sunken/60 p-4">
            <div>
              <Label>PRESETS</Label>
              <p className="mt-1 text-xs text-text-low">Quick memory profiles for common pack sizes.</p>
            </div>
            <div className="grid gap-2">
              {presets.map((preset) => {
                const active = profile.maxMemoryMb === preset.maxMemoryMb && profile.minMemoryMb === preset.minMemoryMb;

                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...profile,
                        minMemoryMb: preset.minMemoryMb,
                        maxMemoryMb: preset.maxMemoryMb,
                      })
                    }
                    className={cn(
                      "flex items-center justify-between border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-brand-core bg-brand-core/10 text-brand-core"
                        : "border-line-soft/20 bg-surface/70 text-text-high hover:border-brand-core/40 hover:bg-brand-core/5",
                    )}
                  >
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em]">{preset.label}</p>
                      <p className="text-[11px] text-text-low">{preset.detail}</p>
                    </div>
                    <span className="font-mono text-xs">{Math.round(preset.maxMemoryMb / 1024)}G</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <Label>MAX RAM</Label>
                <span className="font-mono text-xs text-text-low">{profile.maxMemoryMb} MiB</span>
              </div>
              <Slider
                value={sliderValue}
                min={2048}
                max={16384}
                step={256}
                onValueChange={(value) => {
                  const nextValue = Array.isArray(value) ? value[0] : value;
                  const maxMemoryMb = nextValue ?? profile.maxMemoryMb;
                  onChange({
                    ...profile,
                    maxMemoryMb,
                    minMemoryMb: Math.min(profile.minMemoryMb, maxMemoryMb),
                  });
                }}
              >
                <SliderControl>
                  <SliderTrack>
                    <SliderIndicator />
                  </SliderTrack>
                  <SliderThumb />
                </SliderControl>
              </Slider>
              <p className="text-xs text-text-low">Launcher writes Prism `MaxMemAlloc` + `MinMemAlloc` overrides.</p>
            </div>

            <div className="flex flex-col gap-3">
              <Label htmlFor="extra-jvm-args">EXTRA JVM ARGS</Label>
              <Textarea
                id="extra-jvm-args"
                value={profile.extraJvmArgs}
                onChange={(event) => onChange({ ...profile, extraJvmArgs: event.target.value })}
                placeholder="-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions"
                className="min-h-24 font-mono text-xs"
              />
              <p className="text-xs text-text-low">Do not put `-Xmx` / `-Xms` here. Memory slider owns those.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 border border-line-soft/20 bg-surface-sunken/60 p-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="java-path">JAVA PATH</Label>
              <Input
                id="java-path"
                value={profile.javaPath ?? ""}
                onChange={(event) =>
                  onChange({
                    ...profile,
                    autoJava: false,
                    javaPath: event.target.value,
                  })
                }
                placeholder="/path/to/java or javaw.exe"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onBrowseJavaPath}>
                  <Settings2 className="size-4" /> BROWSE JAVA
                </Button>
                <Button variant="outline" onClick={onUsePrismAutoJava}>
                  <HardDrive className="size-4" /> USE PRISM AUTO
                </Button>
                <Button variant="outline" onClick={onOpenJavaInstall}>
                  <Download className="size-4" /> INSTALL JAVA
                </Button>
              </div>
              <p className="text-xs text-text-low">
                Prism auto mode resolves managed compatible Java. Install dialog downloads Temurin runtime into modsync.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Row k="MIN RAM" v={`${profile.minMemoryMb} MiB`} />
              <Row k="AUTO JAVA" v={profile.autoJava ? "ON" : "OFF"} />
              <Row k="JVM ARGS" v={profile.extraJvmArgs.trim() ? "CUSTOM" : "DEFAULT"} />
              <Row k="PACK" v={packSynced ? "SYNCED" : "CHECK SYNC"} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CompactLaunchStat({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "ok" | "warn";
}) {
  return (
    <div className="flex items-start gap-3 border border-line-soft/20 bg-surface-sunken/50 px-3 py-3">
      <div className={cn("mt-0.5", tone === "ok" ? "text-brand-core" : "text-signal-alert")}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-text-low">{label}</p>
        <p className={cn("mt-1 text-sm leading-none", tone === "ok" ? "text-brand-core" : "text-signal-alert")}>{value}</p>
        <p className="mt-1 truncate text-[11px] text-text-low">{detail}</p>
      </div>
    </div>
  );
}

type JavaInstallChoice = {
  id: string;
  major: number;
  imageType: "jre" | "jdk";
  title: string;
  detail: string;
  recommended: boolean;
};

function formatByteCount(value: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return unitIndex === 0 ? `${Math.round(size)} ${units[unitIndex]}` : `${size.toFixed(1)} ${units[unitIndex]}`;
}

function getJavaInstallChoices(mcVersion?: string, loader?: Loader): JavaInstallChoice[] {
  const requiredMajor = mcVersion?.startsWith("1.21") ? 21 : 17;
  const loaderLabel = loader ? loader.toUpperCase() : "PACK";

  return [
    {
      id: `temurin-${requiredMajor}-jre`,
      major: requiredMajor,
      imageType: "jre",
      title: `Temurin ${requiredMajor} JRE`,
      detail: `${loaderLabel} ${mcVersion ?? "runtime"} recommended pick. Smallest install for play.`,
      recommended: true,
    },
    {
      id: `temurin-${requiredMajor}-jdk`,
      major: requiredMajor,
      imageType: "jdk",
      title: `Temurin ${requiredMajor} JDK`,
      detail: `Same Java ${requiredMajor}, but with full JDK tools bundled.`,
      recommended: false,
    },
    {
      id: "temurin-17-jre",
      major: 17,
      imageType: "jre",
      title: "Temurin 17 JRE",
      detail: requiredMajor === 21 ? "Legacy fallback only. Not recommended for Minecraft 1.21.1 packs." : "Legacy runtime for older packs.",
      recommended: false,
    },
  ];
}

function PublishPreviewPage({
  packId,
  onClose,
  pending,
  report,
  publishing,
  publishLogs,
  onPublish,
}: {
  packId: string;
  onClose: () => void;
  pending: boolean;
  report: PublishScanReport | null;
  publishing: boolean;
  publishLogs: string[];
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

          {publishLogs.length > 0 ? (
            <Card variant="window">
              <CardWindowBar>
                <CardWindowTab>PUBLISH TERMINAL</CardWindowTab>
                <CardStatus>{publishing ? "Streaming" : "Idle"}</CardStatus>
              </CardWindowBar>
              <CardContent className="px-0 py-0">
                <ScrollArea className="h-56 px-4 py-4">
                  <div className="flex flex-col gap-2 font-mono text-xs text-text-low">
                    {publishLogs.map((line, index) => (
                      <p key={`${line}-${index}`}>{line}</p>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="justify-between bg-surface-panel-strong/40 py-2 text-[10px] uppercase tracking-[0.18em] text-text-low">
                <span>{publishing ? "Commit in progress" : "Last run complete"}</span>
                <span>{publishLogs.length} lines</span>
              </CardFooter>
            </Card>
          ) : null}

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

function AddModDialog({
  open,
  onClose,
  packId,
}: {
  open: boolean;
  onClose: () => void;
  packId: string;
}) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [selectedSide, setSelectedSide] = useState<"client" | "server" | "both">("client");
  const preview = useMutation({
    mutationFn: (identifier: string) => tauri.previewModrinthMod(packId, identifier),
    onSuccess: (data) => setSelectedSide(data.suggestedSide),
  });
  const addMod = useMutation({
    mutationFn: (payload: { projectId: string; versionId: string; side: "client" | "server" | "both" }) =>
      tauri.addModrinthMod(packId, payload.projectId, payload.versionId, payload.side),
    onSuccess: async (entry) => {
      await qc.invalidateQueries({ queryKey: ["mod-statuses", packId] });
      toast.success("Mod staged", { description: entry.filename });
      handleClose();
    },
    onError: (error) => {
      toast.error("Add mod failed", { description: formatError(error) });
    },
  });

  function handleClose() {
    setInput("");
    setSelectedSide("client");
    preview.reset();
    addMod.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>ADD MODRINTH MOD</DialogTitle>
          <DialogDescription>
            Paste Modrinth link, slug, or project id. Mod downloads into instance first and stays unpublished until publish.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-3">
            <Label htmlFor="modrinth-link">MODRINTH SOURCE</Label>
            <div className="flex gap-3">
              <Input
                id="modrinth-link"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="https://modrinth.com/mod/... or slug"
              />
              <Button
                variant="outline"
                onClick={() => preview.mutate(input.trim())}
                disabled={!input.trim() || preview.isPending || addMod.isPending}
              >
                {preview.isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
                RESOLVE
              </Button>
            </div>
            {preview.error ? (
              <p className="text-sm text-signal-alert">{formatError(preview.error)}</p>
            ) : null}
          </div>

          {preview.data ? (
            <ResolvedModPreview preview={preview.data} selectedSide={selectedSide} onSideChange={setSelectedSide} />
          ) : (
            <div className="border border-line-soft/20 bg-surface-sunken px-4 py-6 text-sm text-text-low">
              Resolve Modrinth project first.
            </div>
          )}
        </DialogBody>
        <DialogFooter className="px-6 py-4 sm:justify-between">
          <Button variant="secondary" onClick={handleClose} disabled={addMod.isPending}>
            CANCEL
          </Button>
          <Button
            onClick={() =>
              preview.data &&
              addMod.mutate({
                projectId: preview.data.projectId,
                versionId: preview.data.versionId,
                side: selectedSide,
              })
            }
            disabled={!preview.data || preview.data.alreadyTracked || addMod.isPending}
          >
            {addMod.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            {preview.data?.alreadyTracked ? "ALREADY TRACKED" : "DOWNLOAD TO INSTANCE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolvedModPreview({
  preview,
  selectedSide,
  onSideChange,
}: {
  preview: ModrinthAddPreview;
  selectedSide: "client" | "server" | "both";
  onSideChange: (value: "client" | "server" | "both") => void;
}) {
  return (
    <Card variant="window">
      <CardWindowBar>
        <CardWindowTab>MODRINTH PREVIEW</CardWindowTab>
      </CardWindowBar>
      <CardContent className="flex flex-col gap-5 py-4">
        <div className="flex items-start gap-4">
          <div className="flex size-14 items-center justify-center overflow-hidden border border-line-soft/30 bg-surface-base">
            {preview.iconUrl ? (
              <img src={preview.iconUrl} alt="" className="size-full object-cover" loading="lazy" />
            ) : (
              <Package className="size-5 text-text-low" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-base text-text-high">{preview.title}</p>
            <p className="font-mono text-[10px] text-text-low">{preview.filename}</p>
            <p className="text-xs text-text-low">{preview.versionNumber}</p>
            {preview.description ? (
              <p className="line-clamp-3 text-xs text-text-low">{preview.description}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="grid gap-2 text-xs">
            <Row k="PROJECT" v={preview.slug} />
            <Row k="SIZE" v={formatBytes(preview.size)} />
            <Row k="VERSION" v={preview.versionNumber} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mod-side">SIDE</Label>
            <Select value={selectedSide} onValueChange={(value) => onSideChange(value as "client" | "server" | "both") }>
              <SelectTrigger id="mod-side">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">CLIENT</SelectItem>
                <SelectItem value="server">SERVER</SelectItem>
                <SelectItem value="both">BOTH</SelectItem>
              </SelectContent>
            </Select>
            {preview.alreadyTracked ? (
              <p className="text-xs text-signal-warn">Already tracked in manifest. Add disabled.</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
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

function UnpublishedModRow({
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
