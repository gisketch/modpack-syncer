import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2, Package, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardWindowBar, CardWindowTab } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatError } from "@/lib/format-error";
import { type ManifestArtifactCategory, type ModrinthAddPreview, tauri } from "@/lib/tauri";

type AddModrinthEntryDialogProps = {
  open: boolean;
  onClose: () => void;
  packId: string;
  category: ManifestArtifactCategory;
};

export function AddModrinthEntryDialog({
  open,
  onClose,
  packId,
  category,
}: AddModrinthEntryDialogProps) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [selectedSide, setSelectedSide] = useState<"client" | "server" | "both">("client");
  const artifactLabel = describeArtifactCategory(category);
  const preview = useMutation({
    mutationFn: (identifier: string) => tauri.previewModrinthMod(packId, identifier, category),
    onSuccess: (data) => setSelectedSide(data.suggestedSide),
  });
  const addMod = useMutation({
    mutationFn: (payload: {
      projectId: string;
      versionId: string;
      side: "client" | "server" | "both";
    }) =>
      tauri.addModrinthMod(packId, category, payload.projectId, payload.versionId, payload.side),
    onSuccess: async (entry) => {
      if (category === "mods") {
        await qc.invalidateQueries({ queryKey: ["mod-statuses", packId] });
      } else {
        await qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] });
      }
      toast.success(`${artifactLabel.singular} staged`, { description: entry.filename });
      handleClose();
    },
    onError: (error) => {
      toast.error(`Add ${artifactLabel.singular.toLowerCase()} failed`, {
        description: formatError(error),
      });
    },
  });

  function handleClose() {
    setInput("");
    setSelectedSide("client");
    preview.reset();
    addMod.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>ADD MODRINTH {artifactLabel.heading}</DialogTitle>
          <DialogDescription>
            Paste Modrinth link, slug, or project id. {artifactLabel.singular} downloads into
            instance first and stays unpublished until publish.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-3">
            <Label htmlFor="modrinth-link">MODRINTH SOURCE</Label>
            <div className="flex gap-3">
              <Input
                id="modrinth-link"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={artifactLabel.placeholder}
              />
              <Button
                variant="outline"
                onClick={() => preview.mutate(input.trim())}
                disabled={!input.trim() || preview.isPending || addMod.isPending}
              >
                {preview.isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
                RESOLVE
              </Button>
            </div>
            {preview.error ? (
              <p className="text-sm text-signal-alert">{formatError(preview.error)}</p>
            ) : null}
          </div>

          {preview.data ? (
            <ResolvedModPreview
              preview={preview.data}
              selectedSide={selectedSide}
              onSideChange={setSelectedSide}
            />
          ) : (
            <div className="border border-line-soft/20 bg-surface-sunken px-4 py-6 text-sm text-text-low">
              Resolve Modrinth {artifactLabel.singular.toLowerCase()} first.
            </div>
          )}
        </DialogBody>
        <DialogFooter className="px-6 py-4 sm:justify-between">
          <Button variant="secondary" onClick={handleClose} disabled={addMod.isPending}>
            CANCEL
          </Button>
          <Button
            onClick={() =>
              preview.data &&
              addMod.mutate({
                projectId: preview.data.projectId,
                versionId: preview.data.versionId,
                side: selectedSide,
              })
            }
            disabled={!preview.data || preview.data.alreadyTracked || addMod.isPending}
          >
            {addMod.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            {preview.data?.alreadyTracked ? "ALREADY TRACKED" : "DOWNLOAD TO INSTANCE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function describeArtifactCategory(category: ManifestArtifactCategory) {
  if (category === "resourcepacks") {
    return {
      singular: "Resourcepack",
      heading: "RESOURCEPACK",
      placeholder: "https://modrinth.com/resourcepack/... or slug",
    };
  }
  if (category === "shaderpacks") {
    return {
      singular: "Shaderpack",
      heading: "SHADERPACK",
      placeholder: "https://modrinth.com/shader/... or slug",
    };
  }
  return {
    singular: "Mod",
    heading: "MOD",
    placeholder: "https://modrinth.com/mod/... or slug",
  };
}

function ResolvedModPreview({
  preview,
  selectedSide,
  onSideChange,
}: {
  preview: ModrinthAddPreview;
  selectedSide: "client" | "server" | "both";
  onSideChange: (value: "client" | "server" | "both") => void;
}) {
  return (
    <Card variant="window">
      <CardWindowBar>
        <CardWindowTab>MODRINTH PREVIEW</CardWindowTab>
      </CardWindowBar>
      <CardContent className="flex flex-col gap-5 py-4">
        <div className="flex items-start gap-4">
          <div className="flex size-14 items-center justify-center overflow-hidden border border-line-soft/30 bg-surface-base">
            {preview.iconUrl ? (
              <img src={preview.iconUrl} alt="" className="size-full object-cover" loading="lazy" />
            ) : (
              <Package className="size-5 text-text-low" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-base text-text-high">{preview.title}</p>
            <p className="font-mono text-[10px] text-text-low">{preview.filename}</p>
            <p className="text-xs text-text-low">{preview.versionNumber}</p>
            {preview.description ? (
              <p className="line-clamp-3 text-xs text-text-low">{preview.description}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="grid gap-2 text-xs">
            <Row k="PROJECT" v={preview.slug} />
            <Row k="SIZE" v={formatBytes(preview.size)} />
            <Row k="VERSION" v={preview.versionNumber} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mod-side">SIDE</Label>
            <Select
              value={selectedSide}
              onValueChange={(value) => onSideChange(value as "client" | "server" | "both")}
            >
              <SelectTrigger id="mod-side">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">CLIENT</SelectItem>
                <SelectItem value="server">SERVER</SelectItem>
                <SelectItem value="both">BOTH</SelectItem>
              </SelectContent>
            </Select>
            {preview.alreadyTracked ? (
              <p className="text-xs text-signal-warn">Already tracked in manifest. Add disabled.</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-line-soft/30 border-b pb-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">{k}</span>
      <span className="font-mono text-xs text-text-high">{v}</span>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
