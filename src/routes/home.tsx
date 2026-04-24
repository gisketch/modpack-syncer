import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, ChevronRight, FolderGit2, Loader2, Package, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatError } from "@/lib/format-error";
import { type PackSummary, tauri } from "@/lib/tauri";
import { useNav } from "@/stores/nav-store";

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
      toast.success("Pack cloned");
      qc.invalidateQueries({ queryKey: ["packs"] });
    },
    onError: (e: unknown) => {
      const msg = formatError(e);
      setError(msg);
      toast.error("Clone failed", { description: msg });
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
          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>Clone failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
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
          <p className="text-sm text-[--text-low]">No packs yet. Clone one above.</p>
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
        <div className="min-w-0 flex-1">
          <p className="cp-tactical-label truncate text-[--text-high] text-sm">
            {manifest.data?.pack.name ?? pack.id}
          </p>
          <p className="truncate font-mono text-[--text-low] text-xs">
            {pack.head_sha.slice(0, 10)} · {pack.path}
          </p>
          {manifest.data && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">v{manifest.data.pack.version}</Badge>
              <Badge variant="outline">MC {manifest.data.pack.mcVersion}</Badge>
              <Badge variant="outline">{manifest.data.pack.loader.toUpperCase()}</Badge>
              <Badge variant="outline">{manifest.data.mods.length} MODS</Badge>
            </div>
          )}
          {manifest.isError && (
            <p className="cp-tactical-label mt-2 text-[--signal-alert] text-xs">NO MANIFEST.JSON</p>
          )}
        </div>
        <ChevronRight className="size-5 text-[--text-low]" />
      </div>
    </Card>
  );
}
