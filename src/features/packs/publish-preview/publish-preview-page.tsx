import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FolderGit2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Textarea } from "@/components/ui/textarea";
import {
  type PublishAction,
  type PublishCategory,
  type PublishScanReport,
  tauri,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

type PublishPreviewPageProps = {
  packId: string;
  onClose: () => void;
  pending: boolean;
  report: PublishScanReport | null;
  publishing: boolean;
  publishLogs: string[];
  onPublish: (message: string, version: string) => void;
};

export function PublishPreviewPage({
  packId,
  onClose,
  pending,
  report,
  publishing,
  publishLogs,
  onPublish,
}: PublishPreviewPageProps) {
  const counts = summarizePublishReport(report);
  const changedItems = report?.items.filter((item) => item.action !== "unchanged") ?? [];
  const hasChanges = changedItems.length > 0;
  const publishTabs = buildPublishTabs(changedItems);
  const defaultTab = publishTabs.find((tab) => tab.count > 0)?.id ?? publishTabs[0]?.id ?? "mods";
  const publishVersion = useQuery({
    queryKey: ["suggest-publish-version", packId],
    queryFn: () => tauri.suggestPublishVersion(packId),
    retry: false,
  });
  const [commitTitle, setCommitTitle] = useState("Publish instance changes");
  const [commitDescription, setCommitDescription] = useState("");

  useEffect(() => {
    if (!publishVersion.data) return;
    setCommitTitle(`Update ${publishVersion.data}`);
  }, [publishVersion.data]);

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
              <CardTitle>CHANGES</CardTitle>
              <CardDescription>
                Only added, updated, removed entries shown. Grouped by publish area.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasChanges ? (
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
                      <Card className="mb-4">
                        <CardContent className="flex items-center justify-between gap-3 p-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
                              {tab.label}
                            </span>
                            <span className="text-xs text-text-low [text-wrap:pretty]">
                              {tab.description}
                            </span>
                          </div>
                          <div className="text-right font-mono text-xs tabular-nums text-text-low">
                            {tab.count} {tab.count === 1 ? "change" : "changes"}
                          </div>
                        </CardContent>
                      </Card>
                      {tab.items.length > 0 ? (
                        <ScrollArea className="h-[calc(100vh-27rem)]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>CATEGORY</TableHead>
                                <TableHead>PATH</TableHead>
                                <TableHead>ACTION</TableHead>
                                <TableHead>SOURCE</TableHead>
                                <TableHead className="text-right">SIZE</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tab.items.map((item) => (
                                <TableRow
                                  key={`${tab.id}:${item.category}:${item.relativePath}:${item.action}`}
                                >
                                  <TableCell>
                                    <Badge variant="outline">
                                      {labelCategory(item.category, item.relativePath)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-[10px] text-text-low">
                                    {item.relativePath}
                                  </TableCell>
                                  <TableCell>
                                    <PublishActionChip action={item.action} />
                                  </TableCell>
                                  <TableCell className="text-xs text-text-low">
                                    {item.source ?? "instance-local"}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs text-text-low tabular-nums">
                                    {typeof item.size === "number" ? formatBytes(item.size) : "--"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      ) : (
                        <Card>
                          <CardContent className="px-4 py-8 text-center text-sm text-text-low">
                            No changed files in {tab.label.toLowerCase()}.
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <p className="text-sm text-text-low">No changed files to publish.</p>
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
  items: PublishScanReport["items"];
  count: number;
};

function buildPublishTabs(items: PublishScanReport["items"]): PublishTabDefinition[] {
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

function summarizePublishReport(report: PublishScanReport | null) {
  return {
    add: report?.items.filter((item) => item.action === "add").length ?? 0,
    update: report?.items.filter((item) => item.action === "update").length ?? 0,
    remove: report?.items.filter((item) => item.action === "remove").length ?? 0,
    unchanged: report?.items.filter((item) => item.action === "unchanged").length ?? 0,
  };
}

function buildCommitMessage(title: string, description: string) {
  const cleanTitle = title.trim() || "Publish instance changes";
  const cleanDescription = description.trim();
  return cleanDescription ? `${cleanTitle}\n\n${cleanDescription}` : cleanTitle;
}

function labelCategory(category: PublishCategory, relativePath?: string) {
  if (category === "root" && relativePath === "options.txt") {
    return "OPTIONS";
  }
  if (category === "shader-settings") {
    return "SHADER SETTINGS";
  }
  if (category === "option-presets") {
    return "PRESETS";
  }
  if (category === "root") {
    return "ROOT";
  }
  return category.toUpperCase();
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
