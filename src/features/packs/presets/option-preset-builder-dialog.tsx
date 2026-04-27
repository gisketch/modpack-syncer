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
import type {
  OptionPresetFileRow,
  OptionPresetModRow,
  OptionPresetRow,
  OptionPresetScope,
  SaveOptionPresetDraft,
} from "@/lib/tauri";
import { tauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

const scopes: Array<{ id: OptionPresetScope; label: string }> = [
  { id: "video", label: "VIDEO SETTINGS" },
  { id: "keybinds", label: "KEYBINDS" },
  { id: "other", label: "OTHER OPTIONS" },
];

type PresetBuilderSection = OptionPresetScope | "files" | "mods";

const sections: Array<{ id: PresetBuilderSection; label: string }> = [
  ...scopes,
  { id: "files", label: "CONFIGS" },
  { id: "mods", label: "MODS" },
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
  const [activeSection, setActiveSection] = useState<PresetBuilderSection>("video");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<OptionPresetRow[]>([]);
  const [fileRows, setFileRows] = useState<OptionPresetFileRow[]>([]);
  const [modRows, setModRows] = useState<OptionPresetModRow[]>([]);
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
    setFileRows(capture.data.files);
    setModRows(capture.data.mods);
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
  const includedCount = rows.filter((row) => row.included).length;
  const includedFileCount = fileRows.filter((row) => row.included).length;
  const optionalModRows = modRows.filter((row) => row.optional);
  const disabledModCount = optionalModRows.filter((row) => row.disabled).length;
  const visibleRows = rows.filter(
    (row) => row.scope === activeSection && fuzzyMatch(`${humanizeKey(row.key)} ${row.key} ${row.value} ${row.source}`, search),
  );
  const visibleFileRows = fileRows.filter((row) => fuzzyMatch(row.relPath, search));
  const visibleModRows = optionalModRows.filter((row) => fuzzyMatch(row.filename, search));

  function updateScope(scope: OptionPresetScope, included: boolean) {
    setRows((current) => current.map((row) => (row.scope === scope ? { ...row, included } : row)));
  }

  function updateRecommended() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        included: row.scope === "video",
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

  function updateFileRow(target: OptionPresetFileRow, included: boolean) {
    setFileRows((current) =>
      current.map((row) =>
        row.relPath === target.relPath ? { ...row, included } : row,
      ),
    );
  }

  function updateAllFiles(included: boolean) {
    setFileRows((current) => current.map((row) => ({ ...row, included })));
  }

  function updateModRow(target: OptionPresetModRow, disabled: boolean) {
    setModRows((current) =>
      current.map((row) =>
        row.filename === target.filename ? { ...row, disabled } : row,
      ),
    );
  }

  function updateAllOptionalMods(disabled: boolean) {
    setModRows((current) => current.map((row) => (row.optional ? { ...row, disabled } : row)));
  }

  function handleAll(included: boolean) {
    if (isOptionScope(activeSection)) {
      updateScope(activeSection, included);
    } else if (activeSection === "files") {
      updateAllFiles(included);
    } else {
      updateAllOptionalMods(included);
    }
  }

  function handleSave() {
    savePreset.mutate({
      id,
      label,
      description,
      shaderPack: capture.data?.shaderPack ?? null,
      rows,
      files: fileRows,
      disabledMods: optionalModRows.filter((row) => row.disabled).map((row) => row.filename),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,50rem)] max-h-[92vh] flex-col overflow-hidden max-w-[96vw] sm:max-w-[78rem] xl:max-w-[88rem]">
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
              {sections.map((section) => {
                const count = sectionCount(section.id, counts, fileRows, optionalModRows);
                return (
                <button
                  key={section.id}
                  type="button"
                  className={cn(
                    "flex items-center justify-between border border-line-soft/20 bg-surface-sunken/40 px-3 py-2 text-left",
                    activeSection === section.id && "border-brand-core/50 bg-brand-core/10",
                  )}
                  onClick={() => {
                    setActiveSection(section.id);
                    setSearch("");
                  }}
                >
                  <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
                    {section.label}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-text-high">
                    {count.included}/{count.total}
                  </span>
                </button>
              );
              })}
            </div>

            <div className="grid gap-2 border border-line-soft/20 bg-surface-sunken/40 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-text-low">PRESET OWNS</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="font-mono text-sm tabular-nums text-text-high">{includedCount}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-low">OPTIONS</p>
                </div>
                <div>
                  <p className="font-mono text-sm tabular-nums text-text-high">{includedFileCount}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-low">FILES</p>
                </div>
                <div>
                  <p className="font-mono text-sm tabular-nums text-text-high">{disabledModCount}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-low">MODS OFF</p>
                </div>
              </div>
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
                  {sectionTitle(activeSection)}
                </p>
                <p className="font-mono text-[10px] tabular-nums text-text-low">
                  {sectionCount(activeSection, counts, fileRows, optionalModRows).included} selected
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isOptionScope(activeSection) ? (
                  <Button variant="outline" size="sm" onClick={updateRecommended}>
                    RECOMMENDED
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => handleAll(true)}>
                  ALL
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAll(false)}>
                  NONE
                </Button>
              </div>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${sectionSearchLabel(activeSection)}`}
            />

            <div className="min-h-0 flex-1 overflow-hidden">
              {capture.isLoading ? (
                <div className="flex items-center gap-3 p-4 text-sm text-text-low">
                  <Loader2 className="size-4 animate-spin text-brand-core" />
                  Capturing current instance settings...
                </div>
              ) : capture.error ? (
                <div className="p-4 text-sm text-signal-alert">{formatError(capture.error)}</div>
              ) : activeSection === "files" ? (
                <PresetFilesPanel rows={visibleFileRows} onChange={updateFileRow} />
              ) : activeSection === "mods" ? (
                <PresetModsPanel rows={visibleModRows} onChange={updateModRow} />
              ) : (
                <PresetOptionsPanel rows={visibleRows} onChange={updateRow} />
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

function PresetOptionsPanel({
  rows,
  onChange,
}: {
  rows: OptionPresetRow[];
  onChange: (row: OptionPresetRow, included: boolean) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border border-line-soft/20 bg-surface-sunken/30">
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
            {rows.map((row) => (
              <TableRow key={`${row.scope}:${row.key}`} className="h-8">
                <TableCell className="px-3 py-1.5 align-middle">
                  <div className="flex justify-center">
                    <Checkbox
                      checked={row.included}
                      onCheckedChange={(checked) => onChange(row, checked === true)}
                      aria-label={`Include ${row.key}`}
                    />
                  </div>
                </TableCell>
                <TableCell className="px-3 py-1.5 align-top">
                  <span className="text-[11px] text-text-high">{humanizeKey(row.key)}</span>
                  <span className="block font-mono text-[10px] text-text-low">{row.key}</span>
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
                  <span className="font-mono text-[10px] text-text-low">{row.source}</span>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-3 py-6 text-center text-sm text-text-low">
                  No matching option keys.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function PresetFilesPanel({
  rows,
  onChange,
}: {
  rows: OptionPresetFileRow[];
  onChange: (row: OptionPresetFileRow, included: boolean) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden border border-line-soft/20 bg-surface-sunken/30">
      <div className="flex items-center justify-between border-line-soft/20 border-b px-3 py-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-text-low">FILE OVERRIDES</p>
          <p className="text-[11px] text-text-low">config/** and shaderpacks/*.txt</p>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-text-low">
          {rows.filter((row) => row.included).length}/{rows.length}
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <Table>
          <TableBody className="divide-y-0">
            {rows.map((row) => (
              <TableRow key={row.relPath} className="h-8">
                <TableCell className="w-12 px-3 py-1.5 text-center">
                  <Checkbox
                    checked={row.included}
                    onCheckedChange={(checked) => onChange(row, checked === true)}
                    aria-label={`Include ${row.relPath}`}
                  />
                </TableCell>
                <TableCell className="min-w-0 px-3 py-1.5">
                  <span className="block truncate font-mono text-[11px] text-text-high">
                    {row.relPath}
                  </span>
                </TableCell>
                <TableCell className="w-20 px-3 py-1.5 text-right font-mono text-[10px] text-text-low tabular-nums">
                  {formatPresetBytes(row.size)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell className="px-3 py-6 text-center text-sm text-text-low">
                  No preset files found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function PresetModsPanel({
  rows,
  onChange,
}: {
  rows: OptionPresetModRow[];
  onChange: (row: OptionPresetModRow, disabled: boolean) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden border border-line-soft/20 bg-surface-sunken/30">
      <div className="flex items-center justify-between border-line-soft/20 border-b px-3 py-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-text-low">DISABLED MODS</p>
          <p className="text-[11px] text-text-low">mods renamed to .disabled when preset syncs</p>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-text-low">
          {rows.filter((row) => row.disabled).length}/{rows.length}
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <Table>
          <TableBody className="divide-y-0">
            {rows.map((row) => (
              <TableRow key={row.filename} className="h-8">
                <TableCell className="w-12 px-3 py-1.5 text-center">
                  <Checkbox
                    checked={row.disabled}
                    onCheckedChange={(checked) => onChange(row, checked === true)}
                    aria-label={`Disable ${row.filename}`}
                  />
                </TableCell>
                <TableCell className="min-w-0 px-3 py-1.5">
                  <span className="block truncate text-[11px] text-text-high">
                    {row.filename}
                  </span>
                </TableCell>
                <TableCell className="w-24 px-3 py-1.5 text-right">
                  <Badge variant={row.optional ? "outline" : "secondary"}>
                    {row.optional ? "OPTIONAL" : "PACK MOD"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell className="px-3 py-6 text-center text-sm text-text-low">
                  No manifest mods found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function formatPresetBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isOptionScope(section: PresetBuilderSection): section is OptionPresetScope {
  return section === "video" || section === "keybinds" || section === "other";
}

function sectionCount(
  section: PresetBuilderSection,
  counts: Record<OptionPresetScope, { total: number; included: number }>,
  files: OptionPresetFileRow[],
  mods: OptionPresetModRow[],
) {
  if (isOptionScope(section)) return counts[section];
  if (section === "files") {
    return { total: files.length, included: files.filter((row) => row.included).length };
  }
  return { total: mods.length, included: mods.filter((row) => row.disabled).length };
}

function sectionTitle(section: PresetBuilderSection) {
  if (section === "files") return "SELECT CONFIG FILE OVERRIDES";
  if (section === "mods") return "SELECT OPTIONAL MODS TO DISABLE";
  return "SELECT OPTION KEYS THIS PRESET OWNS";
}

function sectionSearchLabel(section: PresetBuilderSection) {
  if (section === "files") return "config files";
  if (section === "mods") return "optional mods";
  return "option keys";
}

function fuzzyMatch(value: string, query: string) {
  const haystack = value.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return haystack.includes(needle);
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
