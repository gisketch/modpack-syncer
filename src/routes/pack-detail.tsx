import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { exeExtension } from "@tauri-apps/plugin-os";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Download,
  FolderGit2,
  FolderOpen,
  Hammer,
  Loader2,
  Package,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  SlidersHorizontal,
  Trash2,
  UploadCloudIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationControls,
  PaginationIndicator,
  PaginationInfo,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildArtifactStatusMap,
  DeletedModRow,
  enabledArtifactFilename,
  entryDisplayName,
  isDisabledArtifactFilename,
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
import { OptionPresetSelection } from "@/features/packs/presets/option-preset-selection";
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
  type ManifestEntry,
  type ModStatusValue,
  NO_OPTION_PRESET_ID,
  type OptionsSyncCategory,
  PACK_DEFAULT_PRESET_ID,
  type PublishPushProgressEvent,
  type PublishScanProgressEvent,
  type PublishScanReport,
  type SyncInstanceReport,
  type SyncProgressEvent,
  tauri,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useNav } from "@/stores/nav-store";

const EMPTY_PUBLISH_IGNORE_PATTERNS: string[] = [];
const EMPTY_DISABLED_ARTIFACTS: Record<string, string[]> = {};
const DEFAULT_OPTION_SYNC_CATEGORIES: OptionsSyncCategory[] = ["keybinds", "video", "other"];
const ARTIFACT_PAGE_SIZE = 15;

type ArtifactSortKey = "name" | "source" | "side" | "status" | "enabled";
type ArtifactSort = {
  key: ArtifactSortKey;
  direction: "asc" | "desc";
};

const DEFAULT_ARTIFACT_SORT: Record<ManifestArtifactCategory, ArtifactSort> = {
  mods: { key: "name", direction: "asc" },
  resourcepacks: { key: "name", direction: "asc" },
  shaderpacks: { key: "name", direction: "asc" },
};

