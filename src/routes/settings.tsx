import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Check, FolderOpen, Info, Loader2, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatError } from "@/lib/format-error";
import { tauri } from "@/lib/tauri";
import { useAppStore } from "@/stores/app-store";

export function SettingsRoute() {
  const adminModeByPack = useAppStore((s) => s.adminModeByPack);
  const setPackAdminMode = useAppStore((s) => s.setPackAdminMode);
  const qc = useQueryClient();
  const [pat, setPat] = useState("");
  const prism = useQuery({
    queryKey: ["prism"],
    queryFn: () => tauri.detectPrism(),
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
            <Boxes className="h-4 w-4" /> PRISM LAUNCHER
          </CardTitle>
          <CardDescription>Detected installation</CardDescription>
        </CardHeader>
        <CardContent>
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
              NOT DETECTED :: INSTALL PRISM LAUNCHER
            </p>
          )}
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
          <CardDescription>modsync v0.1.0</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[--text-low]">
            Minecraft modpack syncer + Prism Launcher wrapper.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
