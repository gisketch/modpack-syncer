import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Boxes,
  Download,
  Heart,
  Loader2,
  Package,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardStatus,
  CardTitle,
  CardWindowBar,
  CardWindowTab,
} from "@/components/ui/card";
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
import {
  Pagination,
  PaginationControls,
  PaginationIndicator,
  PaginationInfo,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatError } from "@/lib/format-error";
import {
  type Manifest,
  type ManifestArtifactCategory,
  type ManifestEntry,
  type ModrinthDependencySummary,
  type ModrinthSearchHit,
  type ModrinthSearchSide,
  type ModrinthSearchSort,
  type ModrinthVersionSummary,
  type Side,
  tauri,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

const PAGE_SIZE = 20;
const CATEGORIES: Array<{
  id: ManifestArtifactCategory;
  label: string;
  projectLabel: string;
}> = [
  { id: "mods", label: "MODS", projectLabel: "mod" },
  { id: "resourcepacks", label: "RESOURCEPACKS", projectLabel: "resourcepack" },
  { id: "shaderpacks", label: "SHADERPACKS", projectLabel: "shader" },
];

const SORTS: Array<{ value: ModrinthSearchSort; label: string }> = [
  { value: "relevance", label: "RELEVANCE" },
  { value: "downloads", label: "DOWNLOADS" },
  { value: "follows", label: "FOLLOWS" },
  { value: "updated", label: "UPDATED" },
  { value: "newest", label: "NEWEST" },
];

const SIDES: Array<{ value: ModrinthSearchSide; label: string }> = [
  { value: "all", label: "ANY SIDE" },
  { value: "client", label: "CLIENT" },
  { value: "server", label: "SERVER" },
  { value: "both", label: "CLIENT + SERVER" },
];

const LOADING_ROW_KEYS = [
  "builder-row-a",
  "builder-row-b",
  "builder-row-c",
  "builder-row-d",
  "builder-row-e",
];

type ModpackBuilderPageProps = {
  packId: string;
  onBack: () => void;
};

type BuilderTab = ManifestArtifactCategory | "manifest";

type ManifestEditorRowData = {
  entry: ManifestEntry;
  deletedFromManifest: boolean;
};

export function ModpackBuilderPage({ packId, onBack }: ModpackBuilderPageProps) {
  const qc = useQueryClient();
  const adminMode = useAppStore((state) => state.adminModeByPack[packId] ?? false);
  const [builderTab, setBuilderTab] = useState<BuilderTab>("mods");
  const [category, setCategory] = useState<ManifestArtifactCategory>("mods");
  const [searchText, setSearchText] = useState("");
  const [pageByCategory, setPageByCategory] = useState<Record<ManifestArtifactCategory, number>>({
    mods: 1,
    resourcepacks: 1,
    shaderpacks: 1,
  });
  const [side, setSide] = useState<ModrinthSearchSide>("all");
  const [sort, setSort] = useState<ModrinthSearchSort>("relevance");
  const [installTarget, setInstallTarget] = useState<ModrinthSearchHit | null>(null);
  const debouncedSearch = useDebouncedValue(searchText, 300);
  const page = pageByCategory[category];

  const manifest = useQuery({
    queryKey: ["manifest", packId],
    queryFn: () => tauri.loadManifest(packId),
    retry: false,
  });
  const sourceManifest = useQuery({
    queryKey: ["source-manifest", packId],
    queryFn: () => tauri.loadSourceManifest(packId),
    enabled: adminMode,
    retry: false,
  });
  const search = useQuery({
    queryKey: ["modrinth-builder-search", packId, category, debouncedSearch, page, side, sort],
    queryFn: () =>
      tauri.searchModrinthProjects(packId, category, debouncedSearch, page, side, sort),
    enabled: !!manifest.data,
    staleTime: 60_000,
    retry: 1,
  });
  const add = useMutation({
    mutationFn: (payload: {
      projectId: string;
      versionId: string;
      side: Side;
      installDependencies: boolean;
    }) =>
      tauri.addModrinthMod(
        packId,
        category,
        payload.projectId,
        payload.versionId,
        payload.side,
        payload.installDependencies,
      ),
    onSuccess: async (entry) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["manifest", packId] }),
        qc.invalidateQueries({ queryKey: ["mod-statuses", packId] }),
        qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] }),
        qc.invalidateQueries({ queryKey: ["modrinth-builder-search", packId] }),
      ]);
      toast.success("Downloaded to instance", { description: entry.filename });
    },
    onError: (error) => toast.error("Install failed", { description: formatError(error) }),
  });
  const updateManifestOptional = useMutation({
    mutationFn: (payload: {
      category: ManifestArtifactCategory;
      filename: string;
      optional: boolean;
    }) =>
      tauri.setManifestArtifactOptional(
        packId,
        payload.category,
        payload.filename,
        payload.optional,
      ),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["manifest", packId] }),
        qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] }),
        qc.invalidateQueries({ queryKey: ["mod-statuses", packId] }),
      ]);
    },
    onError: (error) => toast.error("Manifest update failed", { description: formatError(error) }),
  });
  const deleteManifestArtifact = useMutation({
    mutationFn: (payload: { category: ManifestArtifactCategory; filename: string }) =>
      tauri.deleteManifestArtifact(packId, payload.category, payload.filename),
    onSuccess: async (entry) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["manifest", packId] }),
        qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] }),
        qc.invalidateQueries({ queryKey: ["mod-statuses", packId] }),
        qc.invalidateQueries({ queryKey: ["modrinth-builder-search", packId] }),
      ]);
      toast.success("Removed from manifest", { description: entry.filename });
    },
    onError: (error) => toast.error("Manifest delete failed", { description: formatError(error) }),
  });
  const restoreManifestArtifact = useMutation({
    mutationFn: (payload: { category: ManifestArtifactCategory; filename: string }) =>
      tauri.restoreManifestArtifact(packId, payload.category, payload.filename),
    onSuccess: async (entry) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["manifest", packId] }),
        qc.invalidateQueries({ queryKey: ["artifact-publish-scan", packId] }),
        qc.invalidateQueries({ queryKey: ["mod-statuses", packId] }),
        qc.invalidateQueries({ queryKey: ["modrinth-builder-search", packId] }),
      ]);
      toast.success("Restored to manifest", { description: entry.filename });
    },
    onError: (error) => toast.error("Manifest restore failed", { description: formatError(error) }),
  });

  const totalPages = Math.max(1, Math.ceil((search.data?.totalHits ?? 0) / PAGE_SIZE));
  const activeCategory = CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0];
  const manifestCounts = useMemo(
    () => ({
      mods: manifest.data?.mods.length ?? 0,
      resourcepacks: manifest.data?.resourcepacks.length ?? 0,
      shaderpacks:
        manifest.data?.shaderpacks.filter((entry) => !entry.filename.endsWith(".txt")).length ?? 0,
    }),
    [manifest.data],
  );

  function resetPage(nextCategory = category) {
    setPageByCategory((current) => ({ ...current, [nextCategory]: 1 }));
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-8">
      <header className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft /> BACK
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
            :: MODPACK BUILDER / {packId}
          </span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-3xl flex-col gap-2">
            <h1 className="text-3xl text-text-high [text-wrap:balance]">Modpack Builder</h1>
            <p className="text-sm text-text-low [text-wrap:pretty]">
              Browse compatible Modrinth projects for this pack. Install opens version picker, so
              latest and older compatible versions can be staged into Prism for publish review.
            </p>
            {!adminMode ? (
              <div className="border border-signal-warn/25 bg-signal-warn/8 px-4 py-3 text-sm text-signal-warn [text-wrap:pretty]">
                Local install is available. Admins are the only users who can publish updates or
                change the pack source of truth.
              </div>
            ) : null}
          </div>
          {manifest.data ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Badge>MC {manifest.data.pack.mcVersion}</Badge>
              <Badge variant="outline">{manifest.data.pack.loader.toUpperCase()}</Badge>
              <Badge variant="outline">20 / PAGE</Badge>
            </div>
          ) : null}
        </div>
      </header>

      <Tabs
        value={builderTab}
        onValueChange={(value) => {
          if (value === "manifest") {
            setBuilderTab("manifest");
            setInstallTarget(null);
            return;
          }
          const next = value as ManifestArtifactCategory;
          setBuilderTab(next);
          setCategory(next);
          setInstallTarget(null);
          resetPage(next);
        }}
        className="gap-5"
      >
        <TabsList className="flex-wrap gap-2">
          {CATEGORIES.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              <span>{item.label}</span>
              <span className="font-mono text-[10px] tabular-nums text-text-low">
                {manifestCounts[item.id]}
              </span>
            </TabsTrigger>
          ))}
          {adminMode ? (
            <TabsTrigger value="manifest">
              <span>MANIFEST</span>
              <span className="font-mono text-[10px] tabular-nums text-text-low">ADMIN</span>
            </TabsTrigger>
          ) : null}
        </TabsList>

        {CATEGORIES.map((item) => (
          <TabsContent key={item.id} value={item.id} className="outline-none">
            <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
              <BuilderFilters
                categoryLabel={activeCategory.label}
                searchText={searchText}
                onSearchTextChange={(value) => {
                  setSearchText(value);
                  resetPage();
                }}
                side={side}
                onSideChange={(value) => {
                  setSide(value);
                  resetPage();
                }}
                sort={sort}
                onSortChange={(value) => {
                  setSort(value);
                  resetPage();
                }}
                mcVersion={manifest.data?.pack.mcVersion}
                loader={manifest.data?.pack.loader}
                category={category}
              />

              <Card variant="window" className="min-h-[34rem]">
                <CardWindowBar>
                  <CardWindowTab>{activeCategory.label} SEARCH</CardWindowTab>
                  <CardStatus>
                    {search.isFetching ? "Scanning" : `${search.data?.totalHits ?? 0} hits`}
                  </CardStatus>
                </CardWindowBar>
                <CardContent className="flex min-h-0 flex-col gap-4 p-4">
                  <SearchSummary
                    loading={search.isFetching}
                    category={activeCategory.projectLabel}
                    total={search.data?.totalHits ?? 0}
                    page={page}
                    totalPages={totalPages}
                  />
                  <div className="flex min-h-[28rem] flex-col gap-3 pr-2">
                    {search.isLoading || manifest.isLoading ? (
                      <LoadingRows />
                    ) : search.error ? (
                      <EmptyState title="SEARCH FAILED" body={formatError(search.error)} />
                    ) : (search.data?.hits.length ?? 0) === 0 ? (
                      <EmptyState title="NO MATCHES" body="Try different search or filters." />
                    ) : (
                      search.data?.hits.map((hit) => (
                        <BuilderResultCard
                          key={hit.projectId}
                          hit={hit}
                          pending={add.isPending && add.variables?.projectId === hit.projectId}
                          onInstall={() => setInstallTarget(hit)}
                        />
                      ))
                    )}
                  </div>
                  <Pagination className="justify-between border-line-soft/20 border-t pt-3">
                    <PaginationInfo>
                      {search.data
                        ? `${search.data.offset + 1}-${Math.min(
                            search.data.offset + search.data.limit,
                            search.data.totalHits,
                          )} / ${search.data.totalHits}`
                        : "0 / 0"}
                    </PaginationInfo>
                    <PaginationControls>
                      <PaginationPrevious
                        disabled={page <= 1 || search.isFetching}
                        onClick={() =>
                          setPageByCategory((current) => ({
                            ...current,
                            [category]: Math.max(1, current[category] - 1),
                          }))
                        }
                      />
                      <PaginationIndicator page={page} total={totalPages} />
                      <PaginationNext
                        disabled={page >= totalPages || search.isFetching}
                        onClick={() =>
                          setPageByCategory((current) => ({
                            ...current,
                            [category]: Math.min(totalPages, current[category] + 1),
                          }))
                        }
                      />
                    </PaginationControls>
                  </Pagination>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
        {adminMode ? (
          <TabsContent value="manifest" className="outline-none">
            <ManifestEditor
              manifest={manifest.data ?? null}
              sourceManifest={sourceManifest.data ?? null}
              pendingOptional={updateManifestOptional.isPending}
              pendingDelete={deleteManifestArtifact.isPending}
              pendingRestore={restoreManifestArtifact.isPending}
              onOptionalChange={(entryCategory, filename, optional) =>
                updateManifestOptional.mutate({ category: entryCategory, filename, optional })
              }
              onDelete={(entryCategory, filename) =>
                deleteManifestArtifact.mutate({ category: entryCategory, filename })
              }
              onRestore={(entryCategory, filename) =>
                restoreManifestArtifact.mutate({ category: entryCategory, filename })
              }
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <InstallProjectDialog
        open={!!installTarget}
        packId={packId}
        category={category}
        hit={installTarget}
        pending={add.isPending}
        onClose={() => setInstallTarget(null)}
        onInstall={(versionId, selectedSide, installDependencies) => {
          if (!installTarget) return;
          add.mutate(
            {
              projectId: installTarget.projectId,
              versionId,
              side: selectedSide,
              installDependencies,
            },
            { onSuccess: () => setInstallTarget(null) },
          );
        }}
      />
    </div>
  );
}

function BuilderFilters({
  categoryLabel,
  searchText,
  onSearchTextChange,
  side,
  onSideChange,
  sort,
  onSortChange,
  mcVersion,
  loader,
  category,
}: {
  categoryLabel: string;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  side: ModrinthSearchSide;
  onSideChange: (value: ModrinthSearchSide) => void;
  sort: ModrinthSearchSort;
  onSortChange: (value: ModrinthSearchSort) => void;
  mcVersion?: string;
  loader?: string;
  category: ManifestArtifactCategory;
}) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>
          <Search className="inline size-4" /> FILTERS
        </CardTitle>
        <CardDescription>{categoryLabel} from Modrinth only.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">SEARCH</span>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-low" />
            <Input
              value={searchText}
              onChange={(event) => onSearchTextChange(event.target.value)}
              placeholder={`SEARCH ${categoryLabel}`}
              className="pl-10"
            />
          </div>
        </div>

        <Select
          value={sort}
          onValueChange={(value) => value && onSortChange(value as ModrinthSearchSort)}
        >
          <SelectTrigger>
            <SelectValue placeholder="SORT" />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={side}
          onValueChange={(value) => value && onSideChange(value as ModrinthSearchSide)}
        >
          <SelectTrigger>
            <SelectValue placeholder="SIDE" />
          </SelectTrigger>
          <SelectContent>
            {SIDES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid gap-2 text-xs">
          <FilterFact label="MC VERSION" value={mcVersion ?? "--"} />
          <FilterFact label="LOADER" value={category === "mods" ? (loader ?? "--") : "MC ONLY"} />
          <FilterFact label="PAGE SIZE" value="20" />
        </div>
      </CardContent>
    </Card>
  );
}

function ManifestEditor({
  manifest,
  sourceManifest,
  pendingOptional,
  pendingDelete,
  pendingRestore,
  onOptionalChange,
  onDelete,
  onRestore,
}: {
  manifest: Manifest | null;
  sourceManifest: Manifest | null;
  pendingOptional: boolean;
  pendingDelete: boolean;
  pendingRestore: boolean;
  onOptionalChange: (
    category: ManifestArtifactCategory,
    filename: string,
    optional: boolean,
  ) => void;
  onDelete: (category: ManifestArtifactCategory, filename: string) => void;
  onRestore: (category: ManifestArtifactCategory, filename: string) => void;
}) {
  const [search, setSearch] = useState("");
  if (!manifest || !sourceManifest) {
    return <EmptyState title="NO MANIFEST" body="Manifest not loaded." />;
  }
  return (
    <Card variant="window">
      <CardWindowBar>
        <CardWindowTab>MANIFEST EDITOR</CardWindowTab>
        <CardStatus>Admin source-of-truth edits</CardStatus>
      </CardWindowBar>
      <CardContent className="flex flex-col gap-5 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-text-high">Pack Manifest</h2>
            <p className="text-sm text-text-low [text-wrap:pretty]">
              Delete entries or change optional flags here. Publish preview will show manifest and
              repo file changes before push.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-low" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="SEARCH MANIFEST"
              className="pl-10"
            />
          </div>
        </div>
        <div className="grid gap-4">
          {CATEGORIES.map((category) => (
            <ManifestEditorSection
              key={category.id}
              category={category.id}
              label={category.label}
              rows={filterManifestEditorRows(
                manifestEditorRows(
                  entriesForManifestCategory(manifest, category.id),
                  entriesForManifestCategory(sourceManifest, category.id),
                ),
                search,
              )}
              pendingOptional={pendingOptional}
              pendingDelete={pendingDelete}
              pendingRestore={pendingRestore}
              onOptionalChange={onOptionalChange}
              onDelete={onDelete}
              onRestore={onRestore}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ManifestEditorSection({
  category,
  label,
  rows,
  pendingOptional,
  pendingDelete,
  pendingRestore,
  onOptionalChange,
  onDelete,
  onRestore,
}: {
  category: ManifestArtifactCategory;
  label: string;
  rows: ManifestEditorRowData[];
  pendingOptional: boolean;
  pendingDelete: boolean;
  pendingRestore: boolean;
  onOptionalChange: (
    category: ManifestArtifactCategory,
    filename: string,
    optional: boolean,
  ) => void;
  onDelete: (category: ManifestArtifactCategory, filename: string) => void;
  onRestore: (category: ManifestArtifactCategory, filename: string) => void;
}) {
  return (
    <section className="border border-line-soft/20 bg-surface-panel-strong/35 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-sm text-text-high tracking-[0.12em]">{label}</h3>
        <Badge variant="outline">{rows.length}</Badge>
      </div>
      {rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NAME</TableHead>
              <TableHead>SOURCE</TableHead>
              <TableHead>SIDE</TableHead>
              <TableHead className="text-center">OPTIONAL</TableHead>
              <TableHead className="text-right">ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ManifestEditorRow
                key={`${category}:${row.entry.filename}`}
                category={category}
                row={row}
                pendingOptional={pendingOptional}
                pendingDelete={pendingDelete}
                pendingRestore={pendingRestore}
                onOptionalChange={onOptionalChange}
                onDelete={onDelete}
                onRestore={onRestore}
              />
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="py-4 text-center text-sm text-text-low">No entries.</p>
      )}
    </section>
  );
}

function ManifestEditorRow({
  category,
  row,
  pendingOptional,
  pendingDelete,
  pendingRestore,
  onOptionalChange,
  onDelete,
  onRestore,
}: {
  category: ManifestArtifactCategory;
  row: ManifestEditorRowData;
  pendingOptional: boolean;
  pendingDelete: boolean;
  pendingRestore: boolean;
  onOptionalChange: (
    category: ManifestArtifactCategory,
    filename: string,
    optional: boolean,
  ) => void;
  onDelete: (category: ManifestArtifactCategory, filename: string) => void;
  onRestore: (category: ManifestArtifactCategory, filename: string) => void;
}) {
  const { entry, deletedFromManifest } = row;
  return (
    <TableRow className={cn("h-9", deletedFromManifest && "opacity-55")}>
      <TableCell className="py-1.5">
        <div className="min-w-0">
          <p
            className={cn(
              "max-w-[28rem] truncate text-xs font-semibold",
              deletedFromManifest ? "text-text-low line-through" : "text-text-high",
            )}
            title={entry.filename}
          >
            {entry.filename}
          </p>
          <p className="max-w-[28rem] truncate text-[11px] text-text-low" title={entry.id}>
            {entry.id}
            {entry.repoPath ? ` · ${entry.repoPath}` : ""}
          </p>
        </div>
      </TableCell>
      <TableCell className="py-1.5">
        <Badge variant={deletedFromManifest ? "outline" : "secondary"}>
          {deletedFromManifest ? "REMOVED" : entry.source.toUpperCase()}
        </Badge>
      </TableCell>
      <TableCell className="py-1.5 text-text-low text-xs uppercase">{entry.side}</TableCell>
      <TableCell className="py-1.5 text-center">
        <Checkbox
          checked={entry.optional}
          onCheckedChange={(checked) =>
            onOptionalChange(category, entry.filename, checked === true)
          }
          disabled={pendingOptional || deletedFromManifest}
          aria-label={`Optional ${entry.filename}`}
        />
      </TableCell>
      <TableCell className="py-1.5 text-right">
        {deletedFromManifest ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRestore(category, entry.filename)}
            disabled={pendingRestore}
          >
            {pendingRestore ? <Loader2 className="animate-spin" /> : <Sparkles />}
            RESTORE
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(category, entry.filename)}
            disabled={pendingDelete}
          >
            {pendingDelete ? <Loader2 className="animate-spin" /> : <Trash2 />}
            DELETE
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function BuilderResultCard({
  hit,
  pending,
  onInstall,
}: {
  hit: ModrinthSearchHit;
  pending: boolean;
  onInstall: () => void;
}) {
  return (
    <div
      className={cn(
        "border border-line-soft/20 bg-surface-panel-strong/55 p-3 transition-[border-color,background-color,opacity] duration-200",
        "hover:border-brand-core/35 hover:bg-surface-panel-strong/80",
        hit.alreadyTracked && "border-brand-core/25 bg-brand-core/5",
      )}
    >
      <div className="grid gap-3 md:grid-cols-[72px_minmax(0,1fr)_150px]">
        <div className="flex size-[72px] items-center justify-center overflow-hidden bg-surface-base outline outline-1 outline-white/10">
          {hit.iconUrl ? (
            <img src={hit.iconUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <Package className="size-7 text-text-low" />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="truncate text-base font-semibold text-text-high" title={hit.title}>
                {hit.title}
              </h2>
              <span className="text-xs text-text-low">by {hit.author}</span>
            </div>
            <p className="line-clamp-2 text-sm text-text-low [text-wrap:pretty]">
              {hit.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Metric icon={<Download className="size-3" />} value={formatCompact(hit.downloads)} />
            <Metric icon={<Heart className="size-3" />} value={formatCompact(hit.follows)} />
            <Badge variant="outline">{hit.suggestedSide.toUpperCase()}</Badge>
            {hit.categories.slice(0, 3).map((category) => (
              <Badge key={category} variant="secondary">
                {category}
              </Badge>
            ))}
            {hit.alreadyTracked ? <Badge>INSTALLED</Badge> : null}
          </div>
        </div>
        <div className="flex items-center justify-end">
          <Button size="sm" disabled={pending} onClick={onInstall}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {hit.alreadyTracked ? "CHANGE VERSION" : "INSTALL"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InstallProjectDialog({
  open,
  packId,
  category,
  hit,
  pending,
  onClose,
  onInstall,
}: {
  open: boolean;
  packId: string;
  category: ManifestArtifactCategory;
  hit: ModrinthSearchHit | null;
  pending: boolean;
  onClose: () => void;
  onInstall: (versionId: string, side: Side, installDependencies: boolean) => void;
}) {
  const versions = useQuery({
    queryKey: ["modrinth-builder-versions", packId, category, hit?.projectId],
    queryFn: () => tauri.listModrinthProjectVersions(packId, category, hit?.projectId ?? ""),
    enabled: open && !!hit,
    staleTime: 300_000,
    retry: 1,
  });
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedSide, setSelectedSide] = useState<Side>("client");
  const [installDependencies, setInstallDependencies] = useState(true);
  const selectedVersion = versions.data?.find((version) => version.id === selectedVersionId);
  const dependencies = useQuery({
    queryKey: ["modrinth-builder-dependencies", packId, category, selectedVersionId],
    queryFn: () => tauri.listModrinthVersionDependencies(packId, category, selectedVersionId),
    enabled: open && category === "mods" && !!selectedVersionId,
    staleTime: 300_000,
    retry: 1,
  });
  const missingDependencies = (dependencies.data ?? []).filter(
    (dependency) => !dependency.alreadyTracked,
  );

  useEffect(() => {
    if (!open || !hit) return;
    setSelectedSide(hit.trackedSide ?? hit.suggestedSide);
    setSelectedVersionId("");
    setInstallDependencies(true);
  }, [hit, open]);

  useEffect(() => {
    if (!open || selectedVersionId) return;
    const tracked = versions.data?.find((version) => version.id === hit?.trackedVersionId);
    const fallback = tracked ?? versions.data?.[0];
    if (fallback) setSelectedVersionId(fallback.id);
  }, [hit?.trackedVersionId, open, selectedVersionId, versions.data]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{hit?.alreadyTracked ? "CHANGE VERSION" : "INSTALL PROJECT"}</DialogTitle>
          <DialogDescription>
            Choose compatible version for {hit?.title ?? "project"}. Versions are filtered to this
            pack's Minecraft version and loader rules.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5 p-6">
          {hit ? <DialogProjectHeader hit={hit} /> : null}
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
            <Select
              value={selectedVersionId}
              onValueChange={(value) => value && setSelectedVersionId(value)}
              disabled={versions.isLoading || versions.isError || pending}
            >
              <SelectTrigger>
                <span className="min-w-0 truncate text-left">
                  {selectedVersion
                    ? `${selectedVersion.versionNumber}${selectedVersion.id === hit?.trackedVersionId ? " · CURRENT" : ""}`
                    : versions.isLoading
                      ? "LOADING VERSIONS"
                      : "VERSION"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {(versions.data ?? []).map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span>
                        {version.versionNumber}
                        {version.id === hit?.trackedVersionId ? " · CURRENT" : ""}
                      </span>
                      <span className="truncate font-normal text-[11px] text-text-low">
                        {version.filename}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedSide}
              onValueChange={(value) => value && setSelectedSide(value as Side)}
              disabled={pending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">CLIENT</SelectItem>
                <SelectItem value="server">SERVER</SelectItem>
                <SelectItem value="both">BOTH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <VersionDetails
            version={selectedVersion}
            loading={versions.isLoading}
            error={versions.error}
          />
          {category === "mods" ? (
            <DependencyPreview
              dependencies={dependencies.data ?? []}
              loading={dependencies.isLoading || dependencies.isFetching}
              error={dependencies.error}
              installDependencies={installDependencies}
              onInstallDependenciesChange={setInstallDependencies}
            />
          ) : null}
        </DialogBody>
        <DialogFooter className="px-6 py-4 sm:justify-between">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            CANCEL
          </Button>
          <Button
            onClick={() =>
              selectedVersionId &&
              onInstall(
                selectedVersionId,
                selectedSide,
                installDependencies && missingDependencies.length > 0,
              )
            }
            disabled={!selectedVersionId || versions.isLoading || versions.isError || pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {installDependencies && missingDependencies.length > 0
              ? `${hit?.alreadyTracked ? "CHANGE VERSION" : "INSTALL"} + ${missingDependencies.length} DEPS`
              : hit?.alreadyTracked
                ? "CHANGE VERSION"
                : "INSTALL"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DependencyPreview({
  dependencies,
  loading,
  error,
  installDependencies,
  onInstallDependenciesChange,
}: {
  dependencies: ModrinthDependencySummary[];
  loading: boolean;
  error: unknown;
  installDependencies: boolean;
  onInstallDependenciesChange: (value: boolean) => void;
}) {
  const missingDependencies = dependencies.filter((dependency) => !dependency.alreadyTracked);
  if (loading) {
    return <p className="text-sm text-text-low">Checking required dependencies...</p>;
  }
  if (error) {
    return <p className="text-sm text-signal-alert">{formatError(error)}</p>;
  }
  if (dependencies.length === 0) {
    return <p className="text-sm text-text-low">No required dependencies found.</p>;
  }
  return (
    <div className="flex flex-col gap-3 border border-line-soft/20 bg-surface-panel-strong/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-high">Required dependencies</p>
          <p className="text-xs text-text-low">
            {missingDependencies.length} missing / {dependencies.length} total
          </p>
        </div>
        <div className="flex min-h-10 items-center gap-2 text-xs text-text-low">
          <Checkbox
            checked={installDependencies}
            onCheckedChange={(checked) => onInstallDependenciesChange(checked === true)}
            disabled={missingDependencies.length === 0}
            aria-label="Download required dependencies too"
          />
          DOWNLOAD THEM TOO
        </div>
      </div>
      <div className="grid gap-2">
        {dependencies.map((dependency) => (
          <DependencyRow key={dependency.projectId} dependency={dependency} />
        ))}
      </div>
    </div>
  );
}

function DependencyRow({ dependency }: { dependency: ModrinthDependencySummary }) {
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border border-line-soft/15 bg-surface-base/45 p-2">
      <div className="flex size-9 items-center justify-center overflow-hidden bg-surface-panel outline outline-1 outline-white/10">
        {dependency.iconUrl ? (
          <img src={dependency.iconUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <Package className="size-4 text-text-low" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-text-high">{dependency.title}</p>
        <p className="truncate text-xs text-text-low">
          {dependency.versionNumber} · {dependency.filename}
        </p>
      </div>
      <Badge variant={dependency.alreadyTracked ? "secondary" : "outline"}>
        {dependency.alreadyTracked ? "INSTALLED" : "NEEDED"}
      </Badge>
    </div>
  );
}

function DialogProjectHeader({ hit }: { hit: ModrinthSearchHit }) {
  return (
    <div className="flex items-start gap-4 border border-line-soft/20 bg-surface-panel-strong/45 p-3">
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden bg-surface-base outline outline-1 outline-white/10">
        {hit.iconUrl ? (
          <img src={hit.iconUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <Package className="size-5 text-text-low" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base text-text-high">{hit.title}</p>
        <p className="text-xs text-text-low">by {hit.author}</p>
        <p className="line-clamp-2 text-xs text-text-low [text-wrap:pretty]">{hit.description}</p>
      </div>
    </div>
  );
}

function VersionDetails({
  version,
  loading,
  error,
}: {
  version?: ModrinthVersionSummary;
  loading: boolean;
  error: unknown;
}) {
  if (loading) {
    return <p className="text-sm text-text-low">Loading compatible versions...</p>;
  }
  if (error) {
    return <p className="text-sm text-signal-alert">{formatError(error)}</p>;
  }
  if (!version) {
    return <p className="text-sm text-text-low">No compatible version selected.</p>;
  }
  return (
    <div className="grid gap-2 text-xs">
      <FilterFact label="VERSION" value={version.versionNumber} />
      <FilterFact label="FILE" value={version.filename} />
      <FilterFact label="SIZE" value={formatBytes(version.size)} />
    </div>
  );
}

function SearchSummary({
  loading,
  category,
  total,
  page,
  totalPages,
}: {
  loading: boolean;
  category: string;
  total: number;
  page: number;
  totalPages: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-line-soft/20 border-b pb-3">
      <div className="flex items-center gap-2 text-text-low text-xs">
        {loading ? (
          <Loader2 className="size-4 animate-spin text-brand-core" />
        ) : (
          <Boxes className="size-4" />
        )}
        <span>
          {total} compatible {category}s
        </span>
      </div>
      <span className="font-mono text-text-low text-xs tabular-nums">
        PAGE {page} / {totalPages}
      </span>
    </div>
  );
}

function FilterFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-line-soft/30 border-b pb-1">
      <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-text-low">
        {label}
      </span>
      <span
        className="truncate text-right font-mono text-text-high text-xs uppercase"
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function Metric({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-text-low text-xs tabular-nums">
      {icon}
      {value}
    </span>
  );
}

function LoadingRows() {
  return (
    <>
      {LOADING_ROW_KEYS.map((key) => (
        <div key={key} className="h-24 animate-pulse border border-line-soft/15 bg-surface-panel" />
      ))}
    </>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-2 border border-line-soft/15 bg-surface-panel/60 text-center">
      <Package className="size-8 text-text-low" />
      <p className="font-heading text-text-high text-sm uppercase tracking-[0.18em]">{title}</p>
      <p className="max-w-md text-sm text-text-low [text-wrap:pretty]">{body}</p>
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function formatCompact(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function entriesForManifestCategory(
  manifest: Manifest,
  category: ManifestArtifactCategory,
): ManifestEntry[] {
  if (category === "mods") return manifest.mods;
  if (category === "resourcepacks") return manifest.resourcepacks;
  return manifest.shaderpacks.filter((entry) => !entry.filename.endsWith(".txt"));
}

function manifestEditorRows(
  currentEntries: ManifestEntry[],
  sourceEntries: ManifestEntry[],
): ManifestEditorRowData[] {
  const currentByFilename = new Map(currentEntries.map((entry) => [entry.filename, entry]));
  const rows = currentEntries.map((entry) => ({ entry, deletedFromManifest: false }));
  for (const entry of sourceEntries) {
    if (!currentByFilename.has(entry.filename)) {
      rows.push({ entry, deletedFromManifest: true });
    }
  }
  return rows.sort((left, right) => {
    if (left.deletedFromManifest !== right.deletedFromManifest) {
      return left.deletedFromManifest ? -1 : 1;
    }
    return left.entry.filename.localeCompare(right.entry.filename);
  });
}

function filterManifestEditorRows(rows: ManifestEditorRowData[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter(({ entry, deletedFromManifest }) =>
    [
      entry.filename,
      entry.id,
      entry.source,
      entry.side,
      entry.repoPath ?? "",
      entry.projectId ?? "",
      deletedFromManifest ? "removed deleted" : "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}
