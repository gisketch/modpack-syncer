import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { exeExtension } from "@tauri-apps/plugin-os";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FolderGit2, Loader2, Package, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
  const prismSettings = useQuery({
    queryKey: ["prism-settings"],
    queryFn: () => tauri.getPrismSettings(),
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
  const savePrismSettings = useMutation({
    mutationFn: ({ binaryPath, dataDir }: { binaryPath?: string | null; dataDir?: string | null }) =>
      tauri.setPrismSettings(binaryPath, dataDir),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["prism"] }),
        qc.invalidateQueries({ queryKey: ["prism-settings"] }),
      ]);
      toast.success("Prism path saved");
    },
    onError: (e) => toast.error("Prism path save failed", { description: formatError(e) }),
  });

  async function handleDownloadPrism() {
    try {
      await openUrl("https://prismlauncher.org/download/");
    } catch (error) {
      toast.error("Open download page failed", { description: formatError(error) });
    }
  }

  async function handleBrowseBinary() {
    try {
      const extension = exeExtension();
      const selected = await open({
        title: "Select Prism Launcher binary",
        filters: extension
          ? [{ name: "Prism Launcher", extensions: [extension] }]
          : undefined,
      });
      if (typeof selected !== "string") {
        return;
      }
      savePrismSettings.mutate({
        binaryPath: selected,
        dataDir: prismSettings.data?.dataDir ?? null,
      });
    } catch (error) {
      toast.error("Browse Prism binary failed", { description: formatError(error) });
    }
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-8">
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
      <div className="relative flex w-full max-w-xl flex-col gap-6 border border-[--line-strong] bg-[--surface-elevated] p-8 corner-brackets scanlines-overlay">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="h-1.5 w-1.5 bg-[--signal-live] shadow-[0_0_8px_var(--signal-live)]" />
            <span className="cp-tactical-label text-[--brand-core]">
              :: INITIALIZE :: PACK INGEST
            </span>
          </div>
          <h1 className="text-3xl text-[--text-high]">Welcome to modsync</h1>
          <p className="text-sm text-[--text-low]">
            Paste your modpack's GitHub URL to clone it. Your pack author shares this link with you.
          </p>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) addPack.mutate(url.trim());
          }}
        >
          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor="pack-url" className="cp-tactical-label text-[--text-low] text-[10px]">
              :: MODPACK URL
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
            CLONE PACK
          </Button>
          {error && (
            <p className="cp-tactical-label text-[--signal-alert] text-xs">ERR :: {error}</p>
          )}
        </form>

        <div className="flex flex-col gap-3 border-[--line-soft] border-t pt-4 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-[--text-low]">
              <Package className="h-3.5 w-3.5" />
              <span className="cp-tactical-label">PRISM LAUNCHER:</span>{" "}
              {prism.isLoading ? (
                <span className="cp-tactical-label text-[--text-low]">DETECTING</span>
              ) : prism.data ? (
                <span className="cp-tactical-label text-[--signal-live]">READY</span>
              ) : (
                <span className="cp-tactical-label text-[--signal-alert]">NOT DETECTED</span>
              )}
            </span>
            {!prism.data && !prism.isLoading ? (
              <span className="cp-tactical-label text-[--text-low] text-[10px]">
                INSTALL OR SET PRISM BEFORE LAUNCH
              </span>
            ) : null}
          </div>
          {!prism.data && !prism.isLoading ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleDownloadPrism}>
                <Download className="h-4 w-4" /> DOWNLOAD PAGE
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleBrowseBinary}
                disabled={savePrismSettings.isPending || prismSettings.isLoading}
              >
                {savePrismSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                BROWSE BINARY
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
