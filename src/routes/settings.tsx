import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { exeExtension } from "@tauri-apps/plugin-os";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Check, Download, FolderOpen, Info, Loader2, Package, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { useAppUpdate } from "@/hooks/use-app-update";
import { useAppVersion } from "@/hooks/use-app-version";
import { formatError } from "@/lib/format-error";
import { type PrismInstallProgressEvent, tauri } from "@/lib/tauri";
import { useAppStore } from "@/stores/app-store";
import { useNav } from "@/stores/nav-store";

export function SettingsRoute() {
  const go = useNav((s) => s.go);
  const appUpdate = useAppUpdate();
  const appVersion = useAppVersion();
  const adminModeByPack = useAppStore((s) => s.adminModeByPack);
  const setPackAdminMode = useAppStore((s) => s.setPackAdminMode);
  const qc = useQueryClient();
  const [pat, setPat] = useState("");
  const [prismBinaryPath, setPrismBinaryPath] = useState("");
  const [prismDataDir, setPrismDataDir] = useState("");
  const [offlineUsername, setOfflineUsername] = useState("");
  const [launcherPathOpen, setLauncherPathOpen] = useState(false);
  const [prismInstallOpen, setPrismInstallOpen] = useState(false);
  const [prismInstallProgress, setPrismInstallProgress] = useState<PrismInstallProgressEvent | null>(null);
  const [prismInstallLogs, setPrismInstallLogs] = useState<string[]>([]);
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
  const packs = useQuery({
    queryKey: ["packs"],
    queryFn: () => tauri.listPacks(),
  });
  const auth = useQuery({
    queryKey: ["publish-auth"],
    queryFn: () => tauri.getPublishAuthSettings(),
  });
  const sshStatus = useQuery({
    queryKey: ["publish-auth", "ssh-status"],
    queryFn: () => tauri.verifyPublishSsh(),
    enabled: auth.data?.method === "ssh",
    retry: false,
  });
  const savePat = useMutation({
    mutationFn: (token: string) => tauri.savePublishPat(token),
    onSuccess: async () => {
      setPat("");
      await qc.invalidateQueries({ queryKey: ["publish-auth"] });
      toast.success("PAT saved");
    },
    onError: (e) => toast.error("PAT save failed", { description: formatError(e) }),
  });
  const clearPat = useMutation({
    mutationFn: () => tauri.clearPublishPat(),
    onSuccess: async () => {
      setPat("");
      await qc.invalidateQueries({ queryKey: ["publish-auth"] });
      toast.success("PAT cleared");
    },
    onError: (e) => toast.error("PAT clear failed", { description: formatError(e) }),
  });
  const setMethod = useMutation({
    mutationFn: (method: string) => tauri.setPublishAuthMethod(method),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["publish-auth"] });
    },
    onError: (e) => toast.error("Auth method save failed", { description: formatError(e) }),
  });
  const savePrismSettings = useMutation({
    mutationFn: ({ binaryPath, dataDir }: { binaryPath?: string | null; dataDir?: string | null }) =>
      tauri.setPrismSettings(binaryPath, dataDir, offlineUsername.trim() || null),
    onSuccess: async (settings) => {
      setPrismBinaryPath(settings.binaryPath ?? "");
      setPrismDataDir(settings.dataDir ?? "");
      setOfflineUsername(settings.offlineUsername ?? "");
      setLauncherPathOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["prism"] }),
        qc.invalidateQueries({ queryKey: ["prism-settings"] }),
      ]);
      toast.success("Prism settings saved");
    },
    onError: (e) => toast.error("Prism settings save failed", { description: formatError(e) }),
  });
  const installManagedPrism = useMutation({
    mutationFn: () => tauri.installManagedPrism(),
    onMutate: () => {
      setPrismInstallOpen(true);
      setPrismInstallProgress({
        stage: "queued",
        progress: 0,
        currentBytes: null,
        totalBytes: null,
        logLine: null,
      });
      setPrismInstallLogs(["> queue managed launcher install"]);
    },
    onSuccess: async (install) => {
      setPrismBinaryPath(install.binaryPath);
      setPrismDataDir(install.dataDir);
      setPrismInstallOpen(false);
      setPrismInstallProgress((current) =>
        current
          ? {
              ...current,
              stage: "done",
              progress: 100,
            }
          : current,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["prism"] }),
        qc.invalidateQueries({ queryKey: ["prism-settings"] }),
      ]);
      toast.success("Launcher installed", {
        description: `${install.version} · ${install.assetName}`,
      });
    },
    onError: (error) => {
      const message = formatError(error);
      setPrismInstallLogs((current) => [...current, `error :: ${message}`]);
      toast.error("Launcher install failed", { description: message });
    },
  });

  const showPrismInstallProgress = installManagedPrism.isPending;
  const launcherOverrideActive = !!prismSettings.data?.binaryPath || !!prismSettings.data?.dataDir;

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

  useEffect(() => {
    setPrismBinaryPath(prismSettings.data?.binaryPath ?? "");
    setPrismDataDir(prismSettings.data?.dataDir ?? "");
    setOfflineUsername(prismSettings.data?.offlineUsername ?? "");
  }, [prismSettings.data?.binaryPath, prismSettings.data?.dataDir, prismSettings.data?.offlineUsername]);

  async function handleDownloadPrism() {
    try {
      await openUrl("https://github.com/Diegiwg/PrismLauncher-Cracked/releases/latest");
    } catch (error) {
      toast.error("Open download page failed", { description: formatError(error) });
    }
  }

  async function handleBrowseBinary() {
    try {
      const extension = exeExtension();
      const selected = await open({
        title: "Select Prism Launcher binary",
        defaultPath: prismBinaryPath || undefined,
        filters: extension
          ? [{ name: "Prism Launcher", extensions: [extension] }]
          : undefined,
      });
      if (typeof selected === "string") {
        setPrismBinaryPath(selected);
      }
    } catch (error) {
      toast.error("Browse Prism binary failed", { description: formatError(error) });
    }
  }

  async function handleBrowseDataDir() {
    try {
      const selected = await open({
        title: "Select Prism data directory",
        defaultPath: prismDataDir || undefined,
        directory: true,
      });
      if (typeof selected === "string") {
        setPrismDataDir(selected);
      }
    } catch (error) {
      toast.error("Browse Prism data dir failed", { description: formatError(error) });
    }
  }

  function handleSavePrismSettings() {
    savePrismSettings.mutate({
      binaryPath: prismBinaryPath.trim() || null,
      dataDir: prismDataDir.trim() || null,
    });
  }

  function handleOpenLauncherPathEditor() {
    setLauncherPathOpen(true);
  }

  function handleOpenPrismInstall() {
    setPrismInstallOpen(true);
  }

  function handleInstallManagedPrism() {
    installManagedPrism.mutate();
  }

  async function handleCheckForUpdates() {
    const result = await appUpdate.updateQuery.refetch();
    if (result.error) {
      toast.error("Update check failed", { description: formatError(result.error) });
      return;
    }
    if (result.data) {
      toast.success("Update available", { description: `gisketch//s_modpack_syncer v${result.data.version}` });
      return;
    }
    toast.success("gisketch//s_modpack_syncer up to date");
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <span className="cp-tactical-label text-[--brand-core] text-[10px]">:: SYSTEM</span>
        <h1 className="text-2xl text-[--text-high]">Settings</h1>
        <p className="text-sm text-[--text-low]">Environment + diagnostics</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>PACK ADMIN MODE</CardTitle>
          <CardDescription>Enable publish and authoring tools per pack</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {packs.data?.length ? (
              packs.data.map((pack) => (
                <div key={pack.id} className="flex items-center justify-between gap-4 border-b border-line-soft/20 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-[--text-high]">{pack.id}</p>
                    <p className="text-xs text-[--text-low]">Publish preview + push only for this pack.</p>
                  </div>
                  <Switch
                    checked={adminModeByPack[pack.id] ?? false}
                    onCheckedChange={(checked) => setPackAdminMode(pack.id, checked)}
                  />
                </div>
              ))
            ) : (
              <p className="text-xs text-[--text-low]">No packs tracked yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PUBLISH AUTH</CardTitle>
          <CardDescription>Choose publish auth mode and store GitHub PAT securely</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Button
                variant={auth.data?.method === "pat" ? "default" : "secondary"}
                onClick={() => setMethod.mutate("pat")}
              >
                PAT
              </Button>
              <Button
                variant={auth.data?.method === "ssh" ? "default" : "secondary"}
                onClick={() => setMethod.mutate("ssh")}
              >
                SSH
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-text-low">
                Active: {(auth.data?.method ?? "unset").toUpperCase()} · PAT {auth.data?.hasPat ? "PRESENT" : "MISSING"}
              </p>
              {auth.data?.method === "ssh" && (
                <div className="flex items-center gap-2 text-xs">
                  {sshStatus.isLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-core" />
                      <span className="text-text-low">Checking SSH access…</span>
                    </>
                  ) : sshStatus.data?.verified ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-brand-core" />
                      <span className="text-brand-core">Access Verified</span>
                      {sshStatus.data.source && (
                        <span className="truncate text-text-low">via {sshStatus.data.source}</span>
                      )}
                    </>
                  ) : sshStatus.error ? (
                    <span className="text-signal-alert">{formatError(sshStatus.error)}</span>
                  ) : null}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  placeholder="github_pat_..."
                />
                <Button onClick={() => pat.trim() && savePat.mutate(pat.trim())} disabled={!pat.trim() || savePat.isPending}>
                  SAVE PAT
                </Button>
                <Button variant="secondary" onClick={() => clearPat.mutate()} disabled={clearPat.isPending}>
                  CLEAR
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-4 w-4" /> LAUNCHER
          </CardTitle>
          <CardDescription>Managed cracked launcher + manual override</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {prism.isLoading ? (
              <p className="cp-tactical-label text-[--text-low] text-xs">DETECTING</p>
            ) : prism.data ? (
              <dl className="grid grid-cols-[100px_1fr] gap-y-2 font-mono text-xs">
                <dt className="cp-tactical-label text-[--text-low]">BINARY</dt>
                <dd className="text-[--text-high] truncate">{prism.data.binary}</dd>
                <dt className="cp-tactical-label text-[--text-low]">DATA</dt>
                <dd className="text-[--text-high] truncate">{prism.data.data_dir}</dd>
              </dl>
            ) : (
              <p className="cp-tactical-label text-[--signal-alert] text-xs">
                NOT DETECTED :: INSTALL MANAGED OR SET PATHS
              </p>
            )}

            <div className="grid gap-3 border border-line-soft/20 bg-surface-sunken/60 p-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="cp-tactical-label text-[--text-low]">MODE</span>
                <span className="font-mono text-[--text-high]">
                  {launcherOverrideActive ? "MANAGED / OVERRIDE" : prism.data ? "AUTO-DETECTED" : "UNSET"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="cp-tactical-label text-[--text-low]">BINARY</span>
                <span className="max-w-[70%] truncate font-mono text-[--text-high]">
                  {prismBinaryPath || prism.data?.binary || "NOT CONFIGURED"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="cp-tactical-label text-[--text-low]">DATA</span>
                <span className="max-w-[70%] truncate font-mono text-[--text-high]">
                  {prismDataDir || prism.data?.data_dir || "AUTO / DEFAULT"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="cp-tactical-label text-[--text-low]">OFFLINE NAME</span>
                <span className="max-w-[70%] truncate font-mono text-[--text-high]">
                  {offlineUsername || "NOT SET"}
                </span>
              </div>
              <p className="text-[--text-low]">
                Managed install saves portable launcher inside gisketch//s_modpack_syncer data dir, verifies GitHub SHA-256 digest, then auto-fills launcher settings. Offline name launches fork with <code>--offline</code>.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleOpenPrismInstall} disabled={installManagedPrism.isPending}>
                {installManagedPrism.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                INSTALL LAUNCHER
              </Button>
              <Button variant="secondary" onClick={handleOpenLauncherPathEditor}>
                <Search className="h-4 w-4" /> EDIT LAUNCHER PATH
              </Button>
              <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["prism"] })}>
                <RefreshCw className="h-4 w-4" /> RE-SCAN
              </Button>
              <Button variant="outline" onClick={handleDownloadPrism}>
                <Download className="h-4 w-4" /> VIEW RELEASES
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" /> PACKS
          </CardTitle>
          <CardDescription>Registered modpacks</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="cp-tactical-label text-[--brand-core] text-xs">
            {packs.data?.length ?? 0} TRACKED
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" /> PATHS
          </CardTitle>
          <CardDescription>App directories</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[--text-low]">
            Cache, packs, and state live under the OS data dir. Path controls are planned for a
            future milestone.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4" /> ABOUT
          </CardTitle>
          <CardDescription className="tabular-nums">gisketch//s_modpack_syncer v{appVersion.data ?? "..."}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[--text-low]">
            Minecraft modpack syncer + Prism Launcher wrapper.
          </p>
        </CardContent>
      </Card>

      {appUpdate.isWindows ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" /> APP UPDATE
            </CardTitle>
            <CardDescription>Windows builds check latest GitHub release on launch.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 border border-line-soft/20 bg-surface-sunken/60 p-4 text-xs tabular-nums">
                <div className="flex items-center justify-between gap-3">
                  <span className="cp-tactical-label text-[--text-low]">CURRENT</span>
                  <span className="text-[--text-high]">v{appVersion.data ?? "..."}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="cp-tactical-label text-[--text-low]">LATEST</span>
                  <span className="text-[--text-high]">
                    {appUpdate.updateQuery.data ? `v${appUpdate.updateQuery.data.version}` : "CURRENT"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="cp-tactical-label text-[--text-low]">STATUS</span>
                  <span className="text-[--text-high]">
                    {appUpdate.updateQuery.isFetching
                      ? "CHECKING"
                      : appUpdate.updateQuery.data
                        ? "UPDATE READY"
                        : "UP TO DATE"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={handleCheckForUpdates} disabled={appUpdate.updateQuery.isFetching}>
                  {appUpdate.updateQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  CHECK FOR UPDATES
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" /> ONBOARDING
          </CardTitle>
          <CardDescription>Open guided setup flow from separate section</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[--text-low]">
              Step-by-step setup for Java, launcher, username, and first pack import.
            </p>
            <Button variant="secondary" onClick={() => go({ kind: "onboarding" })}>
              <Package className="h-4 w-4" /> OPEN ONBOARDING
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={launcherPathOpen} onOpenChange={(open) => !savePrismSettings.isPending && setLauncherPathOpen(open)}>
        <DialogContent className="max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>EDIT LAUNCHER SETTINGS</DialogTitle>
            <DialogDescription>
              Point gisketch//s_modpack_syncer at managed companion launcher or custom Prism-compatible binary/data dir, then set global offline username.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="p-6">
            <div className="grid gap-4">
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={prismBinaryPath}
                  onChange={(e) => setPrismBinaryPath(e.target.value)}
                  placeholder="Prism Launcher binary path"
                />
                <Button variant="secondary" onClick={handleBrowseBinary}>
                  <Search className="h-4 w-4" /> BROWSE BINARY
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={prismDataDir}
                  onChange={(e) => setPrismDataDir(e.target.value)}
                  placeholder="Prism data dir (optional if auto-detected)"
                />
                <Button variant="secondary" onClick={handleBrowseDataDir}>
                  <FolderOpen className="h-4 w-4" /> BROWSE DATA DIR
                </Button>
              </div>
              <Input
                value={offlineUsername}
                onChange={(e) => setOfflineUsername(e.target.value)}
                placeholder="Offline username used for cracked launcher"
              />
              <p className="text-xs text-[--text-low]">
                Binary override always wins first. Data dir optional, but portable managed installs should keep binary + data together. Offline username applies on launch when set.
              </p>
            </div>
          </DialogBody>
          <DialogFooter className="px-6 py-4 sm:justify-between">
            <Button variant="secondary" onClick={() => setLauncherPathOpen(false)} disabled={savePrismSettings.isPending}>
              CANCEL
            </Button>
            <Button onClick={handleSavePrismSettings} disabled={savePrismSettings.isPending}>
              {savePrismSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
              SAVE PATHS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={prismInstallOpen} onOpenChange={(open) => !installManagedPrism.isPending && setPrismInstallOpen(open)}>
        <DialogContent className="max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>INSTALL LAUNCHER</DialogTitle>
            <DialogDescription>
              {showPrismInstallProgress
                ? "Downloading managed PrismLauncher-Cracked now."
                : "Install portable PrismLauncher-Cracked into gisketch//s_modpack_syncer data dir and auto-wire launcher settings."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="p-6">
            {showPrismInstallProgress ? (
              <div className="flex flex-col gap-3 border border-line-soft/20 bg-surface-sunken/60 p-4">
                <div className="flex items-center justify-between gap-3 text-xs text-text-low">
                  <span className="font-heading uppercase tracking-[0.18em]">INSTALL PROGRESS</span>
                  <span className="font-mono">{prismInstallProgress?.progress ?? 0}%</span>
                </div>
                <div className="h-2 overflow-hidden border border-line-soft/30 bg-surface">
                  <div
                    className="h-full bg-brand-core transition-[width] duration-200"
                    style={{ width: `${Math.max(prismInstallProgress?.progress ?? 0, 4)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-[11px] text-text-low">
                  <span>{prismInstallProgress?.stage?.toUpperCase() ?? "QUEUED"}</span>
                  <span>
                    {prismInstallProgress?.currentBytes != null
                      ? `${formatByteCount(prismInstallProgress.currentBytes)}${prismInstallProgress.totalBytes != null ? ` / ${formatByteCount(prismInstallProgress.totalBytes)}` : ""}`
                      : ""}
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto border border-line-soft/20 bg-black/30 p-3 font-mono text-[11px] text-text-low">
                  {prismInstallLogs.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {prismInstallLogs.map((line, index) => (
                        <span key={`prism-install-log:${index}`}>{line}</span>
                      ))}
                    </div>
                  ) : (
                    <span>Waiting for install output...</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <button
                  type="button"
                  onClick={handleInstallManagedPrism}
                  className="grid gap-2 border border-brand-core bg-brand-core/10 px-4 py-4 text-left transition-colors hover:bg-brand-core/15"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-heading text-sm text-text-high">Managed PrismLauncher-Cracked</span>
                    <span className="font-mono text-xs text-text-low">PORTABLE INSTALL</span>
                  </div>
                  <p className="text-sm text-text-low">
                    Pull latest compatible release for current OS and CPU, verify GitHub SHA-256 digest, unpack into gisketch//s_modpack_syncer data dir, then save binary + data paths automatically.
                  </p>
                </button>
                <div className="border border-line-soft/20 bg-surface-sunken/60 p-4 text-xs text-text-low">
                  <p>CLI check done: fork supports <code>--launch</code>, <code>--dir</code>, and <code>--offline &lt;name&gt;</code>.</p>
                  <p className="mt-2">Offline username wiring not built here yet. This step only handles best UX for installer + launcher path setup.</p>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="px-6 py-4 sm:justify-between">
            <Button variant="secondary" onClick={() => setPrismInstallOpen(false)} disabled={installManagedPrism.isPending}>
              CANCEL
            </Button>
            <Button onClick={handleInstallManagedPrism} disabled={installManagedPrism.isPending}>
              {installManagedPrism.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              INSTALL MANAGED LAUNCHER
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