export function PackDetailRoute({ packId }: { packId: string }) {
  const go = useNav((s) => s.go);
  const qc = useQueryClient();
  const adminMode = useAppStore((s) => s.adminModeByPack[packId] ?? false);
  const lastSyncedCommit = useAppStore((s) => s.lastSyncedCommitByPack[packId] ?? null);
  const selectedOptionPresetId = useAppStore(
    (s) => s.selectedOptionPresetByPack[packId] ?? PACK_DEFAULT_PRESET_ID,
  );
  const skipLaunchPresetSelection = useAppStore(
    (s) => s.skipLaunchPresetSelectionByPack[packId] ?? false,
  );
  const publishIgnorePatterns = useAppStore(
    (s) => s.publishIgnorePatternsByPack[packId] ?? EMPTY_PUBLISH_IGNORE_PATTERNS,
  );
  const setLastSyncedCommit = useAppStore((s) => s.setLastSyncedCommit);
  const setSelectedOptionPreset = useAppStore((s) => s.setSelectedOptionPreset);
  const setSkipLaunchPresetSelection = useAppStore((s) => s.setSkipLaunchPresetSelection);
  const setPublishIgnorePatterns = useAppStore((s) => s.setPublishIgnorePatterns);
  const disabledArtifactsForPack = useAppStore(
    (s) => s.disabledArtifactsByPack[packId] ?? EMPTY_DISABLED_ARTIFACTS,
  );
  const setArtifactDisabled = useAppStore((s) => s.setArtifactDisabled);
  const setPackDisabledArtifacts = useAppStore((s) => s.setPackDisabledArtifacts);

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
  const [launchSyncGateOpen, setLaunchSyncGateOpen] = useState(false);
  const [launchBlockedHeadSha, setLaunchBlockedHeadSha] = useState<string | null>(null);
  const [launchProfileDraft, setLaunchProfileDraft] = useState<LaunchProfile | null>(null);
  const [javaInstallOpen, setJavaInstallOpen] = useState(false);
  const [selectedJavaChoiceId, setSelectedJavaChoiceId] = useState("temurin-21-jre");
  const [javaInstallProgress, setJavaInstallProgress] = useState<JavaInstallProgressEvent | null>(
    null,
  );
  const [javaInstallLogs, setJavaInstallLogs] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [presetSelectionOpen, setPresetSelectionOpen] = useState(false);
  const [addEntryDialogOpen, setAddEntryDialogOpen] = useState(false);
  const [addEntryCategory, setAddEntryCategory] = useState<ManifestArtifactCategory>("mods");
  const [syncReviewOpen, setSyncReviewOpen] = useState(false);
  const [syncReviewStep, setSyncReviewStep] = useState<"artifacts" | "options">("artifacts");
  const [launchStep, setLaunchStep] = useState<"presets" | "options">("presets");
  const [shaderSyncDecision, setShaderSyncDecision] = useState<"undecided" | "sync" | "skip">(
    "undecided",
  );
  const [pendingShaderSync, setPendingShaderSync] = useState(false);
  const [pendingOptionPresetId, setPendingOptionPresetId] = useState(PACK_DEFAULT_PRESET_ID);
  const [optionSyncCategories, setOptionSyncCategories] = useState<OptionsSyncCategory[]>(
    DEFAULT_OPTION_SYNC_CATEGORIES,
  );
  const [pendingOptionSyncCategories, setPendingOptionSyncCategories] = useState<
    OptionsSyncCategory[]
  >(DEFAULT_OPTION_SYNC_CATEGORIES);
  const [artifactSearch, setArtifactSearch] = useState<Record<ManifestArtifactCategory, string>>({
    mods: "",
    resourcepacks: "",
    shaderpacks: "",
  });
  const [artifactPage, setArtifactPage] = useState<Record<ManifestArtifactCategory, number>>({
    mods: 1,
    resourcepacks: 1,
    shaderpacks: 1,
  });
  const [artifactSort, setArtifactSort] =
    useState<Record<ManifestArtifactCategory, ArtifactSort>>(DEFAULT_ARTIFACT_SORT);
  const [pendingArtifactToggles, setPendingArtifactToggles] = useState<Record<string, boolean>>({});
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncDeleteConfirmOpen, setSyncDeleteConfirmOpen] = useState(false);
  const [syncAlreadySyncedConfirmOpen, setSyncAlreadySyncedConfirmOpen] = useState(false);
  const [freshSyncConfirmOpen, setFreshSyncConfirmOpen] = useState(false);
  const [actionRefreshPending, setActionRefreshPending] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [activeChangelogIndex, setActiveChangelogIndex] = useState(0);
  const [publishLogs, setPublishLogs] = useState<string[]>([]);
  const [publishScanProgress, setPublishScanProgress] = useState<PublishScanProgressEvent | null>(
    null,
  );
  const [publishPushProgress, setPublishPushProgress] = useState<PublishPushProgressEvent | null>(
    null,
  );
  const [publishPushRate, setPublishPushRate] = useState<number | null>(null);
  const publishPushRateRef = useRef<{ bytes: number; at: number } | null>(null);
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

    void listen<PublishScanProgressEvent>("publish-scan-progress", (event) => {
      if (event.payload.packId !== packId) return;
      setPublishScanProgress(event.payload);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [packId]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    void listen<PublishPushProgressEvent>("publish-push-progress", (event) => {
      if (event.payload.packId !== packId) return;
      setPublishPushProgress(event.payload);
      if (typeof event.payload.bytes === "number") {
        const now = Date.now();
        const previous = publishPushRateRef.current;
        if (previous && now > previous.at && event.payload.bytes >= previous.bytes) {
          setPublishPushRate(((event.payload.bytes - previous.bytes) * 1000) / (now - previous.at));
        }
        publishPushRateRef.current = { bytes: event.payload.bytes, at: now };
      } else if (event.payload.stage !== "uploading") {
        publishPushRateRef.current = null;
        setPublishPushRate(null);
      }
      if (event.payload.message) {
        setPublishLogs((current) => [...current, event.payload.message as string]);
      }
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
    queryKey: ["artifact-publish-scan", packId, publishIgnorePatterns],
    queryFn: () => tauri.scanInstancePublish(packId, undefined, publishIgnorePatterns),
    enabled: !!manifest.data && !!instanceDir.data,
    retry: false,
  });
  const hasTrackedOptionsFile = hasTrackedOptionsPreset(artifactPublishScan.data);
  const optionsSyncPreview = useQuery({
    queryKey: ["options-sync-preview", packId, PACK_DEFAULT_PRESET_ID],
    queryFn: () => tauri.previewOptionsSync(packId, undefined, PACK_DEFAULT_PRESET_ID),
    enabled: syncReviewOpen && !!instanceDir.data,
    retry: false,
  });
  const shaderSettingsPreview = useQuery({
    queryKey: ["shader-settings-preview", packId, PACK_DEFAULT_PRESET_ID],
    queryFn: () => tauri.previewShaderSettingsSync(packId, undefined, PACK_DEFAULT_PRESET_ID),
    enabled: syncReviewOpen && !!instanceDir.data,
    retry: false,
  });
  const optionPresets = useQuery({
    queryKey: ["option-presets", packId],
    queryFn: () => tauri.listOptionPresets(packId),
    enabled: !!manifest.data,
    retry: false,
  });
  useEffect(() => {
    if (
      !optionPresets.data ||
      selectedOptionPresetId === PACK_DEFAULT_PRESET_ID ||
      selectedOptionPresetId === NO_OPTION_PRESET_ID
    ) {
      return;
    }
    if (optionPresets.data.some((preset) => preset.id === selectedOptionPresetId)) return;
    setSelectedOptionPreset(packId, PACK_DEFAULT_PRESET_ID);
  }, [optionPresets.data, packId, selectedOptionPresetId, setSelectedOptionPreset]);
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
  const launchPresetConfig = useQuery({
    queryKey: ["launch-preset-config", packId],
    queryFn: () => tauri.getLaunchPresetConfig(packId),
    enabled: !!manifest.data,
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
  const modrinthMap = useModrinthProjects(
    manifest.data
      ? [...manifest.data.mods, ...manifest.data.resourcepacks, ...manifest.data.shaderpacks]
      : [],
  );
  const isLocalPack = pack.data?.is_local ?? false;
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
  const visibleShaderpacks = (manifest.data?.shaderpacks ?? []).filter(
    (entry) => !entry.filename.endsWith(".txt"),
  );
  const disabledArtifactSets = useMemo(
    () => ({
      mods: new Set(disabledArtifactsForPack.mods ?? []),
      resourcepacks: new Set(disabledArtifactsForPack.resourcepacks ?? []),
      shaderpacks: new Set(disabledArtifactsForPack.shaderpacks ?? []),
    }),
    [disabledArtifactsForPack],
  );
  const filteredMods = filterArtifactEntries(
    manifest.data?.mods ?? [],
    artifactSearch.mods,
    modrinthMap,
  );
  const filteredResourcepacks = filterArtifactEntries(
    manifest.data?.resourcepacks ?? [],
    artifactSearch.resourcepacks,
    modrinthMap,
  );
  const filteredShaderpacks = filterArtifactEntries(
    visibleShaderpacks,
    artifactSearch.shaderpacks,
    modrinthMap,
  );
  const sortedMods = sortArtifactEntries(
    filteredMods,
    artifactSort.mods,
    modrinthMap,
    (entry) =>
      disabledArtifactSets.mods.has(enabledArtifactFilename(entry.filename)) ||
      statusMap.get(enabledArtifactFilename(entry.filename)) === "disabled" ||
      isDisabledArtifactFilename(entry.filename)
        ? "disabled"
        : isLocalPack
          ? "local"
          : (statusMap.get(enabledArtifactFilename(entry.filename)) ?? "missing"),
    (entry) =>
      !(
        disabledArtifactSets.mods.has(enabledArtifactFilename(entry.filename)) ||
        statusMap.get(enabledArtifactFilename(entry.filename)) === "disabled" ||
        isDisabledArtifactFilename(entry.filename)
      ),
  );
  const sortedResourcepacks = sortArtifactEntries(
    filteredResourcepacks,
    artifactSort.resourcepacks,
    modrinthMap,
    (entry) =>
      disabledArtifactSets.resourcepacks.has(enabledArtifactFilename(entry.filename)) ||
      isDisabledArtifactFilename(entry.filename)
        ? "disabled"
        : isLocalPack
          ? "local"
          : (resourcepackStatusMap.get(enabledArtifactFilename(entry.filename)) ?? "missing"),
    (entry) =>
      !disabledArtifactSets.resourcepacks.has(enabledArtifactFilename(entry.filename)) &&
      !isDisabledArtifactFilename(entry.filename),
  );
  const sortedShaderpacks = sortArtifactEntries(
    filteredShaderpacks,
    artifactSort.shaderpacks,
    modrinthMap,
    (entry) =>
      disabledArtifactSets.shaderpacks.has(enabledArtifactFilename(entry.filename)) ||
      isDisabledArtifactFilename(entry.filename)
        ? "disabled"
        : isLocalPack
          ? "local"
          : (shaderpackStatusMap.get(enabledArtifactFilename(entry.filename)) ?? "missing"),
    (entry) =>
      !disabledArtifactSets.shaderpacks.has(enabledArtifactFilename(entry.filename)) &&
      !isDisabledArtifactFilename(entry.filename),
  );
  const pagedMods = paginateArtifacts(sortedMods, artifactPage.mods);
  const pagedResourcepacks = paginateArtifacts(sortedResourcepacks, artifactPage.resourcepacks);
  const pagedShaderpacks = paginateArtifacts(sortedShaderpacks, artifactPage.shaderpacks);
  const modPageCount = pageCount(filteredMods.length);
  const resourcepackPageCount = pageCount(filteredResourcepacks.length);
  const shaderpackPageCount = pageCount(filteredShaderpacks.length);
  const disabledOptionalModCount = (manifest.data?.mods ?? []).filter(
    (entry) =>
      entry.optional &&
      (disabledArtifactSets.mods.has(enabledArtifactFilename(entry.filename)) ||
        statusMap.get(enabledArtifactFilename(entry.filename)) === "disabled" ||
        isDisabledArtifactFilename(entry.filename)),
  ).length;
  const launchRiskCount = isLocalPack
    ? 0
    : (statuses.data ?? []).filter(
        (s) =>
          (s.status === "missing" || s.status === "outdated") &&
          !disabledArtifactSets.mods.has(enabledArtifactFilename(s.filename)),
      ).length;
  const resourcepackRiskCount =
    isLocalPack || !manifest.data
      ? 0
      : manifest.data.resourcepacks.filter(
          (entry) =>
            !disabledArtifactSets.resourcepacks.has(enabledArtifactFilename(entry.filename)) &&
            !isDisabledArtifactFilename(entry.filename) &&
            resourcepackStatusMap.get(enabledArtifactFilename(entry.filename)) !== "synced",
        ).length;
  const shaderpackRiskCount = isLocalPack
    ? 0
    : visibleShaderpacks.filter(
        (entry) =>
          !disabledArtifactSets.shaderpacks.has(enabledArtifactFilename(entry.filename)) &&
          !isDisabledArtifactFilename(entry.filename) &&
          shaderpackStatusMap.get(enabledArtifactFilename(entry.filename)) !== "synced",
      ).length;
  const totalLaunchRiskCount = launchRiskCount + resourcepackRiskCount + shaderpackRiskCount;
  const stagedArtifactCount =
    unpublishedMods.length + unpublishedResourcepacks.length + unpublishedShaderpacks.length;
  const javaChoices = getJavaInstallChoices(
    manifest.data?.pack.mcVersion,
    manifest.data?.pack.loader,
  );
  const syncedModCount = (statuses.data ?? []).filter((s) => s.status === "synced").length;
  const acceptedModCount = syncedModCount + disabledOptionalModCount;
  const hasLocalArtifactDrift =
    !isLocalPack &&
    !!manifest.data &&
    !!statuses.data &&
    (launchRiskCount > 0 ||
      resourcepackRiskCount > 0 ||
      shaderpackRiskCount > 0 ||
      deletedMods.length > 0 ||
      stagedArtifactCount > 0 ||
      acceptedModCount !== manifest.data.mods.length);
  const latestPackCommit = pack.data?.head_sha ?? null;
  const hasSyncedLatestCommit =
    isLocalPack || (!!latestPackCommit && lastSyncedCommit === latestPackCommit);
  const needsPackSync = !isLocalPack && !!latestPackCommit && !hasSyncedLatestCommit;
  const needsSync = needsPackSync || hasLocalArtifactDrift;
  const alreadySynced = !!manifest.data && hasSyncedLatestCommit && !hasLocalArtifactDrift;
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
  const highlightChangelog = needsPackSync && newUpdateCount > 0;
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
      await refreshPackQueries();
      toast.success("Pack updated", {
        description: updatedPack.head_sha.slice(0, 10),
      });
    },
    onError: (e) => {
      toast.error("Fetch failed", { description: formatError(e) });
    },
  });

  async function refreshPackQueries() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["packs"] }),
      qc.invalidateQueries({ queryKey: ["manifest", packId] }),
      qc.invalidateQueries({ queryKey: ["pack-changelog", packId] }),
      qc.invalidateQueries({ queryKey: ["mod-statuses", packId] }),
      qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] }),
      qc.invalidateQueries({ queryKey: ["option-presets", packId] }),
      qc.invalidateQueries({ queryKey: ["options-sync-preview", packId] }),
      qc.invalidateQueries({ queryKey: ["shader-settings-preview", packId] }),
      qc.invalidateQueries({ queryKey: ["launch-profile", packId] }),
      qc.invalidateQueries({ queryKey: ["launch-preset-config", packId] }),
    ]);
  }

  async function refreshPackBeforeAction() {
    if (isLocalPack) {
      return pack.data ?? null;
    }
    setActionRefreshPending(true);
    try {
      const previousHead = pack.data?.head_sha ?? null;
      const updatedPack = await tauri.refreshPackForAction(packId);
      await refreshPackQueries();
      if (previousHead && previousHead !== updatedPack.head_sha) {
        toast.info("Pack update found", {
          description: updatedPack.head_sha.slice(0, 10),
        });
      }
      return updatedPack;
    } catch (error) {
      toast.error("Update check failed", { description: formatError(error) });
      return null;
    } finally {
      setActionRefreshPending(false);
    }
  }

  const toggleArtifactDisabled = useMutation({
    mutationFn: ({
      category,
      filename,
      disabled,
    }: {
      category: ManifestArtifactCategory;
      filename: string;
      disabled: boolean;
    }) => tauri.setInstanceArtifactDisabled(packId, category, filename, disabled, instanceName),
    onMutate: (variables) => {
      setPendingArtifactToggles((current) => ({
        ...current,
        [artifactToggleKey(variables.category, variables.filename)]: true,
      }));
    },
    onSuccess: async (_, variables) => {
      setArtifactDisabled(packId, variables.category, variables.filename, variables.disabled);
      await Promise.all([
        statuses.refetch(),
        qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] }),
      ]);
    },
    onError: (error) => {
      toast.error("Artifact toggle failed", { description: formatError(error) });
    },
    onSettled: (_data, _error, variables) => {
      setPendingArtifactToggles((current) => {
        const next = { ...current };
        delete next[artifactToggleKey(variables.category, variables.filename)];
        return next;
      });
    },
  });

  const sync = useMutation({
    mutationFn: async ({
      syncShaderSettings,
      optionPresetId,
      optionSyncCategories,
      fresh = false,
    }: {
      syncShaderSettings: boolean;
      optionPresetId: string;
      optionSyncCategories: OptionsSyncCategory[];
      fresh?: boolean;
    }) => {
      if (fresh) {
        await tauri.deletePrismInstance(instanceName);
      }
      if (!isLocalPack) {
        await tauri.restoreManifestFromSource(packId);
      }
      return tauri.syncInstance(
        packId,
        undefined,
        syncShaderSettings,
        optionPresetId,
        optionSyncCategories,
      );
    },
    onMutate: (variables) => {
      setSyncOpen(true);
      setProgress({
        packId,
        status: variables.fresh ? "writing-instance" : "downloading",
        filename: null,
        completed: 0,
        total:
          (manifest.data?.mods.length ?? 0) +
          (manifest.data?.resourcepacks.length ?? 0) +
          visibleShaderpacks.length,
        cached: 0,
        downloaded: 0,
        failures: 0,
      });
      setReport(null);
    },
    onSuccess: async (r, variables) => {
      setReport(r);
      const syncHeadSha = pack.data?.head_sha;
      if (syncHeadSha) {
        setLastSyncedCommit(packId, syncHeadSha);
      }
      if (!variables.fresh) {
        await applyDisabledArtifacts();
      } else {
        setPackDisabledArtifacts(packId, {});
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["manifest", packId] }),
        statuses.refetch(),
        qc.invalidateQueries({ queryKey: ["pack-changelog", packId] }),
        qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] }),
        qc.invalidateQueries({ queryKey: ["option-presets", packId] }),
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

  async function applyDisabledArtifacts() {
    const categories: ManifestArtifactCategory[] = ["mods", "resourcepacks", "shaderpacks"];
    if (!manifest.data) return;
    const entriesByCategory = {
      mods: manifest.data.mods,
      resourcepacks: manifest.data.resourcepacks,
      shaderpacks: visibleShaderpacks,
    } satisfies Record<ManifestArtifactCategory, ManifestEntry[]>;
    const cleaned = Object.fromEntries(
      categories.map((category) => {
        const entries = entriesByCategory[category];
        const allowed = new Set(
          entries
            .filter((entry) => category !== "mods" || entry.optional)
            .map((entry) => enabledArtifactFilename(entry.filename)),
        );
        return [
          category,
          (disabledArtifactsForPack[category] ?? [])
            .map(enabledArtifactFilename)
            .filter(
              (filename, index, list) => allowed.has(filename) && list.indexOf(filename) === index,
            ),
        ];
      }),
    ) as Record<ManifestArtifactCategory, string[]>;
    setPackDisabledArtifacts(packId, cleaned);

    const failures: string[] = [];
    for (const category of categories) {
      for (const filename of cleaned[category]) {
        try {
          await tauri.setInstanceArtifactDisabled(packId, category, filename, true, instanceName);
        } catch (error) {
          failures.push(`${filename}: ${formatError(error)}`);
          setArtifactDisabled(packId, category, filename, false);
        }
      }
    }
    if (failures.length > 0) {
      toast.warning("Some disabled artifacts stayed enabled", {
        description: failures.slice(0, 3).join("\n"),
      });
    }
  }

  const launch = useMutation({
    mutationFn: async (profile: LaunchProfile) => {
      await tauri.setLaunchProfile(packId, profile);
      await tauri.launchPack(packId, instanceName, selectedOptionPresetId);
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
    mutationFn: () => tauri.scanInstancePublish(packId, undefined, publishIgnorePatterns),
    onMutate: () => {
      setPublishOpen(true);
      setPublishReport(null);
      setPublishLogs([]);
      setPublishPushProgress(null);
      setPublishScanProgress({
        packId,
        stage: "queued",
        currentPath: null,
        completed: 0,
        total: 1,
      });
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
    mutationFn: async ({
      message,
      version,
      amendPrevious,
      skipApply,
    }: {
      message: string;
      version: string;
      amendPrevious: boolean;
      skipApply: boolean;
    }) => {
      const applied = skipApply
        ? null
        : await (async () => {
            setPublishLogs((current) => [...current, "> apply manifest changes"]);
            const result = await tauri.applyInstancePublish(
              packId,
              undefined,
              version,
              publishIgnorePatterns,
            );
            setPublishLogs((current) => [
              ...current,
              `apply done :: ${result.manifestEntriesWritten} entries / ${result.repoFilesWritten} repo writes / ${result.repoFilesRemoved} removals`,
            ]);
            return result;
          })();
      setPublishLogs((current) =>
        [
          ...current,
          skipApply ? "> skip apply, push current repo" : null,
          amendPrevious ? "> amend previous update + force push origin" : "> commit + push origin",
        ].filter((line): line is string => line !== null),
      );
      setPublishPushProgress({
        packId,
        stage: amendPrevious ? "amending" : "committing",
        currentPath: null,
        completed: 0,
        total: 1,
        bytes: null,
        message: null,
      });
      publishPushRateRef.current = null;
      setPublishPushRate(null);
      const pushed = await tauri.commitAndPushPublish(
        packId,
        message,
        publishIgnorePatterns,
        amendPrevious,
      );
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
  const publishApplyOnly = useMutation({
    mutationFn: async ({ version }: { version: string }) => {
      setPublishLogs((current) => [...current, "> apply manifest changes to local repo"]);
      const applied = await tauri.applyInstancePublish(
        packId,
        undefined,
        version,
        publishIgnorePatterns,
      );
      setPublishLogs((current) => [
        ...current,
        `apply done :: ${applied.manifestEntriesWritten} entries / ${applied.repoFilesWritten} repo writes / ${applied.repoFilesRemoved} removals`,
        "> local repo ready for manual git commit/push",
      ]);
      return applied;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["manifest", packId] }),
        qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] }),
        qc.invalidateQueries({ queryKey: ["options-sync-preview", packId] }),
        qc.invalidateQueries({ queryKey: ["shader-settings-preview", packId] }),
      ]);
      toast.success("Applied to local repo", {
        description: "Open pack folder to commit or push manually.",
      });
    },
    onError: (error) => {
      setPublishLogs((current) => [...current, `error :: ${formatError(error)}`]);
      toast.error("Apply failed", { description: formatError(error) });
    },
  });

  async function handleLaunchClick() {
    if (isLocalPack) {
      openLaunchFlow();
      return;
    }
    const updatedPack = await refreshPackBeforeAction();
    if (!updatedPack) return;
    if (updatedPack.head_sha !== lastSyncedCommit) {
      setLaunchBlockedHeadSha(updatedPack.head_sha);
      setLaunchSyncGateOpen(true);
      return;
    }
    openLaunchFlow();
  }

  function openLaunchFlow() {
    setLaunchStep(skipLaunchPresetSelection ? "options" : "presets");
    setLaunchConfirmOpen(true);
  }

  function handleSyncFromLaunchGate() {
    setLaunchSyncGateOpen(false);
    openSyncReview();
  }

  function openSyncReview() {
    setSyncReviewStep("artifacts");
    setShaderSyncDecision("undecided");
    setPendingShaderSync(false);
    setPendingOptionPresetId(PACK_DEFAULT_PRESET_ID);
    setOptionSyncCategories(DEFAULT_OPTION_SYNC_CATEGORIES);
    setPendingOptionSyncCategories(DEFAULT_OPTION_SYNC_CATEGORIES);
    setSyncReviewOpen(true);
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

  async function handleSyncClick() {
    if (isLocalPack) {
      toast.info("Local packs do not sync", {
        description: "Launch uses the local Prism instance as-is.",
      });
      return;
    }
    const updatedPack = await refreshPackBeforeAction();
    if (!updatedPack) return;
    openSyncReview();
  }

  function handleCloseSyncReview() {
    setSyncReviewOpen(false);
    setSyncReviewStep("artifacts");
    setShaderSyncDecision("undecided");
    setPendingShaderSync(false);
    setPendingOptionPresetId(PACK_DEFAULT_PRESET_ID);
    setOptionSyncCategories(DEFAULT_OPTION_SYNC_CATEGORIES);
    setPendingOptionSyncCategories(DEFAULT_OPTION_SYNC_CATEGORIES);
  }

  function handleSyncReviewNext() {
    setSyncReviewStep("options");
  }

  function handleSyncReviewBack() {
    setSyncReviewStep("artifacts");
  }

  function handleConfirmSyncFromReview() {
    const applyShaderSettings = shaderSettingsPreview.data?.requiresDecision
      ? shaderSyncDecision === "sync"
      : false;
    handleCloseSyncReview();
    setPendingShaderSync(applyShaderSettings);
    setPendingOptionPresetId(PACK_DEFAULT_PRESET_ID);
    setPendingOptionSyncCategories(optionSyncCategories);
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
      optionPresetId: PACK_DEFAULT_PRESET_ID,
      optionSyncCategories,
    });
  }

  function handleOptionSyncCategoryChange(category: OptionsSyncCategory, enabled: boolean) {
    setOptionSyncCategories((current) => {
      if (enabled) {
        return current.includes(category) ? current : [...current, category];
      }
      return current.filter((item) => item !== category);
    });
  }

  function handleOpenAddEntry(category: ManifestArtifactCategory) {
    setAddEntryCategory(category);
    setAddEntryDialogOpen(true);
  }

  function handleArtifactSearch(category: ManifestArtifactCategory, value: string) {
    setArtifactSearch((current) => ({ ...current, [category]: value }));
    setArtifactPage((current) => ({ ...current, [category]: 1 }));
  }

  function handleArtifactPage(category: ManifestArtifactCategory, page: number, total: number) {
    setArtifactPage((current) => ({
      ...current,
      [category]: Math.min(Math.max(page, 1), total),
    }));
  }

  function handleArtifactSort(category: ManifestArtifactCategory, key: ArtifactSortKey) {
    setArtifactSort((current) => {
      const existing = current[category];
      return {
        ...current,
        [category]: {
          key,
          direction: existing.key === key && existing.direction === "asc" ? "desc" : "asc",
        },
      };
    });
    setArtifactPage((current) => ({ ...current, [category]: 1 }));
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
        scanProgress={publishScanProgress}
        pushProgress={publishPushProgress}
        pushRateBytesPerSecond={publishPushRate}
        applying={publishApplyOnly.isPending}
        publishing={publishPush.isPending}
        publishLogs={publishLogs}
        ignorePatterns={publishIgnorePatterns}
        onIgnorePatternsChange={(patterns) => setPublishIgnorePatterns(packId, patterns)}
        onApply={(version) => publishApplyOnly.mutate({ version })}
        onPublish={(message, version, amendPrevious, skipApply) =>
          publishPush.mutate({ message, version, amendPrevious, skipApply })
        }
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
                {isLocalPack && <Badge variant="secondary">LOCAL</Badge>}
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
              onClick={() => go({ kind: "builder", id: packId })}
              disabled={
                !manifest.data || sync.isPending || fetchPack.isPending || actionRefreshPending
              }
            >
              <Hammer />
              BUILDER
            </Button>
          )}
          {adminMode && (
            <Button
              variant="outline"
              onClick={() => publishScan.mutate()}
              disabled={
                publishScan.isPending ||
                sync.isPending ||
                fetchPack.isPending ||
                actionRefreshPending
              }
            >
              {publishScan.isPending ? <Loader2 className="animate-spin" /> : <UploadCloudIcon />}
              PUBLISH
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setPresetSelectionOpen(true)}
            disabled={
              !manifest.data || sync.isPending || fetchPack.isPending || actionRefreshPending
            }
          >
            <SlidersHorizontal />
            PRESETS
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchPack.mutate()}
            disabled={
              isLocalPack ||
              fetchPack.isPending ||
              actionRefreshPending ||
              sync.isPending ||
              launch.isPending
            }
          >
            {fetchPack.isPending || actionRefreshPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <FolderGit2 />
            )}
            {isLocalPack ? "LOCAL" : "FETCH"}
          </Button>
          <Button
            variant={needsSync ? "default" : "secondary"}
            onClick={() => void handleSyncClick()}
            disabled={
              isLocalPack ||
              fetchPack.isPending ||
              actionRefreshPending ||
              sync.isPending ||
              !manifest.data ||
              !prism.data
            }
          >
            {sync.isPending || actionRefreshPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            {isLocalPack ? "LOCAL" : "SYNC"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setFreshSyncConfirmOpen(true)}
            disabled={
              isLocalPack ||
              fetchPack.isPending ||
              actionRefreshPending ||
              sync.isPending ||
              !manifest.data ||
              !prism.data
            }
          >
            <Trash2 />
            FRESH SYNC
          </Button>
          <Button
            onClick={() => void handleLaunchClick()}
            disabled={
              fetchPack.isPending ||
              actionRefreshPending ||
              launch.isPending ||
              !prism.data ||
              sync.isPending
            }
          >
            {launch.isPending || actionRefreshPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Play />
            )}
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
          highlightChangelog &&
            "border-brand-core/35 bg-brand-core/10 shadow-[0_0_24px_rgba(84,208,150,0.16)] hover:border-brand-core/45 hover:bg-brand-core/14 hover:text-text-high",
        )}
      >
        <div className="flex flex-col items-start gap-1">
          <span
            className={cn(
              "cp-tactical-label text-[10px]",
              highlightChangelog ? "text-brand-core" : "text-text-low",
            )}
          >
            PACK UPDATES
          </span>
          <span className="text-sm text-text-low">View what changed since last sync</span>
        </div>
        <div className="flex items-center gap-3">
          {highlightChangelog && !changelog.isLoading ? (
            <span className="size-2 shrink-0 rounded-full bg-brand-core shadow-[0_0_12px_rgba(84,208,150,0.65)]" />
          ) : null}
          <span
            className={cn(
              "text-right text-[10px] uppercase tracking-[0.18em]",
              highlightChangelog ? "text-brand-core" : "text-text-low",
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
              className={cn("size-4", highlightChangelog ? "text-brand-core" : "text-text-low")}
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
              <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                <ArtifactSearchBox
                  value={artifactSearch.mods}
                  placeholder="SEARCH MODS"
                  onChange={(value) => handleArtifactSearch("mods", value)}
                />
                {adminMode ? (
                  <Button variant="outline" onClick={() => handleOpenAddEntry("mods")}>
                    <Plus /> ADD MODS
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <ArtifactSortableHead
                      label="NAME"
                      sortKey="name"
                      sort={artifactSort.mods}
                      onSort={() => handleArtifactSort("mods", "name")}
                    />
                    <ArtifactSortableHead
                      label="SOURCE"
                      sortKey="source"
                      sort={artifactSort.mods}
                      onSort={() => handleArtifactSort("mods", "source")}
                    />
                    <ArtifactSortableHead
                      label="SIDE"
                      sortKey="side"
                      sort={artifactSort.mods}
                      onSort={() => handleArtifactSort("mods", "side")}
                    />
                    <ArtifactSortableHead
                      label="STATUS"
                      sortKey="status"
                      sort={artifactSort.mods}
                      align="right"
                      onSort={() => handleArtifactSort("mods", "status")}
                    />
                    <ArtifactSortableHead
                      label="ENABLED"
                      sortKey="enabled"
                      sort={artifactSort.mods}
                      align="right"
                      onSort={() => handleArtifactSort("mods", "enabled")}
                    />
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
                  {pagedMods.map((m) => {
                    const filename = enabledArtifactFilename(m.filename);
                    const disabled =
                      disabledArtifactSets.mods.has(filename) ||
                      statusMap.get(filename) === "disabled" ||
                      isDisabledArtifactFilename(m.filename);
                    return (
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
                        status={isLocalPack ? "local" : (statusMap.get(filename) ?? null)}
                        loading={statuses.isLoading || statuses.isFetching}
                        disabled={disabled}
                        canDisable={m.optional || isDisabledArtifactFilename(m.filename)}
                        togglingDisabled={
                          !!pendingArtifactToggles[artifactToggleKey("mods", filename)]
                        }
                        onToggleDisabled={(nextDisabled) =>
                          toggleArtifactDisabled.mutate({
                            category: "mods",
                            filename,
                            disabled: nextDisabled,
                          })
                        }
                      />
                    );
                  })}
                  {deletedMods.map((m) => (
                    <DeletedModRow key={`deleted:${m.filename}`} mod={m} />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <ArtifactPager
              page={artifactPage.mods}
              totalPages={modPageCount}
              totalItems={filteredMods.length}
              onPrevious={() => handleArtifactPage("mods", artifactPage.mods - 1, modPageCount)}
              onNext={() => handleArtifactPage("mods", artifactPage.mods + 1, modPageCount)}
            />
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
              <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                <ArtifactSearchBox
                  value={artifactSearch.resourcepacks}
                  placeholder="SEARCH RESOURCEPACKS"
                  onChange={(value) => handleArtifactSearch("resourcepacks", value)}
                />
                {adminMode ? (
                  <Button variant="outline" onClick={() => handleOpenAddEntry("resourcepacks")}>
                    <Plus /> ADD RESOURCEPACK
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <ArtifactSortableHead
                      label="NAME"
                      sortKey="name"
                      sort={artifactSort.resourcepacks}
                      onSort={() => handleArtifactSort("resourcepacks", "name")}
                    />
                    <ArtifactSortableHead
                      label="SOURCE"
                      sortKey="source"
                      sort={artifactSort.resourcepacks}
                      onSort={() => handleArtifactSort("resourcepacks", "source")}
                    />
                    <ArtifactSortableHead
                      label="SIDE"
                      sortKey="side"
                      sort={artifactSort.resourcepacks}
                      onSort={() => handleArtifactSort("resourcepacks", "side")}
                    />
                    <ArtifactSortableHead
                      label="STATUS"
                      sortKey="status"
                      sort={artifactSort.resourcepacks}
                      align="right"
                      onSort={() => handleArtifactSort("resourcepacks", "status")}
                    />
                    <ArtifactSortableHead
                      label="ENABLED"
                      sortKey="enabled"
                      sort={artifactSort.resourcepacks}
                      align="right"
                      onSort={() => handleArtifactSort("resourcepacks", "enabled")}
                    />
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
                  {pagedResourcepacks.map((entry) => {
                    const filename = enabledArtifactFilename(entry.filename);
                    const disabled =
                      disabledArtifactSets.resourcepacks.has(filename) ||
                      isDisabledArtifactFilename(entry.filename);
                    return (
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
                        status={
                          isLocalPack ? "local" : (resourcepackStatusMap.get(filename) ?? null)
                        }
                        loading={artifactPublishScan.isLoading || artifactPublishScan.isFetching}
                        disabled={disabled}
                        canDisable
                        togglingDisabled={
                          !!pendingArtifactToggles[artifactToggleKey("resourcepacks", filename)]
                        }
                        onToggleDisabled={(nextDisabled) =>
                          toggleArtifactDisabled.mutate({
                            category: "resourcepacks",
                            filename,
                            disabled: nextDisabled,
                          })
                        }
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
            <ArtifactPager
              page={artifactPage.resourcepacks}
              totalPages={resourcepackPageCount}
              totalItems={filteredResourcepacks.length}
              onPrevious={() =>
                handleArtifactPage(
                  "resourcepacks",
                  artifactPage.resourcepacks - 1,
                  resourcepackPageCount,
                )
              }
              onNext={() =>
                handleArtifactPage(
                  "resourcepacks",
                  artifactPage.resourcepacks + 1,
                  resourcepackPageCount,
                )
              }
            />
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
                  {visibleShaderpacks.length} entries tracked by manifest
                  {unpublishedShaderpacks.length > 0
                    ? ` · ${unpublishedShaderpacks.length} staged locally`
                    : ""}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                <ArtifactSearchBox
                  value={artifactSearch.shaderpacks}
                  placeholder="SEARCH SHADERPACKS"
                  onChange={(value) => handleArtifactSearch("shaderpacks", value)}
                />
                {adminMode ? (
                  <Button variant="outline" onClick={() => handleOpenAddEntry("shaderpacks")}>
                    <Plus /> ADD SHADERPACK
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <ArtifactSortableHead
                      label="NAME"
                      sortKey="name"
                      sort={artifactSort.shaderpacks}
                      onSort={() => handleArtifactSort("shaderpacks", "name")}
                    />
                    <ArtifactSortableHead
                      label="SOURCE"
                      sortKey="source"
                      sort={artifactSort.shaderpacks}
                      onSort={() => handleArtifactSort("shaderpacks", "source")}
                    />
                    <ArtifactSortableHead
                      label="SIDE"
                      sortKey="side"
                      sort={artifactSort.shaderpacks}
                      onSort={() => handleArtifactSort("shaderpacks", "side")}
                    />
                    <ArtifactSortableHead
                      label="STATUS"
                      sortKey="status"
                      sort={artifactSort.shaderpacks}
                      align="right"
                      onSort={() => handleArtifactSort("shaderpacks", "status")}
                    />
                    <ArtifactSortableHead
                      label="ENABLED"
                      sortKey="enabled"
                      sort={artifactSort.shaderpacks}
                      align="right"
                      onSort={() => handleArtifactSort("shaderpacks", "enabled")}
                    />
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
                  {pagedShaderpacks.map((entry) => {
                    const filename = enabledArtifactFilename(entry.filename);
                    const disabled =
                      disabledArtifactSets.shaderpacks.has(filename) ||
                      isDisabledArtifactFilename(entry.filename);
                    return (
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
                        status={isLocalPack ? "local" : (shaderpackStatusMap.get(filename) ?? null)}
                        loading={artifactPublishScan.isLoading || artifactPublishScan.isFetching}
                        disabled={disabled}
                        canDisable
                        togglingDisabled={
                          !!pendingArtifactToggles[artifactToggleKey("shaderpacks", filename)]
                        }
                        onToggleDisabled={(nextDisabled) =>
                          toggleArtifactDisabled.mutate({
                            category: "shaderpacks",
                            filename,
                            disabled: nextDisabled,
                          })
                        }
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
            <ArtifactPager
              page={artifactPage.shaderpacks}
              totalPages={shaderpackPageCount}
              totalItems={filteredShaderpacks.length}
              onPrevious={() =>
                handleArtifactPage("shaderpacks", artifactPage.shaderpacks - 1, shaderpackPageCount)
              }
              onNext={() =>
                handleArtifactPage("shaderpacks", artifactPage.shaderpacks + 1, shaderpackPageCount)
              }
            />
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
        hasTrackedOptionsFile={hasTrackedOptionsFile}
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
        enabledOptionSyncCategories={optionSyncCategories}
        onOptionSyncCategoryChange={handleOptionSyncCategoryChange}
        syncPending={sync.isPending}
        onClose={handleCloseSyncReview}
        onNext={handleSyncReviewNext}
        onBack={handleSyncReviewBack}
        onConfirm={handleConfirmSyncFromReview}
      />

      <AddModrinthEntryDialog
        open={addEntryDialogOpen}
        onClose={() => setAddEntryDialogOpen(false)}
        packId={packId}
        category={addEntryCategory}
      />

      <Dialog open={presetSelectionOpen} onOpenChange={setPresetSelectionOpen}>
        <DialogContent className="flex h-[min(92vh,48rem)] max-h-[92vh] flex-col overflow-hidden max-w-[96vw] sm:max-w-[72rem] xl:max-w-[80rem]">
          <DialogHeader>
            <DialogTitle>PRESETS</DialogTitle>
            <DialogDescription>Choose the preset used for launch.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex min-h-0 flex-1 flex-col overflow-hidden p-5 xl:p-6">
            <OptionPresetSelection
              presets={optionPresets.data ?? []}
              selectedPresetId={selectedOptionPresetId}
              onChange={(presetId) => setSelectedOptionPreset(packId, presetId)}
            />
          </DialogBody>
          <DialogFooter className="px-6 py-4 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setPresetSelectionOpen(false)}>
                CLOSE
              </Button>
              {skipLaunchPresetSelection ? (
                <Button
                  variant="outline"
                  onClick={() => setSkipLaunchPresetSelection(packId, false)}
                >
                  SHOW ON LAUNCH
                </Button>
              ) : null}
            </div>
            <Button onClick={() => setPresetSelectionOpen(false)}>DONE</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={launchSyncGateOpen} onOpenChange={setLaunchSyncGateOpen}>
        <DialogContent className="max-w-xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>NEW UPDATE AVAILABLE</DialogTitle>
            <DialogDescription>
              Sync this pack before launching so Prism does not start an outdated instance.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 p-6">
            <p className="text-sm text-text-low [text-wrap:pretty]">
              The latest fetched pack commit is newer than the last synced commit for this instance.
            </p>
            <div className="grid gap-2 border border-line-soft/20 bg-surface-sunken/60 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
                  LAST SYNC
                </span>
                <span className="font-mono text-xs text-text-high">
                  {lastSyncedCommit?.slice(0, 10) ?? "never"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
                  LATEST PACK
                </span>
                <span className="font-mono text-xs text-text-high">
                  {(launchBlockedHeadSha ?? latestPackCommit)?.slice(0, 10) ?? "unknown"}
                </span>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="px-6 py-4">
            <Button
              onClick={handleSyncFromLaunchGate}
              disabled={sync.isPending || fetchPack.isPending}
            >
              {sync.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              SYNC NOW
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={launchConfirmOpen} onOpenChange={setLaunchConfirmOpen}>
        <DialogContent className="flex h-[min(92vh,48rem)] max-h-[92vh] flex-col overflow-hidden max-w-[96vw] sm:max-w-[72rem] xl:max-w-[80rem]">
          <DialogHeader>
            <DialogTitle>
              {launchStep === "presets" ? "CHOOSE PRESET" : "LAUNCHER SETUP"}
            </DialogTitle>
            <DialogDescription>
              {launchStep === "presets"
                ? "Choose preset overrides for this launch."
                : "Choose Java, memory, and launcher settings."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody
            className={cn(
              "flex min-h-0 flex-1 flex-col p-5 xl:p-6",
              launchStep === "presets" ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
            {launchStep === "presets" ? (
              <OptionPresetSelection
                presets={optionPresets.data ?? []}
                selectedPresetId={selectedOptionPresetId}
                onChange={(presetId) => setSelectedOptionPreset(packId, presetId)}
              />
            ) : launchProfile.isError || launchPresetConfig.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Launch presets unavailable</AlertTitle>
                <AlertDescription>
                  {formatError(launchProfile.error ?? launchPresetConfig.error)}
                </AlertDescription>
              </Alert>
            ) : launchProfileDraft && launchPresetConfig.data ? (
              <LaunchSetupPanel
                packName={manifest.data?.pack.name ?? packId}
                profile={launchProfileDraft}
                presets={launchPresetConfig.data.presets}
                memoryMinMb={launchPresetConfig.data.memoryMinMb}
                memoryMaxMb={launchPresetConfig.data.memoryMaxMb}
                memoryStepMb={launchPresetConfig.data.memoryStepMb}
                packSynced={!needsSync}
                launchRiskCount={totalLaunchRiskCount}
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
            {launchStep === "presets" ? (
              <>
                <Button variant="secondary" onClick={() => setLaunchConfirmOpen(false)}>
                  CLOSE
                </Button>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSkipLaunchPresetSelection(packId, true);
                      setLaunchStep("options");
                    }}
                  >
                    DON'T SHOW AGAIN
                  </Button>
                  <Button onClick={() => setLaunchStep("options")}>
                    NEXT <ChevronRight />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setLaunchStep("presets")}>
                  <ArrowLeft /> BACK
                </Button>
                <Button
                  variant={needsSync || totalLaunchRiskCount > 0 ? "destructive" : "default"}
                  onClick={handleLaunchSubmit}
                  disabled={launch.isPending || !launchProfileDraft}
                >
                  {launch.isPending ? <Loader2 className="animate-spin" /> : <Rocket />}
                  {needsSync || totalLaunchRiskCount > 0 ? "LAUNCH ANYWAY" : "LAUNCH"}
                </Button>
              </>
            )}
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
                  optionSyncCategories: pendingOptionSyncCategories,
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
                  optionSyncCategories: pendingOptionSyncCategories,
                });
              }}
            >
              SYNC AGAIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={freshSyncConfirmOpen} onOpenChange={setFreshSyncConfirmOpen}>
        <DialogContent variant="destructive" className="overflow-hidden max-w-xl">
          <DialogHeader>
            <DialogTitle>FRESH SYNC WILL DELETE THIS INSTANCE</DialogTitle>
            <DialogDescription>
              This removes the Prism instance folder, clears local disabled artifact choices for
              this pack, then syncs a clean instance from source.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="p-6">
            <div className="flex flex-col gap-4 text-sm text-text-low">
              <div className="border border-line-soft/30 bg-surface-sunken p-4 font-mono text-[10px] uppercase tracking-[0.18em] text-signal-alert">
                Local instance files, unpublished mods, local configs, saves inside the instance,
                and disabled artifact state for this pack will be removed.
              </div>
              <p>
                Use this when normal sync reports restore errors or the instance looks desynced.
              </p>
            </div>
          </DialogBody>
          <DialogFooter className="px-6 py-4 sm:justify-between">
            <Button variant="secondary" onClick={() => setFreshSyncConfirmOpen(false)}>
              CANCEL
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setFreshSyncConfirmOpen(false);
                sync.mutate({
                  syncShaderSettings: false,
                  optionPresetId: PACK_DEFAULT_PRESET_ID,
                  optionSyncCategories: DEFAULT_OPTION_SYNC_CATEGORIES,
                  fresh: true,
                });
              }}
            >
              DELETE INSTANCE + SYNC
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

function ArtifactSearchBox({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-text-low" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9 text-xs"
      />
    </div>
  );
}

function ArtifactPager({
  page,
  totalPages,
  totalItems,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <Pagination className="justify-between">
      <PaginationInfo>{totalItems} SHOWN BY FILTER</PaginationInfo>
      <PaginationControls>
        <PaginationPrevious onClick={onPrevious} disabled={page <= 1} />
        <PaginationIndicator page={page} total={totalPages} />
        <PaginationNext onClick={onNext} disabled={page >= totalPages} />
      </PaginationControls>
    </Pagination>
  );
}

function ArtifactSortableHead({
  label,
  sortKey,
  sort,
  align = "left",
  onSort,
}: {
  label: string;
  sortKey: ArtifactSortKey;
  sort: ArtifactSort;
  align?: "left" | "right";
  onSort: () => void;
}) {
  const active = sort.key === sortKey;
  const SortIcon = active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={cn(align === "right" && "text-right")}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "inline-flex w-full items-center gap-1 text-[10px] uppercase tracking-[0.18em] transition-colors hover:text-text-high",
          align === "right" ? "justify-end" : "justify-start",
          active ? "text-brand-core" : "text-text-low",
        )}
      >
        <span>{label}</span>
        <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
          <SortIcon className="size-3" />
        </span>
      </button>
    </TableHead>
  );
}

function filterArtifactEntries(
  entries: ManifestEntry[],
  query: string,
  modrinthMap: Map<string, { title?: string | null }>,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => {
    const title =
      entry.source === "modrinth" && entry.projectId
        ? (modrinthMap.get(entry.projectId)?.title ?? "")
        : "";
    return [title, entryDisplayName(entry.filename), entry.id, entry.source, entry.side]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

function sortArtifactEntries(
  entries: ManifestEntry[],
  sort: ArtifactSort,
  modrinthMap: Map<string, { title?: string | null }>,
  getStatus: (entry: ManifestEntry) => ModStatusValue,
  getEnabled: (entry: ManifestEntry) => boolean,
) {
  return [...entries].sort((left, right) => {
    const leftName = artifactSortName(left, modrinthMap);
    const rightName = artifactSortName(right, modrinthMap);
    const nameResult = leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
    let result = nameResult;
    if (sort.key === "source") {
      result = left.source.localeCompare(right.source, undefined, { sensitivity: "base" });
    } else if (sort.key === "side") {
      result = artifactSideRank(left.side) - artifactSideRank(right.side);
    } else if (sort.key === "status") {
      result = artifactStatusRank(getStatus(left)) - artifactStatusRank(getStatus(right));
    } else if (sort.key === "enabled") {
      result = Number(getEnabled(right)) - Number(getEnabled(left));
    }
    result ||= nameResult;
    return sort.direction === "asc" ? result : -result;
  });
}

function artifactSortName(
  entry: ManifestEntry,
  modrinthMap: Map<string, { title?: string | null }>,
) {
  return (
    (entry.source === "modrinth" && entry.projectId
      ? modrinthMap.get(entry.projectId)?.title
      : null) ?? entryDisplayName(entry.filename)
  ).toLowerCase();
}

function artifactStatusRank(status: ModStatusValue) {
  const order: Record<ModStatusValue, number> = {
    synced: 0,
    local: 0,
    outdated: 1,
    missing: 2,
    disabled: 3,
    deleted: 4,
    unpublished: 5,
  };
  return order[status];
}

function artifactSideRank(side: ManifestEntry["side"]) {
  const order: Record<ManifestEntry["side"], number> = {
    both: 0,
    client: 1,
    server: 2,
  };
  return order[side];
}

function paginateArtifacts(entries: ManifestEntry[], page: number) {
  const start = (Math.max(page, 1) - 1) * ARTIFACT_PAGE_SIZE;
  return entries.slice(start, start + ARTIFACT_PAGE_SIZE);
}

function pageCount(totalItems: number) {
  return Math.max(1, Math.ceil(totalItems / ARTIFACT_PAGE_SIZE));
}

function artifactToggleKey(category: ManifestArtifactCategory, filename: string) {
  return `${category}:${filename}`;
}
