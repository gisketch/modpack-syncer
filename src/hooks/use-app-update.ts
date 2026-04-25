import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platform } from "@tauri-apps/plugin-os";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useState } from "react";
import { toast } from "sonner";
import { formatError } from "@/lib/format-error";

type AppPlatform = ReturnType<typeof platform>;

export type AppUpdateProgress = {
  phase: "downloading" | "installing";
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
};

export function useAppPlatform() {
  return useQuery({
    queryKey: ["app-platform"],
    queryFn: () => Promise.resolve(platform() as AppPlatform),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useAppUpdate() {
  const platformQuery = useAppPlatform();
  const isWindows = platformQuery.data === "windows";
  const canInstall = isWindows;
  const updateQuery = useQuery({
    queryKey: ["app-update"],
    queryFn: async () => {
      if (!platformQuery.data) {
        return null;
      }
      return check();
    },
    enabled: !!platformQuery.data,
    retry: false,
    staleTime: 300_000,
  });

  return {
    canInstall,
    isWindows,
    platformQuery,
    updateQuery,
  };
}

export function useInstallAppUpdate(update: Update | null) {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<AppUpdateProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!update) {
        throw new Error("No update available");
      }

      let downloadedBytes = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started": {
            const totalBytes = event.data.contentLength ?? null;
            setProgress({
              phase: "downloading",
              downloadedBytes: 0,
              totalBytes,
              percent: totalBytes ? 0 : null,
            });
            break;
          }
          case "Progress": {
            downloadedBytes += event.data.chunkLength;
            setProgress((current) => {
              const totalBytes = current?.totalBytes ?? null;
              return {
                phase: "downloading",
                downloadedBytes,
                totalBytes,
                percent: totalBytes
                  ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
                  : null,
              };
            });
            break;
          }
          case "Finished": {
            setProgress((current) => ({
              phase: "installing",
              downloadedBytes: current?.downloadedBytes ?? downloadedBytes,
              totalBytes: current?.totalBytes ?? null,
              percent: 100,
            }));
            break;
          }
        }
      });
    },
    onSuccess: async () => {
      toast.success("Update ready", {
        description: "Windows installer starting now.",
      });
      await qc.invalidateQueries({ queryKey: ["app-update"] });
    },
    onError: (error) => {
      setProgress(null);
      toast.error("App update failed", { description: formatError(error) });
    },
  });

  return {
    progress,
    mutation,
  };
}
