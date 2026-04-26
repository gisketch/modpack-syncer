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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatError } from "@/lib/format-error";
import {
  type ManifestArtifactCategory,
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

export function ModpackBuilderPage({ packId, onBack }: ModpackBuilderPageProps) {
  const qc = useQueryClient();
  const adminMode = useAppStore((state) => state.adminModeByPack[packId] ?? false);
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
  const search = useQuery({
    queryKey: ["modrinth-builder-search", packId, category, debouncedSearch, page, side, sort],
    queryFn: () =>
      tauri.searchModrinthProjects(packId, category, debouncedSearch, page, side, sort),
    enabled: !!manifest.data,
    staleTime: 60_000,
    retry: 1,
  });
  const add = useMutation({
    mutationFn: (payload: { projectId: string; versionId: string; side: Side }) =>
      tauri.addModrinthMod(packId, category, payload.projectId, payload.versionId, payload.side),
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
        value={category}
        onValueChange={(value) => {
          const next = value as ManifestArtifactCategory;
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
      </Tabs>

      <InstallProjectDialog
        open={!!installTarget}
        packId={packId}
        category={category}
        hit={installTarget}
        pending={add.isPending}
        onClose={() => setInstallTarget(null)}
        onInstall={(versionId, selectedSide) => {
          if (!installTarget) return;
          add.mutate(
            { projectId: installTarget.projectId, versionId, side: selectedSide },
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
  onInstall: (versionId: string, side: Side) => void;
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
  const selectedVersion = versions.data?.find((version) => version.id === selectedVersionId);

  useEffect(() => {
    if (!open || !hit) return;
    setSelectedSide(hit.trackedSide ?? hit.suggestedSide);
    setSelectedVersionId("");
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
        </DialogBody>
        <DialogFooter className="px-6 py-4 sm:justify-between">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            CANCEL
          </Button>
          <Button
            onClick={() => selectedVersionId && onInstall(selectedVersionId, selectedSide)}
            disabled={!selectedVersionId || versions.isLoading || versions.isError || pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {hit?.alreadyTracked ? "CHANGE VERSION" : "INSTALL"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
