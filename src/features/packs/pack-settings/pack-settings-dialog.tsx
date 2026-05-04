import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatError } from "@/lib/format-error";
import type { Manifest } from "@/lib/tauri";
import { tauri } from "@/lib/tauri";

type PackSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  packId: string;
  manifest: Manifest | null;
  onSaved: () => void | Promise<void>;
};

export function PackSettingsDialog({
  open,
  onClose,
  packId,
  manifest,
  onSaved,
}: PackSettingsDialogProps) {
  const [loaderVersion, setLoaderVersion] = useState("");
  const isNeoForge = manifest?.pack.loader === "neoforge";
  const versions = useQuery({
    queryKey: ["neoforge-versions", packId],
    queryFn: () => tauri.listNeoForgeVersions(packId),
    enabled: open && isNeoForge,
    retry: false,
  });
  const versionOptions = useMemo(() => {
    const remoteVersions = versions.data ?? [];
    if (!loaderVersion || remoteVersions.includes(loaderVersion)) return remoteVersions;
    return [loaderVersion, ...remoteVersions];
  }, [loaderVersion, versions.data]);
  const save = useMutation({
    mutationFn: () => tauri.updatePackLoaderVersion(packId, loaderVersion),
    onSuccess: async (nextManifest) => {
      await onSaved();
      toast.success("Pack settings saved", {
        description: `NeoForge ${nextManifest.pack.loaderVersion}`,
      });
      onClose();
    },
    onError: (error) => {
      toast.error("Pack settings save failed", { description: formatError(error) });
    },
  });

  useEffect(() => {
    if (!open || !manifest) return;
    setLoaderVersion(manifest.pack.loaderVersion);
  }, [open, manifest]);

  const unchanged = loaderVersion === (manifest?.pack.loaderVersion ?? "");

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>PACK SETTINGS</DialogTitle>
          <DialogDescription>Edit source manifest settings for this pack.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5 p-6">
          <div className="grid gap-3 text-xs">
            <SettingRow label="MINECRAFT" value={manifest?.pack.mcVersion ?? "unknown"} />
            <SettingRow label="LOADER" value={manifest?.pack.loader.toUpperCase() ?? "UNKNOWN"} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="pack-loader-version">LOADER VERSION</Label>
              {versions.isFetching ? (
                <Loader2 className="size-4 animate-spin text-brand-core" />
              ) : null}
            </div>
            {isNeoForge ? (
              <Select
                value={loaderVersion}
                onValueChange={(value) => value && setLoaderVersion(value)}
                disabled={versions.isLoading || save.isPending || versionOptions.length === 0}
              >
                <SelectTrigger id="pack-loader-version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versionOptions.map((version) => (
                    <SelectItem key={version} value={version}>
                      {version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="border border-line-soft/20 bg-surface-sunken px-4 py-3 text-sm text-text-low">
                Loader version editing is available for NeoForge packs.
              </div>
            )}
            {versions.error ? (
              <p className="text-sm text-signal-alert">{formatError(versions.error)}</p>
            ) : null}
          </div>
        </DialogBody>
        <DialogFooter className="px-6 py-4 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
              CANCEL
            </Button>
            {isNeoForge ? (
              <Button
                variant="outline"
                onClick={() => void versions.refetch()}
                disabled={versions.isFetching || save.isPending}
              >
                {versions.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                REFRESH VERSIONS
              </Button>
            ) : null}
          </div>
          <Button
            onClick={() => save.mutate()}
            disabled={!isNeoForge || !loaderVersion || unchanged || save.isPending}
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            SAVE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-line-soft/30 border-b pb-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">{label}</span>
      <span className="font-mono text-xs text-text-high">{value}</span>
    </div>
  );
}
