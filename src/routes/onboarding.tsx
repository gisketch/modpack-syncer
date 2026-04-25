import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Download, FolderGit2, Loader2, Package, RotateCcw, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatError } from "@/lib/format-error";
import { type JavaInstallProgressEvent, type PrismInstallProgressEvent, tauri } from "@/lib/tauri";
import { useNav } from "@/stores/nav-store";

export function OnboardingRoute({ openedFromSettings = false }: { openedFromSettings?: boolean }) {
  const go = useNav((s) => s.go);
  const qc = useQueryClient();
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hasMountedStepScroll = useRef(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offlineUsername, setOfflineUsername] = useState("");
  const [javaInstallProgress, setJavaInstallProgress] = useState<JavaInstallProgressEvent | null>(null);
  const [javaInstallLogs, setJavaInstallLogs] = useState<string[]>([]);
  const [prismInstallProgress, setPrismInstallProgress] = useState<PrismInstallProgressEvent | null>(null);
  const [prismInstallLogs, setPrismInstallLogs] = useState<string[]>([]);

  const packs = useQuery({
    queryKey: ["packs"],
    queryFn: () => tauri.listPacks(),
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

  const addPack = useMutation({
    mutationFn: (u: string) => tauri.addPack(u),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["packs"] });
      toast.success("Pack cloned");
    },
    onError: (e: unknown) => setError(formatError(e)),
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
      setError(null);
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

  const javaReady = !!managedJava.data;
  const launcherReady = !!prismSettings.data?.binaryPath && !!prismSettings.data?.dataDir && !!prism.data;
  const usernameReady = !!prismSettings.data?.offlineUsername?.trim();
  const packsReady = (packs.data?.length ?? 0) > 0;
  const stepStates = useMemo(
    () => [javaReady, launcherReady, usernameReady, packsReady],
    [javaReady, launcherReady, usernameReady, packsReady],
  );
  const firstIncompleteStep = stepStates.findIndex((step) => !step);
  const currentStep = firstIncompleteStep === -1 ? stepStates.length - 1 : firstIncompleteStep;
  const setupReadyForPack = javaReady && launcherReady && usernameReady;

  useEffect(() => {
    if (!hasMountedStepScroll.current) {
      hasMountedStepScroll.current = true;
      return;
    }
    stepRefs.current[currentStep]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [currentStep]);

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
            <h1 className="text-3xl text-[--text-high] text-balance">Welcome to modsync</h1>
            <p className="max-w-3xl text-sm text-[--text-low] text-pretty">
              Follow setup flow in order. Each step turns into brand box when finished. Last step clones first pack or returns to packs if setup already done.
            </p>
          </div>
          {openedFromSettings ? (
            <Button
              variant="outline"
              onClick={() => clearOnboardingSettings.mutate()}
              disabled={clearOnboardingSettings.isPending || installJava.isPending || installManagedPrism.isPending || saveUsername.isPending}
              className="min-h-10 shrink-0"
            >
              {clearOnboardingSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              CLEAR SETTINGS
            </Button>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="xl:sticky xl:top-6 xl:self-start">
            <CardHeader>
              <CardTitle>SETUP FLOW</CardTitle>
              <CardDescription>Status checks update live</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {[
                  { label: "Java", done: javaReady },
                  { label: "Launcher", done: launcherReady },
                  { label: "Username", done: usernameReady },
                  { label: "Packs", done: packsReady },
                ].map((step, index) => {
                  const active = currentStep === index;
                  return (
                    <div
                      key={step.label}
                      className={cn(
                        "flex items-center gap-3 border px-3 py-3 text-sm",
                        step.done
                          ? "border-[--brand-core] bg-[--surface-sunken]"
                          : active
                            ? "border-[--line-strong] bg-[--surface-sunken]"
                            : "border-[--line-soft] bg-[--surface]",
                      )}
                    >
                      <StepBox done={step.done}>{step.done ? <Check className="h-4 w-4" /> : index + 1}</StepBox>
                      <div className="flex flex-1 items-center justify-between gap-2">
                        <span className="text-[--text-high]">{step.label}</span>
                        <span className="cp-tactical-label text-[10px] text-[--text-low]">
                          {step.done ? "READY" : active ? "CURRENT" : "PENDING"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <div ref={(node) => { stepRefs.current[0] = node; }} className="scroll-mt-6">
              <OnboardingStepCard
                step={1}
                title="INSTALL JAVA"
                description="Download managed Temurin 21 runtime for launcher use."
                done={javaReady}
                active={currentStep === 0}
              >
                <div className="flex flex-col gap-3">
                  <StatusLine label="STATUS" value={javaReady ? "READY" : managedJava.isLoading ? "CHECKING" : "MISSING"} />
                  {installJava.isPending ? (
                    <ProgressPanel
                      progress={javaInstallProgress?.progress ?? 0}
                      stage={javaInstallProgress?.stage ?? "queued"}
                      currentBytes={javaInstallProgress?.currentBytes ?? null}
                      totalBytes={javaInstallProgress?.totalBytes ?? null}
                      logs={javaInstallLogs}
                    />
                  ) : (
                    <p className="text-sm text-[--text-low] text-pretty">
                      Uses same managed Adoptium installer as launch dialog. Installs into modsync data dir.
                    </p>
                  )}
                  <Button onClick={() => installJava.mutate()} disabled={installJava.isPending || javaReady}>
                    {installJava.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {javaReady ? "JAVA READY" : "INSTALL JAVA"}
                  </Button>
                </div>
              </OnboardingStepCard>
            </div>

            <div ref={(node) => { stepRefs.current[1] = node; }} className="scroll-mt-6">
              <OnboardingStepCard
                step={2}
                title="INSTALL PRISM LAUNCHER CRACKED"
                description="Install managed portable launcher and auto-fill launcher paths."
                done={launcherReady}
                active={currentStep === 1}
              >
                <div className="flex flex-col gap-3">
                  <StatusLine label="BINARY" value={prismSettings.data?.binaryPath || "NOT SET"} mono />
                  <StatusLine label="DATA" value={prismSettings.data?.dataDir || "NOT SET"} mono />
                  {installManagedPrism.isPending ? (
                    <ProgressPanel
                      progress={prismInstallProgress?.progress ?? 0}
                      stage={prismInstallProgress?.stage ?? "queued"}
                      currentBytes={prismInstallProgress?.currentBytes ?? null}
                      totalBytes={prismInstallProgress?.totalBytes ?? null}
                      logs={prismInstallLogs}
                    />
                  ) : (
                    <p className="text-sm text-[--text-low] text-pretty">
                      Installs PrismLauncher-Cracked portable build, verifies GitHub SHA-256 digest, saves binary + data path automatically.
                    </p>
                  )}
                  <Button onClick={() => installManagedPrism.mutate()} disabled={installManagedPrism.isPending || launcherReady}>
                    {installManagedPrism.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                    {launcherReady ? "LAUNCHER READY" : "INSTALL LAUNCHER"}
                  </Button>
                </div>
              </OnboardingStepCard>
            </div>

            <div ref={(node) => { stepRefs.current[2] = node; }} className="scroll-mt-6">
              <OnboardingStepCard
                step={3}
                title="SET USERNAME"
                description="Save offline username modsync should force into cracked launcher."
                done={usernameReady}
                active={currentStep === 2}
              >
                <div className="flex flex-col gap-3">
                  <Input
                    value={offlineUsername}
                    onChange={(event) => setOfflineUsername(event.target.value)}
                    placeholder="Offline username"
                    autoFocus={currentStep === 2}
                  />
                  <p className="text-sm text-[--text-low] text-pretty">
                    Launch now rewrites Prism offline account selection before spawn, so stale launcher username no longer wins.
                  </p>
                  <Button onClick={() => saveUsername.mutate(offlineUsername)} disabled={saveUsername.isPending || !offlineUsername.trim()}>
                    {saveUsername.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
                    SAVE USERNAME
                  </Button>
                </div>
              </OnboardingStepCard>
            </div>

            <div ref={(node) => { stepRefs.current[3] = node; }} className="scroll-mt-6">
              <OnboardingStepCard
                step={4}
                title="GO TO PACKS"
                description="Clone first pack if none tracked. Otherwise jump back to packs screen."
                done={packsReady}
                active={currentStep === 3}
              >
                {(packs.data?.length ?? 0) === 0 ? (
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (url.trim() && setupReadyForPack) addPack.mutate(url.trim());
                    }}
                  >
                    <div className="flex flex-col gap-1.5 text-sm">
                      <label htmlFor="pack-url" className="cp-tactical-label text-[--text-low] text-[10px]">
                        :: MODPACK URL
                      </label>
                      <Input
                        id="pack-url"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://github.com/gisketch/modsync-pack.git"
                        disabled={addPack.isPending || !setupReadyForPack}
                      />
                    </div>
                    <p className="text-sm text-[--text-low] text-pretty">
                      Welcome to modsync. Paste your modpack&apos;s GitHub URL to clone it. Your pack author shares this link with you.
                    </p>
                    <div className="flex items-center justify-between gap-3 border border-[--line-soft] bg-[--surface-sunken] px-3 py-2 text-xs">
                      <span className="flex items-center gap-2 text-[--text-low]">
                        <Package className="h-3.5 w-3.5" />
                        <span className="cp-tactical-label">PRISM LAUNCHER</span>
                      </span>
                      <span className={cn("cp-tactical-label", launcherReady ? "text-[--signal-live]" : "text-[--signal-alert]")}>{launcherReady ? "READY" : "NOT READY"}</span>
                    </div>
                    <Button type="submit" size="lg" disabled={addPack.isPending || !url.trim() || !setupReadyForPack} className="w-full">
                      {addPack.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderGit2 className="h-4 w-4" />}
                      CLONE PACK
                    </Button>
                    {!setupReadyForPack ? (
                      <p className="cp-tactical-label text-[--text-low] text-xs">FINISH STEPS 1-3 BEFORE PACK INGEST</p>
                    ) : null}
                    {error ? <p className="cp-tactical-label text-[--signal-alert] text-xs">ERR :: {error}</p> : null}
                  </form>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-[--text-low] text-pretty">Setup complete. Packs already tracked: {packs.data?.length ?? 0}.</p>
                    <Button onClick={() => go({ kind: "packs" })}>
                      <ChevronRight className="h-4 w-4" /> GO TO PACKS
                    </Button>
                  </div>
                )}
              </OnboardingStepCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingStepCard({
  step,
  title,
  description,
  done,
  active,
  children,
}: {
  step: number;
  title: string;
  description: string;
  done: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(done ? "border-[--brand-core]" : active ? "border-[--line-strong]" : "border-[--line-soft]")}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StepBox done={done}>{done ? <Check className="h-4 w-4" /> : step}</StepBox>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <span className="cp-tactical-label text-[10px] text-[--text-low]">{done ? "READY" : active ? "CURRENT" : "WAITING"}</span>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StepBox({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center border text-xs font-semibold",
        done ? "border-brand-core bg-brand-core text-text-on-brand" : "border-line-soft/30 text-text-low",
      )}
    >
      {children}
    </span>
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
