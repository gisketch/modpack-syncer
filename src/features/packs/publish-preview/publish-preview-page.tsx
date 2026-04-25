import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderGit2, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardStatus,
  CardTitle,
  CardWindowBar,
  CardWindowTab,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationControls,
  PaginationIndicator,
  PaginationInfo,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type ManifestEntry,
  type PublishAction,
  type PublishCategory,
  type PublishScanItem,
  type PublishScanReport,
  tauri,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

const PUBLISH_PAGE_SIZE = 15;

type PublishPreviewPageProps = {
  packId: string;
  onClose: () => void;
  pending: boolean;
  report: PublishScanReport | null;
  publishing: boolean;
  publishLogs: string[];
  ignorePatterns: string[];
  onIgnorePatternsChange: (patterns: string[]) => void;
  onPublish: (message: string, version: string) => void;
};

export function PublishPreviewPage({
  packId,
  onClose,
  pending,
  report,
  publishing,
  publishLogs,
  ignorePatterns,
  onIgnorePatternsChange,
  onPublish,
}: PublishPreviewPageProps) {
  const qc = useQueryClient();
  const [showIgnored, setShowIgnored] = useState(true);
  const [showAllMods, setShowAllMods] = useState(false);
  const [tabSearch, setTabSearch] = useState<Record<string, string>>({});
  const [tabPage, setTabPage] = useState<Record<string, number>>({});
  const [pendingOptionalMods, setPendingOptionalMods] = useState<Record<string, boolean>>({});
  const publishVersion = useQuery({
    queryKey: ["suggest-publish-version", packId],
    queryFn: () => tauri.suggestPublishVersion(packId),
    retry: false,
  });
  const manifest = useQuery({
    queryKey: ["manifest", packId],
    queryFn: () => tauri.loadManifest(packId),
    retry: false,
  });
  const changedItems = report?.items.filter((item) => item.action !== "unchanged") ?? [];
  const publishableItems = changedItems.filter(
    (item) => !isPublishItemIgnored(item, ignorePatterns),
  );
  const visibleChangedItems = changedItems.filter(
    (item) => showIgnored || !isPublishItemIgnored(item, ignorePatterns),
  );
  const ignoredCount = changedItems.length - publishableItems.length;
  const counts = summarizePublishItems(publishableItems);
  const hasChanges = publishableItems.length > 0;
  const visiblePublishItems = showAllMods
    ? withAllManifestMods(visibleChangedItems, manifest.data?.mods ?? [])
    : visibleChangedItems;
  const publishTabs = buildPublishTabs(visiblePublishItems);
  const defaultTab = publishTabs.find((tab) => tab.count > 0)?.id ?? publishTabs[0]?.id ?? "mods";
  const optionalByFilename = useMemo(
    () => new Map((manifest.data?.mods ?? []).map((entry) => [entry.filename, entry.optional])),
    [manifest.data?.mods],
  );
  const setModOptional = useMutation({
    mutationFn: ({ filename, optional }: { filename: string; optional: boolean }) =>
      tauri.setManifestModOptional(packId, filename, optional),
    onMutate: (variables) => {
      setPendingOptionalMods((current) => ({ ...current, [variables.filename]: true }));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["manifest", packId] });
    },
    onSettled: (_data, _error, variables) => {
      setPendingOptionalMods((current) => {
        const next = { ...current };
        delete next[variables.filename];
        return next;
      });
    },
  });
  const [commitTitle, setCommitTitle] = useState("Publish instance changes");
  const [commitDescription, setCommitDescription] = useState("");

  useEffect(() => {
    if (!publishVersion.data) return;
    setCommitTitle(`Update ${publishVersion.data}`);
  }, [publishVersion.data]);

  function addIgnorePattern(pattern: string) {
    const cleaned = normalizePublishPattern(pattern);
    if (!cleaned || cleaned.startsWith("#") || ignorePatterns.includes(cleaned)) return;
    onIgnorePatternsChange([...ignorePatterns, cleaned]);
  }

  function setItemIgnored(item: PublishScanReport["items"][number], ignored: boolean) {
    const pattern = ignorePatternForItem(item);
    if (ignored) {
      addIgnorePattern(pattern);
      return;
    }
    const nextPatterns = ignorePatterns.filter(
      (currentPattern) =>
        !publishPatternMatches(currentPattern, item) && currentPattern !== pattern,
    );
    onIgnorePatternsChange(nextPatterns);
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={publishing}>
          <ArrowLeft /> BACK
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
          :: PUBLISH PREVIEW / {packId}
        </span>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl text-text-high">Publish Preview</h1>
        <p className="text-sm text-text-low">
          {pending
            ? "Scanning linked Prism instance..."
            : report
              ? `${counts.add} add · ${counts.update} update · ${counts.remove} remove`
              : ""}
        </p>
      </header>

      {pending && (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-text-low">
            <Loader2 className="size-4 animate-spin text-brand-core" />
            <span className="text-sm">Reading instance folders</span>
          </CardContent>
        </Card>
      )}

      {report && !pending && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 p-6">
              <Input value={publishVersion.data ?? ""} placeholder="Pack version" disabled />
              <Input
                value={commitTitle}
                onChange={(event) => setCommitTitle(event.target.value)}
                placeholder="Commit title"
              />
              <Textarea
                value={commitDescription}
                onChange={(event) => setCommitDescription(event.target.value)}
                placeholder="Commit description"
                className="min-h-32"
              />
              <div className="grid grid-cols-3 gap-3 text-xs">
                <PreviewRow k="ADD" v={String(counts.add)} />
                <PreviewRow k="UPDATE" v={String(counts.update)} />
                <PreviewRow k="REMOVE" v={String(counts.remove)} />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="default"
                  onClick={() =>
                    onPublish(
                      buildCommitMessage(commitTitle, commitDescription),
                      publishVersion.data ?? "",
                    )
                  }
                  disabled={
                    publishing || !hasChanges || publishVersion.isLoading || !!publishVersion.error
                  }
                >
                  {publishing ? <Loader2 className="animate-spin" /> : <FolderGit2 />}
                  COMMIT + PUSH
                </Button>
              </div>
            </CardContent>
          </Card>

          {publishLogs.length > 0 ? (
            <Card variant="window">
              <CardWindowBar>
                <CardWindowTab>PUBLISH TERMINAL</CardWindowTab>
                <CardStatus>{publishing ? "Streaming" : "Idle"}</CardStatus>
              </CardWindowBar>
              <CardContent className="px-0 py-0">
                <ScrollArea className="h-56 px-4 py-4">
                  <div className="flex flex-col gap-2 font-mono text-xs text-text-low">
                    {publishLogs.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="justify-between bg-surface-panel-strong/40 py-2 text-[10px] uppercase tracking-[0.18em] text-text-low">
                <span>{publishing ? "Commit in progress" : "Last run complete"}</span>
                <span>{publishLogs.length} lines</span>
              </CardFooter>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <CardTitle>CHANGES</CardTitle>
                  <CardDescription>
                    Only changed entries shown unless all mods are enabled. Grouped by publish area.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-4 text-[10px] uppercase tracking-[0.18em] text-text-low">
                  <div className="flex items-center gap-2">
                    <span>SHOW ALL MODS</span>
                    <Switch checked={showAllMods} onCheckedChange={setShowAllMods} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span>SHOW IGNORED</span>
                    <Switch checked={showIgnored} onCheckedChange={setShowIgnored} />
                    <span className="font-mono tabular-nums">{ignoredCount}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {visiblePublishItems.length > 0 ? (
                <Tabs defaultValue={defaultTab} className="gap-5">
                  <TabsList className="flex-wrap gap-2">
                    {publishTabs.map((tab) => (
                      <TabsTrigger key={tab.id} value={tab.id}>
                        <span>{tab.label}</span>
                        <span className="font-mono text-[10px] tabular-nums text-text-low">
                          {tab.count}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {publishTabs.map((tab) => (
                    <TabsContent key={tab.id} value={tab.id} className="outline-none">
                      {(() => {
                        const search = tabSearch[tab.id] ?? "";
                        const filteredItems = filterPublishItems(tab.items, search);
                        const totalPages = pageCount(filteredItems.length);
                        const page = Math.min(tabPage[tab.id] ?? 1, totalPages);
                        const pagedItems = paginatePublishItems(filteredItems, page);
                        return (
                          <>
                            <Card className="mb-4">
                              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
                                    {tab.label}
                                  </span>
                                  <span className="text-xs text-text-low [text-wrap:pretty]">
                                    {tab.description}
                                  </span>
                                </div>
                                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                                  <PublishSearchBox
                                    value={search}
                                    placeholder={`SEARCH ${tab.label}`}
                                    onChange={(value) => {
                                      setTabSearch((current) => ({ ...current, [tab.id]: value }));
                                      setTabPage((current) => ({ ...current, [tab.id]: 1 }));
                                    }}
                                  />
                                  <div className="text-right font-mono text-xs tabular-nums text-text-low">
                                    {filteredItems.length} / {tab.count}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            {filteredItems.length > 0 ? (
                              <div className="space-y-3">
                                <ScrollArea>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>NAME</TableHead>
                                        <TableHead>ACTION</TableHead>
                                        {tab.id === "mods" ? <TableHead>OPTIONAL</TableHead> : null}
                                        <TableHead>SOURCE</TableHead>
                                        <TableHead className="text-right">SIZE</TableHead>
                                        <TableHead className="text-center">IGNORE</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {pagedItems.map((item) => {
                                        const ignored = isPublishItemIgnored(item, ignorePatterns);
                                        const canSetOptional =
                                          tab.id === "mods" &&
                                          optionalByFilename.has(item.relativePath);
                                        const optional =
                                          optionalByFilename.get(item.relativePath) ?? false;
                                        const optionalPending =
                                          !!pendingOptionalMods[item.relativePath];
                                        return (
                                          <TableRow
                                            key={`${tab.id}:${item.category}:${item.relativePath}:${item.action}`}
                                            className={cn(
                                              "h-8 border-l-2",
                                              publishActionRowTone(item.action),
                                              ignored && "opacity-45",
                                            )}
                                          >
                                            <TableCell className="px-3 py-1.5 align-top">
                                              <span
                                                className="block max-w-[24rem] truncate text-xs text-text-high"
                                                title={item.relativePath}
                                              >
                                                {publishDisplayName(item)}
                                              </span>
                                            </TableCell>
                                            <TableCell className="px-3 py-1.5 align-top">
                                              <PublishActionChip action={item.action} />
                                            </TableCell>
                                            {tab.id === "mods" ? (
                                              <TableCell
                                                className={cn(
                                                  "px-3 py-1.5 text-center align-middle",
                                                  canSetOptional && !publishing && !optionalPending
                                                    ? "cursor-pointer"
                                                    : "cursor-not-allowed",
                                                )}
                                                role={canSetOptional ? "button" : undefined}
                                                tabIndex={
                                                  canSetOptional && !publishing && !optionalPending
                                                    ? 0
                                                    : -1
                                                }
                                                onClick={() => {
                                                  if (
                                                    publishing ||
                                                    optionalPending ||
                                                    !canSetOptional
                                                  ) {
                                                    return;
                                                  }
                                                  setModOptional.mutate({
                                                    filename: item.relativePath,
                                                    optional: !optional,
                                                  });
                                                }}
                                                onKeyDown={(event) => {
                                                  if (
                                                    (event.key === "Enter" || event.key === " ") &&
                                                    !publishing &&
                                                    !optionalPending &&
                                                    canSetOptional
                                                  ) {
                                                    event.preventDefault();
                                                    setModOptional.mutate({
                                                      filename: item.relativePath,
                                                      optional: !optional,
                                                    });
                                                  }
                                                }}
                                              >
                                                <div className="flex items-center justify-center gap-2">
                                                  {optionalPending ? (
                                                    <Loader2 className="size-3 animate-spin text-text-low" />
                                                  ) : null}
                                                  <Checkbox
                                                    checked={optional}
                                                    disabled={
                                                      publishing ||
                                                      optionalPending ||
                                                      !canSetOptional
                                                    }
                                                    aria-label={`Optional ${item.relativePath}`}
                                                    className="pointer-events-none"
                                                  />
                                                </div>
                                              </TableCell>
                                            ) : null}
                                            <TableCell className="px-3 py-1.5 align-top text-xs text-text-low">
                                              {item.source ?? "instance-local"}
                                            </TableCell>
                                            <TableCell className="px-3 py-1.5 text-right align-top font-mono text-xs text-text-low tabular-nums">
                                              {typeof item.size === "number"
                                                ? formatBytes(item.size)
                                                : "--"}
                                            </TableCell>
                                            <TableCell
                                              className="cursor-pointer px-3 py-1.5 align-middle"
                                              role="button"
                                              tabIndex={publishing ? -1 : 0}
                                              title={ignored ? "Stop ignoring file" : "Ignore file"}
                                              onClick={() => {
                                                if (!publishing) {
                                                  setItemIgnored(item, !ignored);
                                                }
                                              }}
                                              onKeyDown={(event) => {
                                                if (
                                                  (event.key === "Enter" || event.key === " ") &&
                                                  !publishing
                                                ) {
                                                  event.preventDefault();
                                                  setItemIgnored(item, !ignored);
                                                }
                                              }}
                                            >
                                              <div className="flex items-center justify-center">
                                                <Checkbox
                                                  checked={ignored}
                                                  disabled={publishing}
                                                  aria-label={`Ignore ${item.relativePath}`}
                                                  className="pointer-events-none"
                                                />
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </ScrollArea>
                                <PublishPager
                                  page={page}
                                  totalPages={totalPages}
                                  totalItems={filteredItems.length}
                                  onPrevious={() =>
                                    setTabPage((current) => ({
                                      ...current,
                                      [tab.id]: Math.max(page - 1, 1),
                                    }))
                                  }
                                  onNext={() =>
                                    setTabPage((current) => ({
                                      ...current,
                                      [tab.id]: Math.min(page + 1, totalPages),
                                    }))
                                  }
                                />
                              </div>
                            ) : (
                              <Card>
                                <CardContent className="px-4 py-8 text-center text-sm text-text-low">
                                  No changed files in {tab.label.toLowerCase()}.
                                </CardContent>
                              </Card>
                            )}
                          </>
                        );
                      })()}
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <p className="text-sm text-text-low">
                  {showIgnored ? "No changed files to publish." : "No visible files to publish."}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

type PublishTabDefinition = {
  id:
    | "mods"
    | "shaderpacks"
    | "resourcepacks"
    | "shader-settings"
    | "presets"
    | "configs"
    | "options"
    | "others";
  label: string;
  description: string;
  items: PublishScanItem[];
  count: number;
};

function buildPublishTabs(items: PublishScanItem[]): PublishTabDefinition[] {
  const tabs: Array<
    Omit<PublishTabDefinition, "items" | "count"> & {
      match: (item: PublishScanReport["items"][number]) => boolean;
    }
  > = [
    {
      id: "mods",
      label: "MODS",
      description: "Jar artifacts tracked in manifest mods list.",
      match: (item) => item.category === "mods",
    },
    {
      id: "shaderpacks",
      label: "SHADERPACKS",
      description: "Shader archives staged for manifest shaderpacks list.",
      match: (item) => item.category === "shaderpacks",
    },
    {
      id: "resourcepacks",
      label: "RESOURCEPACKS",
      description: "Resource pack archives staged for manifest resourcepacks list.",
      match: (item) => item.category === "resourcepacks",
    },
    {
      id: "shader-settings",
      label: "SHADER SETTINGS",
      description: "Iris selector file plus shader preset .txt files alongside shaderpacks.",
      match: (item) => item.category === "shader-settings",
    },
    {
      id: "presets",
      label: "PRESETS",
      description: "Pack-owned option preset JSON files.",
      match: (item) => item.category === "option-presets",
    },
    {
      id: "configs",
      label: "CONFIGS",
      description: "Tracked config tree changes from instance config folder.",
      match: (item) => item.category === "config",
    },
    {
      id: "options",
      label: "OPTIONS",
      description: "Root options files like options.txt intended for preset sync.",
      match: (item) => item.category === "root" && item.relativePath === "options.txt",
    },
    {
      id: "others",
      label: "OTHERS",
      description: "KubeJS + remaining root-level tracked files.",
      match: (item) =>
        item.category === "kubejs" ||
        (item.category === "root" && item.relativePath !== "options.txt"),
    },
  ];

  return tabs.map((tab) => {
    const tabItems = items.filter(tab.match);
    return {
      id: tab.id,
      label: tab.label,
      description: tab.description,
      items: tabItems,
      count: tabItems.length,
    };
  });
}

function PublishSearchBox({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-text-low" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9 text-xs"
      />
    </div>
  );
}

function PublishPager({
  page,
  totalPages,
  totalItems,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <Pagination className="justify-between">
      <PaginationInfo>{totalItems} SHOWN BY FILTER</PaginationInfo>
      <PaginationControls>
        <PaginationPrevious onClick={onPrevious} disabled={page <= 1} />
        <PaginationIndicator page={page} total={totalPages} />
        <PaginationNext onClick={onNext} disabled={page >= totalPages} />
      </PaginationControls>
    </Pagination>
  );
}

function filterPublishItems(items: PublishScanItem[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) =>
    [publishDisplayName(item), item.relativePath, item.category, item.action, item.source ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

function paginatePublishItems(items: PublishScanItem[], page: number) {
  const start = (Math.max(page, 1) - 1) * PUBLISH_PAGE_SIZE;
  return items.slice(start, start + PUBLISH_PAGE_SIZE);
}

function pageCount(totalItems: number) {
  return Math.max(1, Math.ceil(totalItems / PUBLISH_PAGE_SIZE));
}

function withAllManifestMods(items: PublishScanItem[], mods: ManifestEntry[]) {
  const existing = new Set(
    items.filter((item) => item.category === "mods").map((item) => item.relativePath),
  );
  const unchangedMods = mods
    .filter((entry) => !existing.has(entry.filename))
    .map<PublishScanItem>((entry) => ({
      category: "mods",
      relativePath: entry.filename,
      size: entry.size,
      sha1: entry.sha1,
      action: "unchanged",
      source: entry.source,
    }));
  return [...items, ...unchangedMods];
}

function publishDisplayName(item: PublishScanReport["items"][number]) {
  if (isArtifactCategory(item.category)) {
    return (
      item.relativePath
        .split("/")
        .pop()
        ?.replace(/\.(jar|zip)$/i, "") ?? item.relativePath
    );
  }
  return item.relativePath;
}

function isArtifactCategory(category: PublishCategory) {
  return category === "mods" || category === "resourcepacks" || category === "shaderpacks";
}

function PublishActionChip({ action }: { action: PublishAction }) {
  const text =
    action === "add"
      ? "text-brand-core"
      : action === "update"
        ? "text-signal-warn"
        : action === "remove"
          ? "text-signal-alert"
          : "text-text-low";

  return <span className={cn("text-[10px] uppercase tracking-[0.18em]", text)}>{action}</span>;
}

function summarizePublishItems(items: PublishScanReport["items"]) {
  return {
    add: items.filter((item) => item.action === "add").length,
    update: items.filter((item) => item.action === "update").length,
    remove: items.filter((item) => item.action === "remove").length,
    unchanged: items.filter((item) => item.action === "unchanged").length,
  };
}

function publishActionRowTone(action: PublishAction) {
  if (action === "add") return "border-brand-core/50";
  if (action === "update") return "border-signal-warn/50";
  if (action === "remove") return "border-signal-alert/50";
  return "border-line-soft/30";
}

function buildCommitMessage(title: string, description: string) {
  const cleanTitle = title.trim() || "Publish instance changes";
  const cleanDescription = description.trim();
  return cleanDescription ? `${cleanTitle}\n\n${cleanDescription}` : cleanTitle;
}

function ignorePatternForItem(item: PublishScanReport["items"][number]) {
  const path = normalizePublishPattern(item.relativePath);
  if (item.category === "mods") return `mods/${path}`;
  if (item.category === "resourcepacks") return `resourcepacks/${path}`;
  if (item.category === "shaderpacks") return `shaderpacks/${path}`;
  if (item.category === "shader-settings") {
    return path === "iris.properties" ? `config/${path}` : `shaderpacks/${path}`;
  }
  if (item.category === "option-presets") {
    return path.startsWith("presets/") ? path : `presets/${path}`;
  }
  if (item.category === "config") return `config/${path}`;
  if (item.category === "kubejs") return `kubejs/${path}`;
  return path;
}

function isPublishItemIgnored(item: PublishScanReport["items"][number], patterns: string[]) {
  return patterns.some((pattern) => publishPatternMatches(pattern, item));
}

function publishPatternMatches(pattern: string, item: PublishScanReport["items"][number]) {
  const normalizedPattern = normalizePublishPattern(pattern);
  if (!normalizedPattern || normalizedPattern.startsWith("#")) return false;
  const path = normalizePublishPattern(item.relativePath);
  const basename = path.split("/").pop() ?? path;
  const candidates = [path, basename, ignorePatternForItem(item)];

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizePublishPattern(candidate);
    if (normalizedPattern.endsWith("/")) {
      const prefix = normalizedPattern.slice(0, -1);
      return normalizedCandidate === prefix || normalizedCandidate.startsWith(`${prefix}/`);
    }
    if (normalizedPattern.includes("*") || normalizedPattern.includes("?")) {
      return wildcardMatch(normalizedPattern, normalizedCandidate);
    }
    if (normalizedPattern.includes("/")) {
      return normalizedCandidate === normalizedPattern;
    }
    return (
      normalizedCandidate === normalizedPattern ||
      normalizedCandidate.endsWith(`/${normalizedPattern}`)
    );
  });
}

function normalizePublishPattern(pattern: string) {
  const trimmed = pattern.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const directoryPattern = trimmed.endsWith("/");
  const normalized = trimmed
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");
  return directoryPattern && normalized ? `${normalized}/` : normalized;
}

function wildcardMatch(pattern: string, value: string) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
  return regex.test(value);
}

function PreviewRow({ k, v }: { k: string; v: string }) {
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
