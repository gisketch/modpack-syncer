import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Download, FolderOpen, Loader2, Package, RotateCcw, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatError } from "@/lib/format-error";
import { type AppStorageSettings, type JavaInstallProgressEvent, type PrismInstallProgressEvent, tauri } from "@/lib/tauri";
import { useNav } from "@/stores/nav-store";

export function OnboardingRoute({ openedFromSettings = false }: { openedFromSettings?: boolean }) {
  const go = useNav((s) => s.go);
  const qc = useQueryClient();
  const [useDefaultPath, setUseDefaultPath] = useState(true);
  const [customRootPath, setCustomRootPath] = useState("");
  const [offlineUsername, setOfflineUsername] = useState("");
  const [javaInstallProgress, setJavaInstallProgress] = useState<JavaInstallProgressEvent | null>(null);
  const [javaInstallLogs, setJavaInstallLogs] = useState<string[]>([]);
  const [prismInstallProgress, setPrismInstallProgress] = useState<PrismInstallProgressEvent | null>(null);
  const [prismInstallLogs, setPrismInstallLogs] = useState<string[]>([]);
  const [displayedStep, setDisplayedStep] = useState(0);

  const appStorage = useQuery({
    queryKey: ["app-storage"],
    queryFn: () => tauri.getAppStorageSettings(),
  });
  const managedJava = useQuery({
    queryKey: ["managed-java", 21],
    queryFn: () => tauri.hasManagedJava(21),
    retry: false,
  });

  const prism = useQuery({
    queryKey: ["prism"],
    queryFn: () => tauri.detectPrism(),
    retry: false,
  });
  const prismSettings = useQuery({
    queryKey: ["prism-settings"],
    queryFn: () => tauri.getPrismSettings(),
    retry: false,
  });

  useEffect(() => {
    setOfflineUsername(prismSettings.data?.offlineUsername ?? "");
  }, [prismSettings.data?.offlineUsername]);

  useEffect(() => {
    if (!appStorage.data) {
      return;
    }
    setUseDefaultPath(appStorage.data.isDefault);
    setCustomRootPath(appStorage.data.overrideDataDir ?? appStorage.data.dataDir);
  }, [appStorage.data]);

  const saveAppStorage = useMutation({
    mutationFn: (overrideDataDir: string | null) => tauri.setAppStorageSettings(overrideDataDir),
    onSuccess: async (settings) => {
      setUseDefaultPath(settings.isDefault);
      setCustomRootPath(settings.overrideDataDir ?? settings.dataDir);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["app-storage"] }),
        qc.invalidateQueries({ queryKey: ["packs"] }),
        qc.invalidateQueries({ queryKey: ["managed-java", 21] }),
        qc.invalidateQueries({ queryKey: ["prism"] }),
        qc.invalidateQueries({ queryKey: ["prism-settings"] }),
      ]);
      toast.success("Install path saved");
    },
    onError: (e) => toast.error("Install path save failed", { description: formatError(e) }),
  });
  const saveUsername = useMutation({
    mutationFn: (username: string) =>
      tauri.setPrismSettings(
        prismSettings.data?.binaryPath ?? null,
        prismSettings.data?.dataDir ?? null,
        username.trim() || null,
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["prism-settings"] });
      toast.success("Offline username saved");
    },
    onError: (e) => toast.error("Username save failed", { description: formatError(e) }),
  });
  const clearOnboardingSettings = useMutation({
    mutationFn: () => tauri.clearOnboardingSettings(21),
    onSuccess: async (settings) => {
      setOfflineUsername(settings.offlineUsername ?? "");
      setJavaInstallProgress(null);
      setJavaInstallLogs([]);
      setPrismInstallProgress(null);
      setPrismInstallLogs([]);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["managed-java", 21] }),
        qc.invalidateQueries({ queryKey: ["prism"] }),
        qc.invalidateQueries({ queryKey: ["prism-settings"] }),
      ]);
      toast.success("Onboarding settings cleared");
    },
    onError: (e) => toast.error("Clear settings failed", { description: formatError(e) }),
  });

  const installJava = useMutation({
    mutationFn: () => tauri.installAdoptiumJava("__onboarding__", 21, "jre"),
    onMutate: () => {
      setJavaInstallProgress({
        packId: "__onboarding__",
        stage: "queued",
        progress: 0,
        currentBytes: null,
        totalBytes: null,
        logLine: null,
      });
      setJavaInstallLogs(["> queue Java install"]);
    },
    onSuccess: async (runtime) => {
      await qc.invalidateQueries({ queryKey: ["managed-java", 21] });
      toast.success("Java installed", { description: runtime.displayName });
    },
    onError: (e) => toast.error("Java install failed", { description: formatError(e) }),
  });
  const installManagedPrism = useMutation({
    mutationFn: () => tauri.installManagedPrism(),
    onMutate: () => {
      setPrismInstallProgress({
        stage: "queued",
        progress: 0,
        currentBytes: null,
        totalBytes: null,
        logLine: null,
      });
      setPrismInstallLogs(["> queue launcher install"]);
    },
    onSuccess: async (install) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["prism"] }),
        qc.invalidateQueries({ queryKey: ["prism-settings"] }),
      ]);
      toast.success("Launcher installed", { description: `${install.version} · ${install.assetName}` });
    },
    onError: (e) => toast.error("Launcher install failed", { description: formatError(e) }),
  });

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    void listen<JavaInstallProgressEvent>("java-install-progress", (event) => {
      if (event.payload.packId !== "__onboarding__") return;
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
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    void listen<PrismInstallProgressEvent>("prism-install-progress", (event) => {
      setPrismInstallProgress(event.payload);
      if (event.payload.logLine) {
        setPrismInstallLogs((current) => [...current, event.payload.logLine as string]);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  const pathReady = !!appStorage.data?.confirmed;
  const javaReady = !!managedJava.data;
  const launcherReady = !!prismSettings.data?.binaryPath && !!prismSettings.data?.dataDir && !!prism.data;
  const usernameReady = !!prismSettings.data?.offlineUsername?.trim();
  const firstIncompleteStep = [pathReady, javaReady, launcherReady, usernameReady].findIndex((step) => !step);
  const currentStep = firstIncompleteStep === -1 ? 4 : firstIncompleteStep;

  useEffect(() => {
    setDisplayedStep((value) => (value < currentStep ? currentStep : value));
  }, [currentStep]);

  async function handleBrowseInstallRoot() {
    try {
      const selected = await open({
        title: "Select gisketch//s_modpack_syncer data directory",
        defaultPath: customRootPath || appStorage.data?.dataDir || undefined,
        directory: true,
      });
      if (typeof selected === "string") {
        setCustomRootPath(selected);
      }
    } catch (error) {
      toast.error("Browse install path failed", { description: formatError(error) });
    }
  }

  const steps = [
    { label: "PATH", done: pathReady },
    { label: "JAVA", done: javaReady },
    { label: "PRISM", done: launcherReady },
    { label: "NAME", done: usernameReady },
    { label: "PACKS", done: false },
  ];

  const pageTitle = ["Choose install path", "Install Java", "Install Prism", "Set username", "Go to packs"][displayedStep];
  const pageDescription = [
    "Pick default location or custom drive for gisketch//s_modpack_syncer data, managed Java, launcher, cache, and packs.",
    "Install managed Temurin runtime into chosen gisketch//s_modpack_syncer location.",
    "Install PrismLauncher-Cracked into chosen gisketch//s_modpack_syncer location and auto-save launcher paths.",
    "Save offline username gisketch//s_modpack_syncer should force into cracked launcher.",
    "Setup complete. Jump to packs page and clone modpack there.",
  ][displayedStep];

  return (
    <div className="relative flex min-h-full w-full items-start justify-center overflow-visible px-4 py-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-tactical-grid opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, color-mix(in srgb, var(--brand-core) 8%, transparent), transparent 70%)",
        }}
      />
      <div className="relative flex w-full max-w-5xl flex-col gap-6 border border-[--line-strong] bg-[--surface-elevated] p-6 sm:p-8 corner-brackets scanlines-overlay">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-1.5 w-1.5 bg-[--signal-live] shadow-[0_0_8px_var(--signal-live)]" />
              <span className="cp-tactical-label text-[--brand-core]">:: ONBOARDING :: SYSTEM READY</span>
            </div>
            <h1 className="text-3xl text-[--text-high] text-balance">Welcome to gisketch//s_modpack_syncer</h1>
            <p className="max-w-3xl text-sm text-[--text-low] text-pretty">
              Follow setup flow in order. Each step turns into brand box when finished. Last step clones first pack or returns to packs if setup already done.
            </p>
          </div>
          {openedFromSettings ? (
            <Button
              variant="outline"
              onClick={() => clearOnboardingSettings.mutate()}
              disabled={clearOnboardingSettings.isPending || saveAppStorage.isPending || installJava.isPending || installManagedPrism.isPending || saveUsername.isPending}
              className="min-h-10 shrink-0"
            >
              {clearOnboardingSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              CLEAR SETTINGS
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <StepSegments
            steps={steps}
            activeIndex={displayedStep}
            onSelect={(index) => {
              if (index <= currentStep) {
                setDisplayedStep(index);
              }
            }}
          />

          <Card className="shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
            <CardHeader>
              <CardTitle className="text-balance">{pageTitle}</CardTitle>
              <CardDescription className="text-pretty">{pageDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {displayedStep === 0 ? (
                <PathStepPanel
                  appStorage={appStorage.data}
                  useDefaultPath={useDefaultPath}
                  customRootPath={customRootPath}
                  isPending={saveAppStorage.isPending}
                  onToggleDefault={setUseDefaultPath}
                  onChangeCustomPath={setCustomRootPath}
                  onBrowse={handleBrowseInstallRoot}
                  onSave={() => saveAppStorage.mutate(useDefaultPath ? null : customRootPath.trim() || null)}
                />
              ) : null}

              {displayedStep === 1 ? (
                <InstallStepPanel
                  eyebrow="2 / 5"
                  statusLabel={javaReady ? "READY" : managedJava.isLoading ? "CHECKING" : "MISSING"}
                  detail="Managed Temurin 21 runtime installs into chosen gisketch//s_modpack_syncer path."
                  isPending={installJava.isPending}
                  actionLabel={javaReady ? "JAVA READY" : "INSTALL JAVA"}
                  actionIcon={<Download className="h-4 w-4" />}
                  actionDisabled={!pathReady || installJava.isPending || javaReady}
                  onAction={() => installJava.mutate()}
                  progress={javaInstallProgress?.progress ?? 0}
                  stage={javaInstallProgress?.stage ?? "queued"}
                  currentBytes={javaInstallProgress?.currentBytes ?? null}
                  totalBytes={javaInstallProgress?.totalBytes ?? null}
                  logs={javaInstallLogs}
                />
              ) : null}

              {displayedStep === 2 ? (
                <InstallStepPanel
                  eyebrow="3 / 5"
                  statusLabel={launcherReady ? "READY" : prism.isLoading ? "CHECKING" : "MISSING"}
                  detail="Managed PrismLauncher-Cracked installs into chosen gisketch//s_modpack_syncer path and auto-saves binary + data paths."
                  isPending={installManagedPrism.isPending}
                  actionLabel={launcherReady ? "PRISM READY" : "INSTALL PRISM"}
                  actionIcon={<Package className="h-4 w-4" />}
                  actionDisabled={!pathReady || !javaReady || installManagedPrism.isPending || launcherReady}
                  onAction={() => installManagedPrism.mutate()}
                  progress={prismInstallProgress?.progress ?? 0}
                  stage={prismInstallProgress?.stage ?? "queued"}
                  currentBytes={prismInstallProgress?.currentBytes ?? null}
                  totalBytes={prismInstallProgress?.totalBytes ?? null}
                  logs={prismInstallLogs}
                >
                  <StatusLine label="BINARY" value={prismSettings.data?.binaryPath || "NOT SET"} mono />
                  <StatusLine label="DATA" value={prismSettings.data?.dataDir || "NOT SET"} mono />
                </InstallStepPanel>
              ) : null}

              {displayedStep === 3 ? (
                <div className="flex flex-col gap-4">
                  <StatusLine label="STEP" value="4 / 5" />
                  <Input
                    value={offlineUsername}
                    onChange={(event) => setOfflineUsername(event.target.value)}
                    placeholder="Offline username"
                    autoFocus
                  />
                  <p className="text-sm text-[--text-low] text-pretty">
                    Launch flow rewrites Prism offline account selection before spawn, so stale launcher-stored name no longer wins.
                  </p>
                  <Button
                    onClick={() => saveUsername.mutate(offlineUsername)}
                    disabled={!pathReady || !javaReady || !launcherReady || saveUsername.isPending || !offlineUsername.trim()}
                  >
                    {saveUsername.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
                    SAVE USERNAME
                  </Button>
                </div>
              ) : null}

              {displayedStep === 4 ? (
                <div className="flex flex-col gap-4">
                  <StatusLine label="STEP" value="5 / 5" />
                  <div className="border border-line-soft/20 bg-surface-sunken/60 p-4 text-sm text-text-low text-pretty">
                    Setup complete. Next screen = packs page. Clone modpack there with existing Git URL box.
                  </div>
                  <Button onClick={() => go({ kind: "packs" })} disabled={!usernameReady}>
                    <ChevronRight className="h-4 w-4" /> OPEN PACKS PAGE
                  </Button>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 border-t border-line-soft/20 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setDisplayedStep((value) => Math.max(0, value - 1))}
                  disabled={displayedStep === 0}
                >
                  <ChevronLeft className="h-4 w-4" /> BACK
                </Button>
                <span className="cp-tactical-label text-[10px] text-text-low">STEP {displayedStep + 1} / 5</span>
                <Button
                  variant="outline"
                  onClick={() => setDisplayedStep((value) => Math.min(currentStep, value + 1))}
                  disabled={displayedStep >= currentStep}
                >
                  NEXT <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StepSegments({
  steps,
  activeIndex,
  onSelect,
}: {
  steps: Array<{ label: string; done: boolean }>;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2 border border-line-soft/20 bg-surface-sunken/50 p-2">
      {steps.map((step, index) => {
        const active = activeIndex === index;
        return (
          <button
            key={step.label}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 border px-2 py-2 text-center transition-colors",
              step.done
                ? "border-brand-core bg-brand-core text-text-on-brand"
                : active
                  ? "border-brand-core/50 bg-brand-core/10 text-text-high"
                  : "border-line-soft/20 bg-surface text-text-low",
            )}
          >
            <span className="h-1 w-full max-w-10 rounded-full bg-current/70" />
            <span className="cp-tactical-label text-[10px]">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PathStepPanel({
  appStorage,
  useDefaultPath,
  customRootPath,
  isPending,
  onToggleDefault,
  onChangeCustomPath,
  onBrowse,
  onSave,
}: {
  appStorage?: AppStorageSettings;
  useDefaultPath: boolean;
  customRootPath: string;
  isPending: boolean;
  onToggleDefault: (checked: boolean) => void;
  onChangeCustomPath: (value: string) => void;
  onBrowse: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <StatusLine label="STEP" value="1 / 5" />
      <StatusLine label="DEFAULT" value={appStorage?.defaultDataDir || "Loading..."} mono />
      <div className="flex items-start gap-3 border border-line-soft/20 bg-surface-sunken/60 p-4">
        <Checkbox checked={useDefaultPath} onCheckedChange={(checked) => onToggleDefault(checked === true)} className="mt-0.5 size-5" />
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-text-high">Use default gisketch//s_modpack_syncer location</p>
          <p className="text-sm text-text-low text-pretty">
            Leave checked for normal install. Uncheck to place all gisketch//s_modpack_syncer-managed data on another drive or folder.
          </p>
        </div>
      </div>
      {!useDefaultPath ? (
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={customRootPath}
            onChange={(event) => onChangeCustomPath(event.target.value)}
            placeholder="D:\\gisketch_s_modpack_syncer or /mnt/games/gisketch_s_modpack_syncer"
          />
          <Button variant="secondary" onClick={onBrowse}>
            <FolderOpen className="h-4 w-4" /> BROWSE
          </Button>
        </div>
      ) : null}
      <StatusLine label="ACTIVE" value={useDefaultPath ? appStorage?.defaultDataDir || "Loading..." : customRootPath || "NOT SET"} mono />
      <Button onClick={onSave} disabled={isPending || (!useDefaultPath && !customRootPath.trim())}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        SAVE INSTALL PATH
      </Button>
    </div>
  );
}

function StatusLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-[--line-soft] bg-[--surface-sunken] px-3 py-2 text-xs">
      <span className="cp-tactical-label text-[--text-low]">{label}</span>
      <span className={cn("max-w-[70%] truncate text-[--text-high]", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function InstallStepPanel({
  eyebrow,
  statusLabel,
  detail,
  isPending,
  actionLabel,
  actionIcon,
  actionDisabled,
  onAction,
  progress,
  stage,
  currentBytes,
  totalBytes,
  logs,
  children,
}: {
  eyebrow: string;
  statusLabel: string;
  detail: string;
  isPending: boolean;
  actionLabel: string;
  actionIcon: React.ReactNode;
  actionDisabled: boolean;
  onAction: () => void;
  progress: number;
  stage: string;
  currentBytes: number | null;
  totalBytes: number | null;
  logs: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <StatusLine label="STEP" value={eyebrow} />
      <StatusLine label="STATUS" value={statusLabel} />
      {children}
      <p className="text-sm text-[--text-low] text-pretty">{detail}</p>
      {isPending ? (
        <ProgressPanel
          progress={progress}
          stage={stage}
          currentBytes={currentBytes}
          totalBytes={totalBytes}
          logs={logs}
        />
      ) : null}
      <Button onClick={onAction} disabled={actionDisabled}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : actionIcon}
        {actionLabel}
      </Button>
    </div>
  );
}

function ProgressPanel({
  progress,
  stage,
  currentBytes,
  totalBytes,
  logs,
}: {
  progress: number;
  stage: string;
  currentBytes: number | null;
  totalBytes: number | null;
  logs: string[];
}) {
  return (
    <div className="flex flex-col gap-3 border border-[--line-soft] bg-[--surface-sunken] p-4">
      <div className="flex items-center justify-between gap-3 text-xs text-[--text-low]">
        <span className="font-heading uppercase tracking-[0.18em]">INSTALL PROGRESS</span>
        <span className="font-mono tabular-nums">{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden border border-[--line-soft] bg-[--surface]">
        <div className="h-full bg-brand-core transition-[width] duration-200" style={{ width: `${Math.max(progress, 4)}%` }} />
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] text-[--text-low] tabular-nums">
        <span>{stage.toUpperCase()}</span>
        <span>{currentBytes != null ? `${formatByteCount(currentBytes)}${totalBytes != null ? ` / ${formatByteCount(totalBytes)}` : ""}` : ""}</span>
      </div>
      <div className="max-h-44 overflow-y-auto border border-[--line-soft] bg-black/30 p-3 font-mono text-[11px] text-[--text-low]">
        {logs.length > 0 ? logs.map((line, index) => <div key={`${line}:${index}`}>{line}</div>) : <span>Waiting for install output...</span>}
      </div>
    </div>
  );
}

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
