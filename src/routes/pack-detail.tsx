import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Globe, Loader2, Package, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatError } from "@/lib/format-error";
import { type SyncInstanceReport, tauri } from "@/lib/tauri";
import { useNav } from "@/stores/nav-store";

export function PackDetailRoute({ packId }: { packId: string }) {
  const go = useNav((s) => s.go);

  const pack = useQuery({
    queryKey: ["packs"],
    queryFn: () => tauri.listPacks(),
    select: (list) => list.find((p) => p.id === packId) ?? null,
  });

  const manifest = useQuery({
    queryKey: ["manifest", packId],
    queryFn: () => tauri.loadManifest(packId),
    retry: false,
  });

  const prism = useQuery({
    queryKey: ["prism"],
    queryFn: () => tauri.detectPrism(),
    retry: false,
  });

  const instanceName = `modsync-${packId}`;
  const [syncOpen, setSyncOpen] = useState(false);
  const [report, setReport] = useState<SyncInstanceReport | null>(null);

  const sync = useMutation({
    mutationFn: () => tauri.syncInstance(packId),
    onMutate: () => {
      setSyncOpen(true);
      setReport(null);
    },
    onSuccess: (r) => {
      setReport(r);
      toast.success("Sync complete", {
        description: `${r.instance.mods_written} mods · ${r.instance.overrides_copied} overrides`,
      });
    },
    onError: (e) => {
      setSyncOpen(false);
      toast.error("Sync failed", { description: formatError(e) });
    },
  });

  const launch = useMutation({
    mutationFn: () => tauri.launchInstance(instanceName),
    onSuccess: () => toast.success("Prism launched"),
    onError: (e) => toast.error("Launch failed", { description: formatError(e) }),
  });

  if (pack.data === null && !pack.isLoading) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertTitle>Pack not found</AlertTitle>
          <AlertDescription>The requested pack does not exist.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => go({ kind: "packs" })}>
          <ArrowLeft /> BACK
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
          :: PACK INSPECTOR
        </span>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl text-text-high">{manifest.data?.pack.name ?? packId}</h1>
          {manifest.data && (
            <div className="flex flex-wrap gap-2">
              <Badge>v{manifest.data.pack.version}</Badge>
              <Badge variant="outline">MC {manifest.data.pack.mcVersion}</Badge>
              <Badge variant="outline">
                {manifest.data.pack.loader.toUpperCase()} {manifest.data.pack.loaderVersion}
              </Badge>
              <Badge variant="outline">
                <Package className="size-3" />
                {manifest.data.mods.length} mods
              </Badge>
            </div>
          )}
          {pack.data && (
            <p className="font-mono text-[--text-low] text-xs">
              {pack.data.head_sha.slice(0, 10)} :: {pack.data.url}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => sync.mutate()}
            disabled={sync.isPending || !manifest.data || !prism.data}
          >
            {sync.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            SYNC
          </Button>
          <Button
            onClick={() => launch.mutate()}
            disabled={launch.isPending || !prism.data || sync.isPending}
          >
            {launch.isPending ? <Loader2 className="animate-spin" /> : <Play />}
            LAUNCH
          </Button>
        </div>
      </header>

      {!prism.data && !prism.isLoading && (
        <Alert variant="destructive">
          <AlertTitle>Prism Launcher not detected</AlertTitle>
          <AlertDescription>
            Install Prism Launcher before syncing or launching this pack.
          </AlertDescription>
        </Alert>
      )}

      {manifest.isError && (
        <Alert variant="destructive">
          <AlertTitle>Manifest missing</AlertTitle>
          <AlertDescription>
            No <code>manifest.json</code> found in this repo yet.
          </AlertDescription>
        </Alert>
      )}

      {report && (
        <Alert>
          <AlertTitle>Sync report</AlertTitle>
          <AlertDescription>
            Wrote {report.instance.mods_written} mods, {report.instance.overrides_copied} overrides.
            Cached {report.fetch.cached} / downloaded {report.fetch.downloaded} / total{" "}
            {report.fetch.total}.
            {report.fetch.failures.length > 0 && (
              <span className="block text-signal-alert">
                {report.fetch.failures.length} failures
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {manifest.data && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Download className="inline size-4" /> MODS
            </CardTitle>
            <CardDescription>
              {manifest.data.mods.length} entries tracked by manifest
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NAME</TableHead>
                    <TableHead>SOURCE</TableHead>
                    <TableHead>SIDE</TableHead>
                    <TableHead className="text-right">SIZE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manifest.data.mods.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.filename}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {m.source === "url" ? <Globe className="size-3" /> : null}
                          {m.source.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[--text-low] text-xs uppercase">
                        {m.side}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[--text-low] text-xs">
                        {formatBytes(m.size)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <SyncDialog
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        pending={sync.isPending}
        report={report}
      />
    </div>
  );
}

function SyncDialog({
  open,
  onClose,
  pending,
  report,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  report: SyncInstanceReport | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pending ? "SYNCING" : report ? "SYNC OK" : "SYNC"}</DialogTitle>
          <DialogDescription>
            {pending
              ? "Downloading + writing Prism instance…"
              : report
                ? `${report.instance.mods_written} mods · ${report.instance.overrides_copied} overrides`
                : ""}
          </DialogDescription>
        </DialogHeader>

        {pending && (
          <div className="flex items-center justify-center gap-3 py-6">
            <Loader2 className="size-5 animate-spin text-brand-core" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
              :: WORKING
            </span>
          </div>
        )}

        {report && !pending && (
          <div className="flex flex-col gap-2 py-4 text-xs">
            <Row k="MODS WRITTEN" v={String(report.instance.mods_written)} />
            <Row k="OVERRIDES COPIED" v={String(report.instance.overrides_copied)} />
            <Row k="CACHE HIT" v={`${report.fetch.cached} / ${report.fetch.total}`} />
            <Row k="DOWNLOADED" v={String(report.fetch.downloaded)} />
            {report.fetch.failures.length > 0 && (
              <Row k="FAILURES" v={String(report.fetch.failures.length)} alert />
            )}
            <p className="mt-2 truncate font-mono text-[10px] text-[--text-low]">
              {report.instance.instance_dir}
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            CLOSE
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, alert }: { k: string; v: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between border-line-soft/30 border-b pb-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">{k}</span>
      <span className={`font-mono text-xs ${alert ? "text-signal-alert" : "text-text-high"}`}>
        {v}
      </span>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
