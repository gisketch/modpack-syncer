import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Boxes, ChevronRight, FolderGit2, FolderPlus, Loader2, Package, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PackIcon } from "@/components/pack-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatError } from "@/lib/format-error";
import { type Loader, type PackSummary, type PackTransferProgressEvent, tauri } from "@/lib/tauri";
import { useNav } from "@/stores/nav-store";

const LOADER_DEFAULTS: Record<Loader, string> = {
  neoforge: "21.1.77",
  fabric: "0.16.10",
  forge: "52.0.0",
  quilt: "0.28.0",
};

export function HomeRoute() {
  const qc = useQueryClient();
  const prism = useQuery({
    queryKey: ["prism"],
    queryFn: () => tauri.detectPrism(),
    retry: false,
  });
  const packs = useQuery({
    queryKey: ["packs"],
    queryFn: () => tauri.listPacks(),
  });

  const [url, setUrl] = useState("");
  const [localPackName, setLocalPackName] = useState("Local Pack");
  const [localMcVersion, setLocalMcVersion] = useState("1.21.1");
  const [localLoader, setLocalLoader] = useState<Loader>("neoforge");
  const [localLoaderVersion, setLocalLoaderVersion] = useState(LOADER_DEFAULTS.neoforge);
  const [error, setError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cloneProgress, setCloneProgress] = useState<PackTransferProgressEvent | null>(null);
  const [cloneRate, setCloneRate] = useState<number | null>(null);
  const cloneRateRef = useRef<{ bytes: number; at: number } | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    void listen<PackTransferProgressEvent>("pack-transfer-progress", (event) => {
      setCloneProgress((current) =>
        event.payload.stage === "done" && current ? { ...current, stage: "done" } : event.payload,
      );
      const now = Date.now();
      const previous = cloneRateRef.current;
      if (
        previous &&
        now > previous.at &&
        event.payload.receivedBytes >= previous.bytes &&
        event.payload.stage !== "done"
      ) {
        setCloneRate(((event.payload.receivedBytes - previous.bytes) * 1000) / (now - previous.at));
      }
      cloneRateRef.current = { bytes: event.payload.receivedBytes, at: now };
      if (event.payload.stage === "done") {
        setCloneRate(null);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const addPack = useMutation({
    mutationFn: (u: string) => tauri.addPack(u),
    onMutate: () => {
      setError(null);
      setLocalError(null);
      setCloneProgress(null);
      setCloneRate(null);
      cloneRateRef.current = null;
    },
    onSuccess: () => {
      setUrl("");
      setError(null);
      toast.success("Pack cloned");
      qc.invalidateQueries({ queryKey: ["packs"] });
    },
    onError: (e: unknown) => {
      const msg = formatError(e);
      setError(msg);
      toast.error("Clone failed", { description: msg });
    },
  });

  const createLocalPack = useMutation({
    mutationFn: () =>
      tauri.createLocalPack(
        localPackName.trim() || "Local Pack",
        localMcVersion.trim(),
        localLoader,
        localLoaderVersion.trim(),
      ),
    onMutate: () => {
      setError(null);
      setLocalError(null);
    },
    onSuccess: async (pack) => {
      toast.success("Local pack created", { description: pack.id });
      await qc.invalidateQueries({ queryKey: ["packs"] });
    },
    onError: (e: unknown) => {
      const msg = formatError(e);
      setLocalError(msg);
      toast.error("Local pack failed", { description: msg });
    },
  });

  return (
    <div className="relative flex h-full flex-col gap-6 overflow-auto p-8 scrollbar-tactical">
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-tactical-grid opacity-40" />
      <header className="relative flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <span className="cp-tactical-label text-[--brand-core] text-[10px]">
            :: PACK REGISTRY
          </span>
          <h1 className="text-2xl text-[--text-high]">Your packs</h1>
          <p className="text-sm text-[--text-low]">Sync + launch your installed modpacks</p>
        </div>
        <PrismStatus loading={prism.isLoading} location={prism.data ?? null} />
      </header>

      {!prism.data && !prism.isLoading && (
        <Alert variant="destructive">
          <AlertTitle>Prism Launcher not detected</AlertTitle>
          <AlertDescription>Install Prism Launcher to sync and launch your packs.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-4" /> ADD PACK
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.75fr)]">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (url.trim()) addPack.mutate(url.trim());
              }}
            >
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/gisketch/s_modpack_syncer-pack.git"
                disabled={addPack.isPending}
              />
              <Button type="submit" disabled={addPack.isPending || !url.trim()}>
                {addPack.isPending ? <Loader2 className="animate-spin" /> : <FolderGit2 />}
                CLONE
              </Button>
            </form>
            <form
              className="grid gap-2 md:grid-cols-[minmax(160px,1fr)_120px_132px_120px_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                createLocalPack.mutate();
              }}
            >
              <Input
                value={localPackName}
                onChange={(e) => setLocalPackName(e.target.value)}
                placeholder="Local Pack"
                disabled={createLocalPack.isPending}
              />
              <Input
                value={localMcVersion}
                onChange={(e) => setLocalMcVersion(e.target.value)}
                placeholder="1.21.1"
                disabled={createLocalPack.isPending}
              />
              <Select
                value={localLoader}
                onValueChange={(value) => {
                  const nextLoader = value as Loader;
                  setLocalLoader(nextLoader);
                  setLocalLoaderVersion(LOADER_DEFAULTS[nextLoader]);
                }}
                disabled={createLocalPack.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neoforge">NEOFORGE</SelectItem>
                  <SelectItem value="fabric">FABRIC</SelectItem>
                  <SelectItem value="forge">FORGE</SelectItem>
                  <SelectItem value="quilt">QUILT</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={localLoaderVersion}
                onChange={(e) => setLocalLoaderVersion(e.target.value)}
                placeholder={LOADER_DEFAULTS[localLoader]}
                disabled={createLocalPack.isPending}
              />
              <Button
                type="submit"
                disabled={
                  createLocalPack.isPending || !localMcVersion.trim() || !localLoaderVersion.trim()
                }
              >
                {createLocalPack.isPending ? <Loader2 className="animate-spin" /> : <FolderPlus />}
                LOCAL
              </Button>
            </form>
          </div>
          {addPack.isPending || cloneProgress ? (
            <CloneProgress progress={cloneProgress} rate={cloneRate} pending={addPack.isPending} />
          ) : null}
          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>Clone failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {localError && (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>Local pack failed</AlertTitle>
              <AlertDescription>{localError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <section className="relative flex flex-col gap-3">
        <h2 className="cp-tactical-label flex items-center gap-2 text-sm text-[--brand-core]">
          <Package className="size-4" /> PACKS
        </h2>
        {packs.isLoading && <p className="cp-tactical-label text-[--text-low] text-xs">LOADING</p>}
        {packs.data && packs.data.length === 0 && (
          <p className="text-sm text-[--text-low]">No packs yet. Clone or create one above.</p>
        )}
        <div className="flex flex-col gap-3">
          {packs.data?.map((p) => (
            <PackCard key={p.id} pack={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CloneProgress({
  progress,
  rate,
  pending,
}: {
  progress: PackTransferProgressEvent | null;
  rate: number | null;
  pending: boolean;
}) {
  const total = progress?.totalObjects ?? 0;
  const received = progress?.receivedObjects ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  const stage = progress?.stage === "done" ? "DONE" : (progress?.stage.toUpperCase() ?? "STARTING");
  return (
    <div className="mt-3 flex flex-col gap-2 border border-line-soft/20 bg-surface-sunken/50 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em]">
        <span className="text-text-low">{stage}</span>
        <span className="font-mono text-text-high tabular-nums">
          {total > 0 ? `${received}/${total} objects` : pending ? "connecting" : "ready"}
          {rate ? ` / ${formatRate(rate)}` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden bg-surface-raised">
        <div
          className="h-full bg-brand-core transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
      {progress ? (
        <div className="flex justify-between font-mono text-[10px] text-text-low tabular-nums">
          <span>{formatBytes(progress.receivedBytes)}</span>
          <span>{progress.indexedObjects} indexed</span>
        </div>
      ) : null}
    </div>
  );
}

function formatRate(bytesPerSecond: number) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function PrismStatus({
  loading,
  location,
}: {
  loading: boolean;
  location: { data_dir: string; binary: string } | null;
}) {
  if (loading) {
    return (
      <Badge variant="outline">
        <Loader2 className="size-3 animate-spin" /> DETECTING
      </Badge>
    );
  }
  if (!location) {
    return (
      <Badge variant="destructive">
        <span className="size-1.5 bg-[--signal-alert]" /> PRISM NOT DETECTED
      </Badge>
    );
  }
  return (
    <Badge>
      <Boxes className="size-3" /> PRISM READY
    </Badge>
  );
}

function PackCard({ pack }: { pack: PackSummary }) {
  const go = useNav((s) => s.go);
  const manifest = useQuery({
    queryKey: ["manifest", pack.id],
    queryFn: () => tauri.loadManifest(pack.id),
    retry: false,
  });

  return (
    <Card
      className="cursor-pointer p-4 transition-colors hover:border-[--brand-core]/60"
      onClick={() => go({ kind: "pack", id: pack.id })}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <PackIcon
            iconUrl={manifest.data?.pack.icon}
            name={manifest.data?.pack.name ?? pack.id}
            className="mt-0.5 size-14 shrink-0"
            fallbackClassName="size-6"
          />
          <div className="min-w-0 flex-1">
            <p className="cp-tactical-label truncate text-[--text-high] text-sm">
              {manifest.data?.pack.name ?? pack.id}
            </p>
            <p className="truncate font-mono text-[--text-low] text-xs">
              {pack.is_local ? "local" : pack.head_sha.slice(0, 10)} · {pack.path}
            </p>
            {manifest.data && (
              <div className="mt-2 flex flex-wrap gap-2">
                {pack.is_local && <Badge variant="secondary">LOCAL</Badge>}
                <Badge variant="outline">v{manifest.data.pack.version}</Badge>
                <Badge variant="outline">MC {manifest.data.pack.mcVersion}</Badge>
                <Badge variant="outline">{manifest.data.pack.loader.toUpperCase()}</Badge>
                <Badge variant="outline">{manifest.data.mods.length} MODS</Badge>
              </div>
            )}
            {manifest.isError && (
              <p className="cp-tactical-label mt-2 text-[--signal-alert] text-xs">
                NO MANIFEST.JSON
              </p>
            )}
          </div>
        </div>
        <ChevronRight className="size-5 text-[--text-low]" />
      </div>
    </Card>
  );
}
