import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Download, FolderGit2, Loader2, Package, Play, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatError } from "@/lib/format-error";
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

      <section className="relative flex flex-col gap-3 border border-[--line-soft] bg-[--surface-elevated] p-6 corner-brackets">
        <h2 className="cp-tactical-label flex items-center gap-2 text-sm text-[--brand-core]">
          <Plus className="h-4 w-4" /> ADD PACK
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
            placeholder="https://github.com/gisketch/modsync-pack.git"
            disabled={addPack.isPending}
          />
          <Button type="submit" disabled={addPack.isPending || !url.trim()}>
            {addPack.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderGit2 className="h-4 w-4" />
            )}
            CLONE
          </Button>
        </form>
        {error && <p className="cp-tactical-label text-[--signal-alert] text-xs">ERR :: {error}</p>}
      </section>

      <section className="relative flex flex-col gap-3">
        <h2 className="cp-tactical-label flex items-center gap-2 text-sm text-[--brand-core]">
          <Package className="h-4 w-4" /> PACKS
        </h2>
        {packs.isLoading && <p className="cp-tactical-label text-[--text-low] text-xs">LOADING</p>}
        {packs.data && packs.data.length === 0 && (
          <p className="text-sm text-[--text-low]">No packs yet. Clone one above.</p>
        )}
        <ul className="flex flex-col gap-3">
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
      <span className="cp-tactical-label flex items-center gap-2 text-[--text-low] text-xs">
        <Loader2 className="h-3 w-3 animate-spin" /> DETECTING PRISM
      </span>
    );
  }
  if (!location) {
    return (
      <span className="cp-tactical-label flex items-center gap-2 border border-[--signal-alert] bg-[--surface-sunken] px-3 py-1.5 text-[--signal-alert] text-xs clip-diagonal-sm">
        <span className="h-1.5 w-1.5 bg-[--signal-alert]" />
        PRISM NOT DETECTED
      </span>
    );
  }
  return (
    <span className="cp-tactical-label flex items-center gap-2 border border-[--brand-core] bg-[--surface-sunken] px-3 py-1.5 text-[--brand-core] text-xs clip-diagonal-sm">
      <span className="h-1.5 w-1.5 bg-[--signal-live] shadow-[0_0_8px_var(--signal-live)]" />
      <Boxes className="h-3 w-3" /> PRISM READY
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
    <li className="relative border border-[--line-soft] bg-[--surface-elevated] p-4 corner-brackets transition-colors hover:border-[--brand-core]/60">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="cp-tactical-label truncate text-[--text-high] text-sm">
            {manifest.data?.pack.name ?? pack.id}
          </p>
          <p className="text-[--text-low] font-mono text-xs truncate">
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
            SYNC
          </Button>
          <Button
            size="sm"
            onClick={() => launch.mutate()}
            disabled={launch.isPending || !prismAvailable || sync.isPending}
          >
            {launch.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            LAUNCH
          </Button>
        </div>
      </div>
      {manifest.data && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Tag>v{manifest.data.pack.version}</Tag>
          <Tag>MC {manifest.data.pack.mcVersion}</Tag>
          <Tag>{manifest.data.pack.loader.toUpperCase()}</Tag>
          <Tag>
            <Download className="inline h-3 w-3" /> {manifest.data.mods.length} MODS
          </Tag>
        </div>
      )}
      {report && (
        <div className="mt-3 flex flex-col gap-1 border-t border-[--line-soft] pt-3 text-xs">
          <p className="cp-tactical-label text-[--signal-live]">:: SYNC OK</p>
          <p className="text-[--text-low]">
            {report.instance.mods_written} mods · {report.instance.overrides_copied} override files
            · cached {report.fetch.cached}/{report.fetch.total}
          </p>
          <p className="font-mono text-[--text-low] text-[10px] truncate opacity-60">
            {report.instance.instance_dir}
          </p>
        </div>
      )}
      {syncError && (
        <p className="mt-3 cp-tactical-label text-[--signal-alert] text-xs">ERR :: {syncError}</p>
      )}
      {manifest.isError && (
        <p className="mt-3 cp-tactical-label text-[--signal-alert] text-xs">
          NO MANIFEST.JSON IN THIS REPO YET
        </p>
      )}
    </li>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="cp-tactical-label border border-[--line-soft] bg-[--surface-sunken] px-2 py-0.5 text-[--brand-core] text-[10px]">
      {children}
    </span>
  );
}
