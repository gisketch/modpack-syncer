import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { exeExtension } from "@tauri-apps/plugin-os";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  FolderGit2,
  FolderOpen,
  Loader2,
  Package,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  SlidersHorizontal,
  UploadCloudIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PackIcon } from "@/components/pack-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildArtifactStatusMap,
  DeletedModRow,
  ModRow,
  UnpublishedModRow,
} from "@/features/packs/artifact-status/artifact-status-rows";
import { formatChangelogSummary } from "@/features/packs/changelog/changelog-card";
import { ChangelogDialog } from "@/features/packs/changelog/changelog-dialog";
import {
  formatByteCount,
  getJavaInstallChoices,
  LaunchSetupPanel,
} from "@/features/packs/launch-profile/launch-setup-panel";
import {
  AddModrinthEntryDialog,
  describeArtifactCategory,
} from "@/features/packs/modrinth-admin/add-modrinth-entry-dialog";
import { OptionPresetBuilderDialog } from "@/features/packs/presets/option-preset-builder-dialog";
import { PublishPreviewPage } from "@/features/packs/publish-preview/publish-preview-page";
import {
  buildSyncReviewTabs,
  buildSyncSummary,
} from "@/features/packs/sync-review/sync-artifact-preview";
import { SyncDialog } from "@/features/packs/sync-review/sync-dialog";
import { SyncReviewDialog } from "@/features/packs/sync-review/sync-review-dialog";
import { formatError } from "@/lib/format-error";
import { useModrinthProjects } from "@/lib/modrinth";
import {
  type JavaInstallProgressEvent,
  type LaunchProfile,
  type ManifestArtifactCategory,
  type ModStatusValue,
  PACK_DEFAULT_PRESET_ID,
  type PublishScanReport,
  type SyncInstanceReport,
  type SyncProgressEvent,
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
  const selectedOptionPresetId = useAppStore(
    (s) => s.selectedOptionPresetByPack[packId] ?? PACK_DEFAULT_PRESET_ID,
  );
  const setLastSyncedCommit = useAppStore((s) => s.setLastSyncedCommit);
  const setSelectedOptionPreset = useAppStore((s) => s.setSelectedOptionPreset);

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
  const [javaInstallProgress, setJavaInstallProgress] = useState<JavaInstallProgressEvent | null>(
    null,
  );
  const [javaInstallLogs, setJavaInstallLogs] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [presetBuilderOpen, setPresetBuilderOpen] = useState(false);
  const [addEntryDialogOpen, setAddEntryDialogOpen] = useState(false);
  const [addEntryCategory, setAddEntryCategory] = useState<ManifestArtifactCategory>("mods");
  const [syncReviewOpen, setSyncReviewOpen] = useState(false);
  const [syncReviewStep, setSyncReviewStep] = useState<"artifacts" | "options">("artifacts");
  const [shaderSyncDecision, setShaderSyncDecision] = useState<"undecided" | "sync" | "skip">(
    "undecided",
  );
  const [pendingShaderSync, setPendingShaderSync] = useState(false);
  const [pendingOptionPresetId, setPendingOptionPresetId] = useState(PACK_DEFAULT_PRESET_ID);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncDeleteConfirmOpen, setSyncDeleteConfirmOpen] = useState(false);
  const [syncAlreadySyncedConfirmOpen, setSyncAlreadySyncedConfirmOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [activeChangelogIndex, setActiveChangelogIndex] = useState(0);
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
  const artifactPublishScan = useQuery({
    queryKey: ["artifact-publish-scan", packId],
    queryFn: () => tauri.scanInstancePublish(packId),
    enabled: !!manifest.data && !!instanceDir.data,
    retry: false,
  });
  const hasTrackedOptionsFile = hasTrackedOptionsPreset(artifactPublishScan.data);
  const optionsSyncPreview = useQuery({
    queryKey: ["options-sync-preview", packId, selectedOptionPresetId],
    queryFn: () => tauri.previewOptionsSync(packId, undefined, selectedOptionPresetId),
    enabled: syncReviewOpen && !!instanceDir.data,
    retry: false,
  });
  const shaderSettingsPreview = useQuery({
    queryKey: ["shader-settings-preview", packId, selectedOptionPresetId],
    queryFn: () => tauri.previewShaderSettingsSync(packId, undefined, selectedOptionPresetId),
    enabled: syncReviewOpen && !!instanceDir.data,
    retry: false,
  });
  const optionPresets = useQuery({
    queryKey: ["option-presets", packId],
    queryFn: () => tauri.listOptionPresets(packId),
    enabled: !!manifest.data,
    retry: false,
  });
  const hasOptionsReviewSource =
    hasTrackedOptionsFile ||
    selectedOptionPresetId !== PACK_DEFAULT_PRESET_ID ||
    (optionPresets.data?.length ?? 0) > 0;
  const changelog = useQuery({
    queryKey: ["pack-changelog", packId, lastSyncedCommit],
    queryFn: () => tauri.packChangelog(packId, 12),
    retry: false,
  });
  const launchProfile = useQuery({
    queryKey: ["launch-profile", packId],
    queryFn: () => tauri.getLaunchProfile(packId),
    retry: false,
  });
  const setOptionsSyncIgnored = useMutation({
    mutationFn: ({ key, ignored }: { key: string; ignored: boolean }) =>
      tauri.setOptionsSyncIgnored(packId, key, ignored),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["options-sync-preview", packId] });
    },
    onError: (error) => {
      toast.error("Ignore update failed", { description: formatError(error) });
    },
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
  const unpublishedResourcepacks = (artifactPublishScan.data?.items ?? [])
    .filter((item) => item.category === "resourcepacks" && item.action === "add")
    .map((item) => ({
      id: null,
      filename: item.relativePath,
      size: item.size ?? null,
      status: "unpublished" as const,
    }))
    .sort((left, right) => left.filename.localeCompare(right.filename));
  const unpublishedShaderpacks = (artifactPublishScan.data?.items ?? [])
    .filter((item) => item.category === "shaderpacks" && item.action === "add")
    .map((item) => ({
      id: null,
      filename: item.relativePath,
      size: item.size ?? null,
      status: "unpublished" as const,
    }))
    .sort((left, right) => left.filename.localeCompare(right.filename));
  const resourcepackStatusMap = buildArtifactStatusMap(artifactPublishScan.data, "resourcepacks");
  const shaderpackStatusMap = buildArtifactStatusMap(artifactPublishScan.data, "shaderpacks");
  const launchRiskCount = (statuses.data ?? []).filter(
    (s) => s.status === "missing" || s.status === "outdated",
  ).length;
  const resourcepackRiskCount = manifest.data
    ? manifest.data.resourcepacks.filter(
        (entry) => resourcepackStatusMap.get(entry.filename) !== "synced",
      ).length
    : 0;
  const shaderpackRiskCount = manifest.data
    ? manifest.data.shaderpacks.filter(
        (entry) => shaderpackStatusMap.get(entry.filename) !== "synced",
      ).length
    : 0;
  const stagedArtifactCount =
    unpublishedMods.length + unpublishedResourcepacks.length + unpublishedShaderpacks.length;
  const javaChoices = getJavaInstallChoices(
    manifest.data?.pack.mcVersion,
    manifest.data?.pack.loader,
  );
  const syncedModCount = (statuses.data ?? []).filter((s) => s.status === "synced").length;
  const alreadySynced =
    !!manifest.data &&
    !!statuses.data &&
    launchRiskCount === 0 &&
    resourcepackRiskCount === 0 &&
    shaderpackRiskCount === 0 &&
    deletedMods.length === 0 &&
    stagedArtifactCount === 0 &&
    syncedModCount === manifest.data.mods.length;
  const syncSummary = buildSyncSummary(artifactPublishScan.data);
  const syncReviewTabs = buildSyncReviewTabs(artifactPublishScan.data);
  const syncReviewDefaultTab = syncReviewTabs.find((tab) => tab.count > 0)?.id ?? "mods";
  const newUpdateCount = (() => {
    const entries = changelog.data ?? [];
    if (entries.length === 0) return 0;
    if (!lastSyncedCommit) return 1;

    const syncedIndex = entries.findIndex((entry) => entry.commitSha === lastSyncedCommit);
    if (syncedIndex === 0) return 0;
    if (syncedIndex > 0) return syncedIndex;
    return entries.length;
  })();
  const changelogResetKey = `${packId}:${changelog.data?.length ?? 0}:${lastSyncedCommit ?? ""}`;

  useEffect(() => {
    void changelogResetKey;
    setActiveChangelogIndex(0);
  }, [changelogResetKey]);

  useEffect(() => {
    if (!launchProfile.data) return;
    setLaunchProfileDraft(launchProfile.data);
  }, [launchProfile.data]);

  useEffect(() => {
    if (!javaChoices.length) return;
    if (javaChoices.some((choice) => choice.id === selectedJavaChoiceId)) return;
    setSelectedJavaChoiceId(javaChoices[0].id);
  }, [javaChoices, selectedJavaChoiceId]);

  const modrinthMap = useModrinthProjects(
    manifest.data
      ? [...manifest.data.mods, ...manifest.data.resourcepacks, ...manifest.data.shaderpacks]
      : [],
  );
  const activeChangelogEntry = changelog.data?.[activeChangelogIndex] ?? null;
  const progressEntry = progress?.filename
    ? ([
        ...(manifest.data?.mods ?? []),
        ...(manifest.data?.resourcepacks ?? []),
        ...(manifest.data?.shaderpacks ?? []),
      ].find((entry) => entry.filename === progress.filename) ?? null)
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
        qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] }),
        qc.invalidateQueries({ queryKey: ["options-sync-preview", packId] }),
        qc.invalidateQueries({ queryKey: ["shader-settings-preview", packId] }),
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
    mutationFn: ({
      syncShaderSettings,
      optionPresetId,
    }: {
      syncShaderSettings: boolean;
      optionPresetId: string;
    }) => tauri.syncInstance(packId, undefined, syncShaderSettings, optionPresetId),
    onMutate: () => {
      setSyncOpen(true);
      setProgress({
        packId,
        status: "downloading",
        filename: null,
        completed: 0,
        total:
          (manifest.data?.mods.length ?? 0) +
          (manifest.data?.resourcepacks.length ?? 0) +
          (manifest.data?.shaderpacks.length ?? 0),
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
        qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] }),
        qc.invalidateQueries({ queryKey: ["options-sync-preview", packId] }),
        qc.invalidateQueries({ queryKey: ["shader-settings-preview", packId] }),
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
  const showJavaInstallProgress = installJava.isPending;

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
  const deleteInstanceArtifact = useMutation({
    mutationFn: ({
      filename,
      category,
    }: {
      filename: string;
      category: ManifestArtifactCategory;
    }) => tauri.deleteInstanceMod(packId, filename, category),
    onSuccess: async (_, variables) => {
      if (variables.category === "mods") {
        await qc.invalidateQueries({ queryKey: ["mod-statuses", packId] });
      } else {
        await qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] });
      }
      await qc.invalidateQueries({ queryKey: ["options-sync-preview", packId] });
      await qc.invalidateQueries({ queryKey: ["shader-settings-preview", packId] });
      toast.success(
        `Local ${describeArtifactCategory(variables.category).singular.toLowerCase()} deleted`,
      );
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
        qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] }),
        qc.invalidateQueries({ queryKey: ["options-sync-preview", packId] }),
        qc.invalidateQueries({ queryKey: ["shader-settings-preview", packId] }),
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
    setSyncReviewStep("artifacts");
    setShaderSyncDecision("undecided");
    setPendingShaderSync(false);
    setPendingOptionPresetId(selectedOptionPresetId);
    setSyncReviewOpen(true);
  }

  function handleCloseSyncReview() {
    setSyncReviewOpen(false);
    setSyncReviewStep("artifacts");
    setShaderSyncDecision("undecided");
    setPendingShaderSync(false);
    setPendingOptionPresetId(PACK_DEFAULT_PRESET_ID);
  }

  function handleSyncReviewNext() {
    setSyncReviewStep("options");
  }

  function handleConfirmSyncFromReview() {
    const applyShaderSettings = shaderSettingsPreview.data?.requiresDecision
      ? shaderSyncDecision === "sync"
      : false;
    handleCloseSyncReview();
    setPendingShaderSync(applyShaderSettings);
    setPendingOptionPresetId(selectedOptionPresetId);
    if (unpublishedMods.length > 0) {
      setSyncDeleteConfirmOpen(true);
      return;
    }
    if (alreadySynced) {
      setSyncAlreadySyncedConfirmOpen(true);
      return;
    }
    sync.mutate({
      syncShaderSettings: applyShaderSettings,
      optionPresetId: selectedOptionPresetId,
    });
  }

  function handleOpenAddEntry(category: ManifestArtifactCategory) {
    setAddEntryCategory(category);
    setAddEntryDialogOpen(true);
  }

  async function handleOpenInstanceFolder() {
    if (!instanceDir.data) return;
    try {
      await revealItemInDir(instanceDir.data);
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

      <header className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <PackIcon
            iconUrl={manifest.data?.pack.icon}
            name={manifest.data?.pack.name ?? packId}
            className="size-20 shrink-0"
            fallbackClassName="size-8"
          />
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-3xl text-text-high [text-wrap:balance]">
              {manifest.data?.pack.name ?? packId}
            </h1>
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
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
          {adminMode && (
            <Button
              variant="outline"
              onClick={() => setPresetBuilderOpen(true)}
              disabled={!instanceDir.data || sync.isPending || fetchPack.isPending}
            >
              <SlidersHorizontal />
              PRESETS
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
            Wrote {report.instance.mods_written} mods, {report.instance.resourcepacks_written}{" "}
            resourcepacks, {report.instance.shaderpacks_written} shaderpacks,{" "}
            {report.instance.overrides_copied} overrides. Cached {report.fetch.cached} / downloaded{" "}
            {report.fetch.downloaded} / total {report.fetch.total}.
            {report.fetch.failures.length > 0 && (
              <span className="block text-signal-alert">
                {report.fetch.failures.length} failures
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Button
        variant="outline"
        onClick={() => setChangelogOpen(true)}
        className={cn(
          "h-auto w-full justify-between gap-4 px-5 py-4 text-left text-text-high",
          newUpdateCount > 0 &&
            "border-brand-core/35 bg-brand-core/10 shadow-[0_0_24px_rgba(84,208,150,0.16)] hover:border-brand-core/45 hover:bg-brand-core/14 hover:text-text-high",
        )}
      >
        <div className="flex flex-col items-start gap-1">
          <span
            className={cn(
              "cp-tactical-label text-[10px]",
              newUpdateCount > 0 ? "text-brand-core" : "text-text-low",
            )}
          >
            PACK UPDATES
          </span>
          <span className="text-sm text-text-low">View what changed since last sync</span>
        </div>
        <div className="flex items-center gap-3">
          {newUpdateCount > 0 && !changelog.isLoading ? (
            <span className="size-2 shrink-0 rounded-full bg-brand-core shadow-[0_0_12px_rgba(84,208,150,0.65)]" />
          ) : null}
          <span
            className={cn(
              "text-right text-[10px] uppercase tracking-[0.18em]",
              newUpdateCount > 0 ? "text-brand-core" : "text-text-low",
            )}
          >
            {changelog.isLoading
              ? "LOADING"
              : formatChangelogSummary(newUpdateCount, changelog.data?.length ?? 0)}
          </span>
          {changelog.isLoading ? (
            <Loader2 className="size-4 animate-spin text-brand-core" />
          ) : (
            <ChevronRight
              className={cn("size-4", newUpdateCount > 0 ? "text-brand-core" : "text-text-low")}
            />
          )}
        </div>
      </Button>

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
                <Button variant="outline" onClick={() => handleOpenAddEntry("mods")}>
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
                      deleting={deleteInstanceArtifact.isPending}
                      onDelete={() =>
                        deleteInstanceArtifact.mutate({ filename: mod.filename, category: "mods" })
                      }
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

      {manifest.data && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <CardTitle>
                  <Download className="inline size-4" /> RESOURCEPACKS
                </CardTitle>
                <CardDescription>
                  {manifest.data.resourcepacks.length} entries tracked by manifest
                  {unpublishedResourcepacks.length > 0
                    ? ` · ${unpublishedResourcepacks.length} staged locally`
                    : ""}
                </CardDescription>
              </div>
              {adminMode ? (
                <Button variant="outline" onClick={() => handleOpenAddEntry("resourcepacks")}>
                  <Plus /> ADD RESOURCEPACK
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[320px]">
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
                  {unpublishedResourcepacks.map((entry) => (
                    <UnpublishedModRow
                      key={`unpublished-resourcepack:${entry.filename}`}
                      mod={entry}
                      adminMode={adminMode}
                      deleting={deleteInstanceArtifact.isPending}
                      onDelete={() =>
                        deleteInstanceArtifact.mutate({
                          filename: entry.filename,
                          category: "resourcepacks",
                        })
                      }
                    />
                  ))}
                  {manifest.data.resourcepacks.map((entry) => (
                    <ModRow
                      key={entry.id}
                      entry={entry}
                      icon={
                        entry.source === "modrinth" && entry.projectId
                          ? (modrinthMap.get(entry.projectId)?.icon_url ?? null)
                          : null
                      }
                      title={
                        entry.source === "modrinth" && entry.projectId
                          ? (modrinthMap.get(entry.projectId)?.title ?? null)
                          : null
                      }
                      status={resourcepackStatusMap.get(entry.filename) ?? null}
                      loading={artifactPublishScan.isLoading || artifactPublishScan.isFetching}
                    />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {manifest.data && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <CardTitle>
                  <Download className="inline size-4" /> SHADERPACKS
                </CardTitle>
                <CardDescription>
                  {manifest.data.shaderpacks.length} entries tracked by manifest
                  {unpublishedShaderpacks.length > 0
                    ? ` · ${unpublishedShaderpacks.length} staged locally`
                    : ""}
                </CardDescription>
              </div>
              {adminMode ? (
                <Button variant="outline" onClick={() => handleOpenAddEntry("shaderpacks")}>
                  <Plus /> ADD SHADERPACK
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[320px]">
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
                  {unpublishedShaderpacks.map((entry) => (
                    <UnpublishedModRow
                      key={`unpublished-shaderpack:${entry.filename}`}
                      mod={entry}
                      adminMode={adminMode}
                      deleting={deleteInstanceArtifact.isPending}
                      onDelete={() =>
                        deleteInstanceArtifact.mutate({
                          filename: entry.filename,
                          category: "shaderpacks",
                        })
                      }
                    />
                  ))}
                  {manifest.data.shaderpacks.map((entry) => (
                    <ModRow
                      key={entry.id}
                      entry={entry}
                      icon={
                        entry.source === "modrinth" && entry.projectId
                          ? (modrinthMap.get(entry.projectId)?.icon_url ?? null)
                          : null
                      }
                      title={
                        entry.source === "modrinth" && entry.projectId
                          ? (modrinthMap.get(entry.projectId)?.title ?? null)
                          : null
                      }
                      status={shaderpackStatusMap.get(entry.filename) ?? null}
                      loading={artifactPublishScan.isLoading || artifactPublishScan.isFetching}
                    />
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

      <SyncReviewDialog
        open={syncReviewOpen}
        step={syncReviewStep}
        artifactLoading={artifactPublishScan.isLoading || artifactPublishScan.isFetching}
        syncSummary={syncSummary}
        syncReviewTabs={syncReviewTabs}
        defaultTab={syncReviewDefaultTab}
        hasTrackedOptionsFile={hasOptionsReviewSource}
        optionsPreview={optionsSyncPreview.data}
        optionsLoading={optionsSyncPreview.isLoading || optionsSyncPreview.isFetching}
        optionsError={optionsSyncPreview.error}
        onToggleIgnore={(key, ignored) => setOptionsSyncIgnored.mutate({ key, ignored })}
        togglingIgnore={setOptionsSyncIgnored.isPending}
        shaderPreview={shaderSettingsPreview.data}
        shaderLoading={shaderSettingsPreview.isLoading || shaderSettingsPreview.isFetching}
        shaderError={shaderSettingsPreview.error}
        shaderDecision={shaderSyncDecision}
        onShaderDecisionChange={setShaderSyncDecision}
        optionPresets={optionPresets.data ?? []}
        selectedOptionPresetId={selectedOptionPresetId}
        onOptionPresetChange={(presetId) => setSelectedOptionPreset(packId, presetId)}
        syncPending={sync.isPending}
        onClose={handleCloseSyncReview}
        onNext={handleSyncReviewNext}
        onBack={() => setSyncReviewStep("artifacts")}
        onConfirm={handleConfirmSyncFromReview}
      />

      <AddModrinthEntryDialog
        open={addEntryDialogOpen}
        onClose={() => setAddEntryDialogOpen(false)}
        packId={packId}
        category={addEntryCategory}
      />

      <OptionPresetBuilderDialog
        packId={packId}
        open={presetBuilderOpen}
        onOpenChange={setPresetBuilderOpen}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["option-presets", packId] });
          void qc.invalidateQueries({ queryKey: ["options-sync-preview", packId] });
          void qc.invalidateQueries({ queryKey: ["shader-settings-preview", packId] });
        }}
      />

      <ChangelogDialog
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
        loading={changelog.isLoading}
        entry={activeChangelogEntry ?? null}
        entryIndex={activeChangelogIndex}
        entryCount={changelog.data?.length ?? 0}
        newUpdateCount={newUpdateCount}
        onPrevious={() => setActiveChangelogIndex((current) => Math.max(current - 1, 0))}
        onNext={() =>
          setActiveChangelogIndex((current) =>
            Math.min(current + 1, (changelog.data?.length ?? 1) - 1),
          )
        }
      />

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

      <Dialog
        open={javaInstallOpen}
        onOpenChange={(open) => !installJava.isPending && setJavaInstallOpen(open)}
      >
        <DialogContent className="max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>INSTALL JAVA</DialogTitle>
            <DialogDescription>
              {showJavaInstallProgress
                ? "Downloading managed Adoptium runtime now."
                : "NeoForge 1.21.1 + Fabric 1.21.1 run on Java 21. Pick managed Adoptium runtime to download."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="p-6">
            {showJavaInstallProgress ? (
              <div className="flex flex-col gap-3 border border-line-soft/20 bg-surface-sunken/60 p-4">
                <div className="flex items-center justify-between gap-3 text-xs text-text-low">
                  <span className="font-heading uppercase tracking-[0.18em]">INSTALL PROGRESS</span>
                  <span className="font-mono">{javaInstallProgress?.progress ?? 0}%</span>
                </div>
                <div className="h-2 overflow-hidden border border-line-soft/30 bg-surface">
                  <div
                    className="h-full bg-brand-core transition-[width] duration-200"
                    style={{ width: `${Math.max(javaInstallProgress?.progress ?? 0, 4)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-[11px] text-text-low">
                  <span>{javaInstallProgress?.stage?.toUpperCase() ?? "QUEUED"}</span>
                  <span>
                    {javaInstallProgress?.currentBytes != null
                      ? `${formatByteCount(javaInstallProgress.currentBytes)}${javaInstallProgress.totalBytes != null ? ` / ${formatByteCount(javaInstallProgress.totalBytes)}` : ""}`
                      : ""}
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto border border-line-soft/20 bg-black/30 p-3 font-mono text-[11px] text-text-low">
                  {javaInstallLogs.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {javaInstallLogs.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                  ) : (
                    <span>Waiting for install output...</span>
                  )}
                </div>
              </div>
            ) : (
              <>
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
                            <span className="font-heading text-sm text-text-high">
                              {choice.title}
                            </span>
                            {choice.recommended ? (
                              <Badge variant="default">RECOMMENDED</Badge>
                            ) : null}
                          </div>
                          <span className="font-mono text-xs text-text-low">
                            JAVA {choice.major}
                          </span>
                        </div>
                        <p className="text-sm text-text-low">{choice.detail}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs text-text-low">
                  This downloads Temurin into modsync app data and points launch profile at
                  installed binary. Prism auto mode stays separate.
                </p>
              </>
            )}
          </DialogBody>
          <DialogFooter className="px-6 py-4 sm:justify-between">
            <Button
              variant="secondary"
              onClick={() => setJavaInstallOpen(false)}
              disabled={installJava.isPending}
            >
              CANCEL
            </Button>
            <Button
              onClick={handleInstallJavaSubmit}
              disabled={installJava.isPending || !javaChoices.length}
            >
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
              Sync keeps Prism instance 1:1 with source. Files below exist only in local mods folder
              and will be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="p-6">
            <div className="flex flex-col gap-4 text-sm text-text-low">
              <div className="flex flex-col gap-2 border border-line-soft/30 bg-surface-sunken p-4">
                {unpublishedMods.map((mod) => (
                  <p
                    key={`sync-delete:${mod.filename}`}
                    className="font-mono text-xs text-signal-alert"
                  >
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
                sync.mutate({
                  syncShaderSettings: pendingShaderSync,
                  optionPresetId: pendingOptionPresetId,
                });
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
              Manifest + Prism instance already match. Run sync again only if local state looks
              wrong and refresh needed.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="p-6">
            <div className="flex flex-col gap-4 text-sm text-text-low">
              <div className="border border-line-soft/30 bg-surface-sunken p-4 font-mono text-[10px] uppercase tracking-[0.18em] text-text-low">
                No missing mods. No outdated mods. No missing resourcepacks. No missing shaderpacks.
                No unpublished local files.
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
                sync.mutate({
                  syncShaderSettings: pendingShaderSync,
                  optionPresetId: pendingOptionPresetId,
                });
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

function hasTrackedOptionsPreset(report: PublishScanReport | null | undefined) {
  return (report?.items ?? []).some(
    (item) => item.category === "root" && item.relativePath === "options.txt",
  );
}
