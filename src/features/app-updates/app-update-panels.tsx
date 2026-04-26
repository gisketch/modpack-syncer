import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SidebarAction } from "@/components/ui/sidebar";
import { useAppUpdate, useInstallAppUpdate } from "@/hooks/use-app-update";
import { formatError } from "@/lib/format-error";
import { cn } from "@/lib/utils";

const RELEASES_URL = "https://github.com/gisketch/modpack-syncer/releases/latest";

export function AppUpdateWarmup() {
  useAppUpdate();
  return null;
}

export function SidebarUpdatePanel({ currentVersion }: { currentVersion?: string | null }) {
  const { canInstall, isWindows, updateQuery } = useAppUpdate();
  const update = updateQuery.data ?? null;
  const install = useInstallAppUpdate(update);
  const unsupportedPlatform = !isWindows && updateQuery.isError;
  const busy = updateQuery.isFetching || install.mutation.isPending;
  const label = update
    ? `UPDATE v${update.version}`
    : unsupportedPlatform
      ? "WINDOWS UPDATER ONLY"
      : updateQuery.isError
        ? "UPDATE CHECK FAILED"
        : updateQuery.isFetching
          ? "CHECKING UPDATES"
          : "UP TO DATE";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-text-low">
        <span>:: v{currentVersion ?? "..."}</span>
        {update ? <span className="text-brand-core">NEW</span> : null}
      </div>
      <SidebarAction
        onClick={() =>
          void handleSidebarAction({ update: !!update, canInstall, install, updateQuery })
        }
        disabled={busy}
        className={cn(
          "min-h-10 justify-start text-[10px]",
          update && "border-brand-core/35 text-brand-core shadow-[0_0_18px_rgba(80,220,170,0.14)]",
        )}
      >
        {install.mutation.isPending || updateQuery.isFetching ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : update ? (
          <Download className="size-3.5" />
        ) : updateQuery.isError ? (
          <AlertTriangle className="size-3.5" />
        ) : (
          <CheckCircle2 className="size-3.5" />
        )}
        <span className="truncate">{label}</span>
      </SidebarAction>
      {install.progress ? (
        <div className="h-1.5 overflow-hidden bg-surface-sunken">
          <div
            className="h-full bg-brand-core transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(install.progress.percent ?? 8, 8)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function AppUpdateSettingsPanel({ currentVersion }: { currentVersion?: string | null }) {
  const { canInstall, isWindows, updateQuery } = useAppUpdate();
  const update = updateQuery.data ?? null;
  const install = useInstallAppUpdate(update);
  const unsupportedPlatform = !isWindows && updateQuery.isError;
  const busy = updateQuery.isFetching || install.mutation.isPending;

  return (
    <div className="grid gap-4 border border-line-soft/20 bg-surface-sunken/60 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <UpdateFact label="CURRENT" value={`v${currentVersion ?? "..."}`} />
        <UpdateFact label="LATEST" value={update ? `v${update.version}` : "NO UPDATE"} />
        <UpdateFact label="INSTALL" value={isWindows ? "WINDOWS" : "CHECK ONLY"} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-text-low">
          <p className="text-text-high">
            {updateQuery.isFetching
              ? "Checking GitHub releases latest.json..."
              : update
                ? `New app version available: v${update.version}`
                : unsupportedPlatform
                  ? "Latest updater metadata is Windows-only; Linux has nothing to install."
                  : updateQuery.isError
                    ? "Update check failed."
                    : "App is up to date."}
          </p>
          <p className="truncate font-mono text-[10px] text-text-low">{RELEASES_URL}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => updateQuery.refetch()} disabled={busy}>
            {updateQuery.isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            CHECK UPDATE
          </Button>
          {update && canInstall ? (
            <Button size="sm" onClick={() => install.mutation.mutate()} disabled={busy}>
              {install.mutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              DOWNLOAD UPDATE
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => void openReleases()}>
              <ExternalLink className="size-3.5" />
              VIEW RELEASES
            </Button>
          )}
        </div>
      </div>
      {install.progress ? (
        <div className="grid gap-2">
          <div className="flex justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-text-low">
            <span>{install.progress.phase}</span>
            <span className="tabular-nums">{install.progress.percent ?? 0}%</span>
          </div>
          <div className="h-2 overflow-hidden bg-surface-base">
            <div
              className="h-full bg-brand-core transition-[width] duration-200 ease-out"
              style={{ width: `${Math.max(install.progress.percent ?? 8, 8)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UpdateFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line-soft/20 bg-surface-panel px-3 py-2">
      <p className="cp-tactical-label text-[10px] text-text-low">{label}</p>
      <p className="truncate font-mono text-xs text-text-high">{value}</p>
    </div>
  );
}

async function handleSidebarAction({
  update,
  canInstall,
  install,
  updateQuery,
}: {
  update: boolean;
  canInstall: boolean;
  install: ReturnType<typeof useInstallAppUpdate>;
  updateQuery: ReturnType<typeof useAppUpdate>["updateQuery"];
}) {
  if (!update) {
    await updateQuery.refetch();
    return;
  }
  if (canInstall) {
    install.mutation.mutate();
    return;
  }
  await openReleases();
}

async function openReleases() {
  try {
    await openUrl(RELEASES_URL);
  } catch (error) {
    toast.error("Open releases failed", { description: formatError(error) });
  }
}
