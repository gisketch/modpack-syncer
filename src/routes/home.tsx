import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Download, FolderGit2, Loader2, Package, Play, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type PackSummary, type SyncInstanceReport, tauri } from "@/lib/tauri";

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
  const [error, setError] = useState<string | null>(null);

  const addPack = useMutation({
    mutationFn: (u: string) => tauri.addPack(u),
    onSuccess: () => {
      setUrl("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["packs"] });
    },
    onError: (e: unknown) => setError(formatError(e)),
  });

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">modsync</h1>
          <p className="text-sm opacity-70">Minecraft modpack syncer + Prism launcher wrapper</p>
        </div>
        <PrismStatus loading={prism.isLoading} location={prism.data ?? null} />
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-[--color-muted] p-6">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Plus className="h-4 w-4" /> Add pack
        </h2>
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
            placeholder="https://gitea.example.com/gisketch/modsync-pack.git"
            disabled={addPack.isPending}
          />
          <Button type="submit" disabled={addPack.isPending || !url.trim()}>
            {addPack.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderGit2 className="h-4 w-4" />
            )}
            Clone
          </Button>
        </form>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Package className="h-4 w-4" /> Packs
        </h2>
        {packs.isLoading && <p className="text-sm opacity-60">Loading…</p>}
        {packs.data && packs.data.length === 0 && (
          <p className="text-sm opacity-60">No packs yet. Clone one above.</p>
        )}
        <ul className="flex flex-col gap-2">
          {packs.data?.map((p) => (
            <PackCard key={p.id} pack={p} prismAvailable={!!prism.data} />
          ))}
        </ul>
      </section>
    </div>
  );
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
      <span className="flex items-center gap-2 text-xs opacity-60">
        <Loader2 className="h-3 w-3 animate-spin" /> detecting Prism…
      </span>
    );
  }
  if (!location) {
    return (
      <span className="rounded-md bg-amber-950/40 px-2 py-1 text-xs text-amber-300">
        Prism not detected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 rounded-md bg-emerald-950/40 px-2 py-1 text-xs text-emerald-300">
      <Boxes className="h-3 w-3" /> Prism ready
    </span>
  );
}

function PackCard({ pack, prismAvailable }: { pack: PackSummary; prismAvailable: boolean }) {
  const manifest = useQuery({
    queryKey: ["manifest", pack.id],
    queryFn: () => tauri.loadManifest(pack.id),
    retry: false,
  });

  const [report, setReport] = useState<SyncInstanceReport | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const instanceName = `modsync-${pack.id}`;

  const sync = useMutation({
    mutationFn: () => tauri.syncInstance(pack.id),
    onSuccess: (r) => {
      setReport(r);
      setSyncError(null);
    },
    onError: (e) => setSyncError(formatError(e)),
  });

  const launch = useMutation({
    mutationFn: () => tauri.launchInstance(instanceName),
    onError: (e) => setSyncError(formatError(e)),
  });

  return (
    <li className="rounded-lg border border-[--color-muted] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{manifest.data?.pack.name ?? pack.id}</p>
          <p className="text-xs opacity-60 font-mono truncate">
            {pack.head_sha.slice(0, 10)} · {pack.path}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => sync.mutate()}
            disabled={sync.isPending || !manifest.data || !prismAvailable}
            title={prismAvailable ? "Download mods + write Prism instance" : "Install Prism first"}
          >
            {sync.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync
          </Button>
          <Button
            size="sm"
            onClick={() => launch.mutate()}
            disabled={launch.isPending || !report || !prismAvailable || sync.isPending}
          >
            {launch.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Launch
          </Button>
        </div>
      </div>
      {manifest.data && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-80">
          <Tag>v{manifest.data.pack.version}</Tag>
          <Tag>MC {manifest.data.pack.mcVersion}</Tag>
          <Tag>{manifest.data.pack.loader}</Tag>
          <Tag>
            <Download className="inline h-3 w-3" /> {manifest.data.mods.length} mods
          </Tag>
        </div>
      )}
      {report && (
        <div className="mt-3 text-xs opacity-80">
          <p>
            Sync OK: {report.instance.mods_written} mods · {report.instance.overrides_copied}{" "}
            override files · cached {report.fetch.cached} / total {report.fetch.total}
          </p>
          <p className="font-mono opacity-60 truncate">{report.instance.instance_dir}</p>
        </div>
      )}
      {syncError && <p className="mt-3 text-xs text-red-400">{syncError}</p>}
      {manifest.isError && (
        <p className="mt-3 text-xs text-amber-400">No manifest.json in this repo yet.</p>
      )}
    </li>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-[--color-muted]/60 px-2 py-0.5">{children}</span>;
}

function formatError(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyE = e as { kind?: string; message?: string };
    if (anyE.kind && anyE.message) return `${anyE.kind}: ${anyE.message}`;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
