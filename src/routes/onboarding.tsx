import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderGit2, Loader2, Package, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatError } from "@/lib/format-error";
import { tauri } from "@/lib/tauri";

export function OnboardingRoute() {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const prism = useQuery({
    queryKey: ["prism"],
    queryFn: () => tauri.detectPrism(),
    retry: false,
  });

  const addPack = useMutation({
    mutationFn: (u: string) => tauri.addPack(u),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["packs"] });
    },
    onError: (e: unknown) => setError(formatError(e)),
  });

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="flex w-full max-w-xl flex-col gap-6 rounded-xl border border-[--color-muted] bg-[--color-bg]/50 p-8">
        <div className="flex flex-col gap-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-950/40 text-emerald-300">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to modsync</h1>
          <p className="text-sm opacity-70">
            Paste your modpack's GitHub URL to clone it. Your friend (the pack author) shares this
            link with you.
          </p>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) addPack.mutate(url.trim());
          }}
        >
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="pack-url" className="opacity-80">
              Modpack URL
            </label>
            <Input
              id="pack-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/gisketch/modsync-pack.git"
              disabled={addPack.isPending}
              autoFocus
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={addPack.isPending || !url.trim()}
            className="w-full"
          >
            {addPack.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderGit2 className="h-4 w-4" />
            )}
            Clone pack
          </Button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>

        <div className="flex items-center justify-between border-[--color-muted] border-t pt-4 text-xs opacity-70">
          <span className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5" />
            Prism Launcher:{" "}
            {prism.isLoading ? (
              <span className="opacity-60">detecting…</span>
            ) : prism.data ? (
              <span className="text-emerald-400">ready</span>
            ) : (
              <span className="text-amber-400">not detected</span>
            )}
          </span>
          {!prism.data && !prism.isLoading && (
            <span className="opacity-60">Install Prism before launching</span>
          )}
        </div>
      </div>
    </div>
  );
}
