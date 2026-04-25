import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatError } from "@/lib/format-error";
import type { OptionPresetRow, OptionPresetScope, SaveOptionPresetDraft } from "@/lib/tauri";
import { tauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

const scopes: Array<{ id: OptionPresetScope; label: string }> = [
  { id: "video", label: "VIDEO SETTINGS" },
  { id: "shader-iris", label: "SHADER IRIS" },
  { id: "shader-preset", label: "SHADER PRESET" },
  { id: "keybinds", label: "KEYBINDS" },
  { id: "other", label: "OTHER OPTIONS" },
];

type OptionPresetBuilderDialogProps = {
  packId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function OptionPresetBuilderDialog({
  packId,
  open,
  onOpenChange,
  onSaved,
}: OptionPresetBuilderDialogProps) {
  const [label, setLabel] = useState("Medium");
  const [id, setId] = useState("medium");
  const [description, setDescription] = useState("Balanced visuals and performance");
  const [activeScope, setActiveScope] = useState<OptionPresetScope>("video");
  const [rows, setRows] = useState<OptionPresetRow[]>([]);
  const [manualId, setManualId] = useState(false);

  const presets = useQuery({
    queryKey: ["option-presets", packId],
    queryFn: () => tauri.listOptionPresets(packId),
    enabled: open,
  });
  const capture = useQuery({
    queryKey: ["option-preset-capture", packId],
    queryFn: () => tauri.captureOptionPreset(packId),
    enabled: open,
    retry: false,
  });

  useEffect(() => {
    if (!capture.data) return;
    setRows(capture.data.rows);
  }, [capture.data]);

  useEffect(() => {
    if (manualId) return;
    setId(slugify(label));
  }, [label, manualId]);

  const savePreset = useMutation({
    mutationFn: (draft: SaveOptionPresetDraft) => tauri.saveOptionPreset(packId, draft),
    onSuccess: async (preset) => {
      toast.success("Preset saved", { description: preset.label });
      await presets.refetch();
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => toast.error("Preset save failed", { description: formatError(error) }),
  });

  const counts = useMemo(() => buildScopeCounts(rows), [rows]);
  const visibleRows = rows.filter((row) => row.scope === activeScope);
  const includedCount = rows.filter((row) => row.included).length;

  function updateScope(scope: OptionPresetScope, included: boolean) {
    setRows((current) => current.map((row) => (row.scope === scope ? { ...row, included } : row)));
  }

  function updateRecommended() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        included:
          row.scope === "video" || row.scope === "shader-iris" || row.scope === "shader-preset",
      })),
    );
  }

  function updateRow(target: OptionPresetRow, included: boolean) {
    setRows((current) =>
      current.map((row) =>
        row.scope === target.scope && row.key === target.key ? { ...row, included } : row,
      ),
    );
  }

  function handleSave() {
    savePreset.mutate({
      id,
      label,
      description,
      shaderPack: capture.data?.shaderPack ?? null,
      rows,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,44rem)] max-h-[90vh] flex-col overflow-hidden max-w-[96vw] sm:max-w-[72rem]">
        <DialogHeader>
          <DialogTitle>PRESET BUILDER</DialogTitle>
          <DialogDescription>
            Capture selected option keys from the current Prism instance.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 md:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="preset-label">NAME</Label>
                <Input
                  id="preset-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="preset-id">ID</Label>
                <Input
                  id="preset-id"
                  value={id}
                  onChange={(event) => {
                    setManualId(true);
                    setId(event.target.value);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="preset-description">DESCRIPTION</Label>
                <Textarea
                  id="preset-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-20"
                />
              </div>
            </div>

            <div className="grid gap-2">
              {scopes.map((scope) => (
                <button
                  key={scope.id}
                  type="button"
                  className={cn(
                    "flex items-center justify-between border border-line-soft/20 bg-surface-sunken/40 px-3 py-2 text-left",
                    activeScope === scope.id && "border-brand-core/50 bg-brand-core/10",
                  )}
                  onClick={() => setActiveScope(scope.id)}
                >
                  <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
                    {scope.label}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-text-high">
                    {counts[scope.id].included}/{counts[scope.id].total}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid gap-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-text-low">EXISTING</p>
              <div className="flex flex-wrap gap-2">
                {(presets.data ?? []).map((preset) => (
                  <Badge key={preset.id} variant="outline">
                    {preset.label}
                  </Badge>
                ))}
                {!presets.isLoading && (presets.data ?? []).length === 0 ? (
                  <span className="text-xs text-text-low">No presets yet.</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-text-low">
                  SELECT KEYS THIS PRESET OWNS
                </p>
                <p className="font-mono text-[10px] tabular-nums text-text-low">
                  {includedCount} selected
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={updateRecommended}>
                  RECOMMENDED
                </Button>
                <Button variant="outline" size="sm" onClick={() => updateScope(activeScope, true)}>
                  ALL
                </Button>
                <Button variant="outline" size="sm" onClick={() => updateScope(activeScope, false)}>
                  NONE
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden border border-line-soft/20 bg-surface-sunken/30">
              {capture.isLoading ? (
                <div className="flex items-center gap-3 p-4 text-sm text-text-low">
                  <Loader2 className="size-4 animate-spin text-brand-core" />
                  Capturing current instance settings...
                </div>
              ) : capture.error ? (
                <div className="p-4 text-sm text-signal-alert">{formatError(capture.error)}</div>
              ) : (
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24 px-3 py-2 text-center">INCLUDE</TableHead>
                        <TableHead className="px-3 py-2">SETTING</TableHead>
                        <TableHead className="px-3 py-2">VALUE</TableHead>
                        <TableHead className="px-3 py-2">SOURCE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y-0">
                      {visibleRows.map((row) => (
                        <TableRow key={`${row.scope}:${row.key}`} className="h-8">
                          <TableCell className="px-3 py-1.5 align-middle">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={row.included}
                                onCheckedChange={(checked) => updateRow(row, checked === true)}
                                aria-label={`Include ${row.key}`}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-1.5 align-top">
                            <span className="text-[11px] text-text-high">
                              {humanizeKey(row.key)}
                            </span>
                            <span className="block font-mono text-[10px] text-text-low">
                              {row.key}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-72 px-3 py-1.5 align-top">
                            <span
                              className="block truncate font-mono text-[11px] text-text-low"
                              title={row.value}
                            >
                              {row.value}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-1.5 align-top">
                            <span className="font-mono text-[10px] text-text-low">
                              {row.source}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            CANCEL
          </Button>
          <Button
            onClick={handleSave}
            disabled={savePreset.isPending || !label.trim() || !id.trim()}
          >
            {savePreset.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            SAVE PRESET
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildScopeCounts(rows: OptionPresetRow[]) {
  return Object.fromEntries(
    scopes.map((scope) => {
      const scopeRows = rows.filter((row) => row.scope === scope.id);
      return [
        scope.id,
        {
          total: scopeRows.length,
          included: scopeRows.filter((row) => row.included).length,
        },
      ];
    }),
  ) as Record<OptionPresetScope, { total: number; included: number }>;
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "preset"
  );
}

function humanizeKey(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\./g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
