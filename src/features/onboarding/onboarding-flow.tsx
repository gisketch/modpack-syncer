import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  HardDrive,
  Loader2,
  Package,
  RotateCcw,
  User,
} from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardStatus, CardWindowBar, CardWindowTab } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion } from "@/components/ui/motion";
import { formatError } from "@/lib/format-error";
import { type JavaInstallProgressEvent, type PrismInstallProgressEvent, tauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useNav } from "@/stores/nav-store";

type OnboardingStep = "directory" | "java" | "prism" | "username";

const ONBOARDING_STEPS: Array<{ id: OnboardingStep; label: string }> = [
  { id: "directory", label: "DIRECTORY" },
  { id: "java", label: "JAVA" },
  { id: "prism", label: "PRISM" },
  { id: "username", label: "USERNAME" },
];

export function OnboardingRoute({ openedFromSettings = false }: { openedFromSettings?: boolean }) {
  const go = useNav((s) => s.go);
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<OnboardingStep>("directory");
  const [stepInitialized, setStepInitialized] = useState(false);
  const [installDirectoryDraft, setInstallDirectoryDraft] = useState("");
  const [offlineUsername, setOfflineUsername] = useState("");
  const [javaInstallProgress, setJavaInstallProgress] = useState<JavaInstallProgressEvent | null>(
    null,
  );
  const [javaInstallLogs, setJavaInstallLogs] = useState<string[]>([]);
  const [prismInstallProgress, setPrismInstallProgress] =
    useState<PrismInstallProgressEvent | null>(null);
  const [prismInstallLogs, setPrismInstallLogs] = useState<string[]>([]);

  const installDirectory = useQuery({
    queryKey: ["install-directory"],
    queryFn: () => tauri.getInstallDirectory(),
    retry: false,
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

  const directoryReady = !!installDirectory.data?.defaultDir;
  const javaReady = !!managedJava.data;
  const launcherReady =
    !!prismSettings.data?.binaryPath && !!prismSettings.data?.dataDir && !!prism.data;
  const usernameReady = !!prismSettings.data?.offlineUsername?.trim();
  const currentStepIndex = ONBOARDING_STEPS.findIndex((item) => item.id === step);
  const setupQueriesLoading =
    installDirectory.isLoading ||
    managedJava.isLoading ||
    prism.isLoading ||
    prismSettings.isLoading;
  const firstIncompleteStep = useMemo(() => {
    const states = [directoryReady, javaReady, launcherReady, usernameReady];
    const index = states.findIndex((done) => !done);
    return ONBOARDING_STEPS[index === -1 ? ONBOARDING_STEPS.length - 1 : index].id;
  }, [directoryReady, javaReady, launcherReady, usernameReady]);

  useEffect(() => {
    setInstallDirectoryDraft(
      installDirectory.data?.defaultDir ?? installDirectory.data?.effectiveDir ?? "",
    );
  }, [installDirectory.data?.defaultDir, installDirectory.data?.effectiveDir]);

  useEffect(() => {
    setOfflineUsername(prismSettings.data?.offlineUsername ?? "");
  }, [prismSettings.data?.offlineUsername]);

  useEffect(() => {
    if (stepInitialized || setupQueriesLoading) return;
    setStep(firstIncompleteStep);
    setStepInitialized(true);
  }, [firstIncompleteStep, setupQueriesLoading, stepInitialized]);

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
    return () => unlisten?.();
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
    return () => unlisten?.();
  }, []);

  const setInstallDirectory = useMutation({
    mutationFn: (defaultDir: string) => tauri.setInstallDirectory(defaultDir.trim() || null),
    onSuccess: async (settings) => {
      setInstallDirectoryDraft(settings.defaultDir ?? settings.effectiveDir);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["install-directory"] }),
        qc.invalidateQueries({ queryKey: ["packs"] }),
        qc.invalidateQueries({ queryKey: ["managed-java", 21] }),
        qc.invalidateQueries({ queryKey: ["prism"] }),
        qc.invalidateQueries({ queryKey: ["prism-settings"] }),
      ]);
      setStep("java");
      toast.success("Directory saved");
    },
    onError: (error) => toast.error("Directory save failed", { description: formatError(error) }),
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
    onError: (error) => toast.error("Java install failed", { description: formatError(error) }),
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
      toast.success("Launcher installed", {
        description: `${install.version} · ${install.assetName}`,
      });
    },
    onError: (error) => toast.error("Launcher install failed", { description: formatError(error) }),
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
      toast.success("Username saved");
      go({ kind: "packs" });
    },
    onError: (error) => toast.error("Username save failed", { description: formatError(error) }),
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
      setStep("directory");
      toast.success("Onboarding settings cleared");
    },
    onError: (error) => toast.error("Clear settings failed", { description: formatError(error) }),
  });

  async function handleBrowseInstallDirectory() {
    try {
      const selected = await open({
        title: "Select modsync install directory",
        defaultPath: installDirectoryDraft || installDirectory.data?.effectiveDir || undefined,
        directory: true,
      });
      if (typeof selected === "string") {
        setInstallDirectoryDraft(selected);
      }
    } catch (error) {
      toast.error("Browse directory failed", { description: formatError(error) });
    }
  }

  function goNext() {
    if (step === "directory") {
      setInstallDirectory.mutate(installDirectoryDraft);
      return;
    }
    if (step === "java") {
      setStep("prism");
      return;
    }
    if (step === "prism") {
      setStep("username");
      return;
    }
    if (usernameReady && !offlineUsername.trim()) {
      go({ kind: "packs" });
      return;
    }
    saveUsername.mutate(offlineUsername);
  }

  function goBack() {
    const previous = ONBOARDING_STEPS[Math.max(0, currentStepIndex - 1)];
    setStep(previous.id);
  }

  const nextDisabled =
    (step === "directory" && (!installDirectoryDraft.trim() || setInstallDirectory.isPending)) ||
    (step === "java" && (!javaReady || installJava.isPending)) ||
    (step === "prism" && (!launcherReady || installManagedPrism.isPending)) ||
    (step === "username" && (!offlineUsername.trim() || saveUsername.isPending));

  return (
    <div className="relative flex min-h-full w-full items-center justify-center overflow-hidden p-4 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-tactical-grid opacity-55"
      />
      <Card
        variant="window"
        className="relative flex max-h-[min(42rem,92vh)] w-full max-w-4xl flex-col overflow-hidden"
      >
        <CardWindowBar>
          <CardWindowTab>ONBOARDING</CardWindowTab>
          <CardStatus>
            {currentStepIndex + 1} / {ONBOARDING_STEPS.length}
          </CardStatus>
          {openedFromSettings ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearOnboardingSettings.mutate()}
              disabled={clearOnboardingSettings.isPending}
              className="ml-auto"
            >
              {clearOnboardingSettings.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RotateCcw />
              )}
              CLEAR
            </Button>
          ) : null}
        </CardWindowBar>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-5 p-5 sm:p-6">
          <SegmentedProgress currentStep={step} />
          <div className="min-h-0 flex-1 overflow-hidden border border-line-soft/40 bg-surface-sunken/50 p-4 sm:p-5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                className="h-full"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(2px)" }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(2px)" }}
                transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {step === "directory" ? (
                  <StepFrame
                    icon={<HardDrive className="size-5" />}
                    title="SET DEFAULT DIRECTORY"
                    status={directoryReady ? "READY" : "REQUIRED"}
                  >
                    <div className="grid gap-4">
                      <StatusLine
                        label="CURRENT"
                        value={installDirectory.data?.effectiveDir ?? "CHECKING"}
                        mono
                      />
                      <div className="grid gap-2">
                        <span className="cp-tactical-label text-[10px] text-text-low">
                          DIRECTORY
                        </span>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={installDirectoryDraft}
                            onChange={(event) => setInstallDirectoryDraft(event.target.value)}
                            placeholder="/path/to/modsync"
                            className="font-mono text-xs"
                          />
                          <Button
                            variant="secondary"
                            onClick={() => void handleBrowseInstallDirectory()}
                          >
                            <FolderOpen className="size-4" /> BROWSE
                          </Button>
                        </div>
                      </div>
                      <StatusLine label="USES" value="LAUNCHER / JAVA / MODPACKS" />
                    </div>
                  </StepFrame>
                ) : null}

                {step === "java" ? (
                  <StepFrame
                    icon={<Download className="size-5" />}
                    title="INSTALL JAVA"
                    status={javaReady ? "READY" : "MISSING"}
                  >
                    <div className="grid gap-4">
                      <StatusLine
                        label="RUNTIME"
                        value={
                          javaReady
                            ? "TEMURIN 21 READY"
                            : managedJava.isLoading
                              ? "CHECKING"
                              : "NOT INSTALLED"
                        }
                      />
                      {installJava.isPending ? (
                        <ProgressPanel
                          progress={javaInstallProgress?.progress ?? 0}
                          stage={javaInstallProgress?.stage ?? "queued"}
                          currentBytes={javaInstallProgress?.currentBytes ?? null}
                          totalBytes={javaInstallProgress?.totalBytes ?? null}
                          logs={javaInstallLogs}
                        />
                      ) : null}
                      <Button
                        onClick={() => installJava.mutate()}
                        disabled={installJava.isPending || javaReady}
                      >
                        {installJava.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Download />
                        )}
                        {javaReady ? "JAVA READY" : "INSTALL JAVA"}
                      </Button>
                    </div>
                  </StepFrame>
                ) : null}

                {step === "prism" ? (
                  <StepFrame
                    icon={<Package className="size-5" />}
                    title="INSTALL PRISM"
                    status={launcherReady ? "READY" : "MISSING"}
                  >
                    <div className="grid gap-4">
                      <StatusLine
                        label="BINARY"
                        value={prismSettings.data?.binaryPath || "NOT SET"}
                        mono
                      />
                      <StatusLine
                        label="DATA"
                        value={prismSettings.data?.dataDir || "NOT SET"}
                        mono
                      />
                      {installManagedPrism.isPending ? (
                        <ProgressPanel
                          progress={prismInstallProgress?.progress ?? 0}
                          stage={prismInstallProgress?.stage ?? "queued"}
                          currentBytes={prismInstallProgress?.currentBytes ?? null}
                          totalBytes={prismInstallProgress?.totalBytes ?? null}
                          logs={prismInstallLogs}
                        />
                      ) : null}
                      <Button
                        onClick={() => installManagedPrism.mutate()}
                        disabled={installManagedPrism.isPending || launcherReady}
                      >
                        {installManagedPrism.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Package />
                        )}
                        {launcherReady ? "PRISM READY" : "INSTALL PRISM"}
                      </Button>
                    </div>
                  </StepFrame>
                ) : null}

                {step === "username" ? (
                  <StepFrame
                    icon={<User className="size-5" />}
                    title="USERNAME"
                    status={usernameReady ? "READY" : "REQUIRED"}
                  >
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <span className="cp-tactical-label text-[10px] text-text-low">
                          OFFLINE USERNAME
                        </span>
                        <Input
                          value={offlineUsername}
                          onChange={(event) => setOfflineUsername(event.target.value)}
                          placeholder="Username"
                          autoFocus
                          className="normal-case tracking-normal"
                        />
                      </div>
                      <StatusLine label="NEXT" value="PACKS" />
                    </div>
                  </StepFrame>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={goBack} disabled={currentStepIndex === 0}>
              <ChevronLeft className="size-4" /> BACK
            </Button>
            <Button onClick={goNext} disabled={nextDisabled}>
              {setInstallDirectory.isPending || saveUsername.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              {step === "username" ? "FINISH" : "NEXT"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SegmentedProgress({ currentStep }: { currentStep: OnboardingStep }) {
  const currentIndex = ONBOARDING_STEPS.findIndex((item) => item.id === currentStep);
  return (
    <div className="grid grid-cols-4 gap-2">
      {ONBOARDING_STEPS.map((item, index) => {
        const active = index === currentIndex;
        const complete = index < currentIndex;
        return (
          <div key={item.id} className="grid gap-2">
            <div
              className={cn(
                "h-1.5 border border-line-soft/30 transition-colors",
                active || complete ? "bg-brand-core" : "bg-surface",
              )}
            />
            <span
              className={cn(
                "cp-tactical-label text-[10px]",
                active ? "text-text-high" : "text-text-low",
              )}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StepFrame({
  icon,
  title,
  status,
  children,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <div className="grid h-full min-h-[22rem] content-start gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center border border-brand-core/60 bg-brand-core/10 text-brand-core">
            {icon}
          </div>
          <div className="grid gap-1">
            <h1 className="text-xl text-text-high text-balance">{title}</h1>
            <span className="cp-tactical-label text-[10px] text-text-low">STEP CONFIGURATION</span>
          </div>
        </div>
        <span className="cp-tactical-label border border-line-soft/40 px-2 py-1 text-[10px] text-text-low">
          {status}
        </span>
      </div>
      {children}
    </div>
  );
}

function StatusLine({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border border-line-soft/40 bg-surface px-3 py-2 text-xs">
      <span className="cp-tactical-label shrink-0 text-text-low">{label}</span>
      <span className={cn("truncate text-right text-text-high", mono && "font-mono text-[11px]")}>
        {value}
      </span>
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
  const logOccurrences = new Map<string, number>();

  return (
    <div className="grid gap-3 border border-line-soft/40 bg-surface p-4">
      <div className="flex items-center justify-between gap-3 text-xs text-text-low">
        <span className="font-heading uppercase tracking-[0.18em]">PROGRESS</span>
        <span className="font-mono tabular-nums">{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden border border-line-soft/40 bg-surface-sunken">
        <div
          className="h-full bg-brand-core transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(progress, 4)}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] text-text-low tabular-nums">
        <span>{stage.toUpperCase()}</span>
        <span>
          {currentBytes != null
            ? `${formatByteCount(currentBytes)}${totalBytes != null ? ` / ${formatByteCount(totalBytes)}` : ""}`
            : ""}
        </span>
      </div>
      <div className="max-h-32 overflow-y-auto border border-line-soft/40 bg-black/30 p-3 font-mono text-[11px] text-text-low">
        {logs.length > 0 ? (
          logs.map((line) => {
            const occurrence = (logOccurrences.get(line) ?? 0) + 1;
            logOccurrences.set(line, occurrence);
            return <div key={`${line}:${occurrence}`}>{line}</div>;
          })
        ) : (
          <span>Waiting...</span>
        )}
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
  return unitIndex === 0
    ? `${Math.round(size)} ${units[unitIndex]}`
    : `${size.toFixed(1)} ${units[unitIndex]}`;
}
