import { useQuery } from "@tanstack/react-query";
import { Boxes, FolderOpen, Info, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tauri } from "@/lib/tauri";

export function SettingsRoute() {
  const prism = useQuery({
    queryKey: ["prism"],
    queryFn: () => tauri.detectPrism(),
    retry: false,
  });
  const packs = useQuery({
    queryKey: ["packs"],
    queryFn: () => tauri.listPacks(),
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
