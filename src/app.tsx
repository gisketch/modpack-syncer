import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Download, Loader2, Package, Settings } from "lucide-react";
import { TitleBar } from "@/components/title-bar";
import {
  Sidebar,
  SidebarAction,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarItem,
  SidebarItemIcon,
  SidebarSubItem,
  SidebarSubmenu,
} from "@/components/ui/sidebar";
import { useAppVersion } from "@/hooks/use-app-version";
import { useAppUpdate, useInstallAppUpdate } from "@/hooks/use-app-update";
import { Toaster } from "@/components/ui/sonner";
import { tauri } from "@/lib/tauri";
import { HomeRoute } from "@/routes/home";
import { OnboardingRoute } from "@/routes/onboarding";
import { PackDetailRoute } from "@/routes/pack-detail";
import { SettingsRoute } from "@/routes/settings";
import { useNav } from "@/stores/nav-store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppUpdateBootstrap />
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-[--surface-base] text-[--text-high]">
        <TitleBar />
        <RootGate />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

function AppUpdateBootstrap() {
  useAppUpdate();
  return null;
}

function RootGate() {
  const packs = useQuery({
    queryKey: ["packs"],
    queryFn: () => tauri.listPacks(),
  });
  const appStorage = useQuery({
    queryKey: ["app-storage"],
    queryFn: () => tauri.getAppStorageSettings(),
  });
  const managedJava = useQuery({
    queryKey: ["managed-java", 21],
    queryFn: () => tauri.hasManagedJava(21),
    retry: false,
  });
  const prismSettings = useQuery({
    queryKey: ["prism-settings"],
    queryFn: () => tauri.getPrismSettings(),
    retry: false,
  });

  const setupReady =
    !!appStorage.data?.confirmed &&
    !!managedJava.data &&
    !!prismSettings.data?.binaryPath &&
    !!prismSettings.data?.dataDir &&
    !!prismSettings.data?.offlineUsername?.trim();

  if (packs.isLoading || appStorage.isLoading || managedJava.isLoading || prismSettings.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[--text-low]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if ((!packs.data || packs.data.length === 0) && !setupReady) {
    return (
      <main className="flex-1 overflow-auto">
        <OnboardingRoute />
      </main>
    );
  }
  return <Shell />;
}

function Shell() {
  const view = useNav((s) => s.view);
  const go = useNav((s) => s.go);
  const appVersion = useAppVersion();
  const appUpdate = useAppUpdate();
  const installAppUpdate = useInstallAppUpdate(appUpdate.updateQuery.data ?? null);
  const appIcon = "/icon32x32.png";
  const prismSettings = useQuery({
    queryKey: ["prism-settings"],
    queryFn: () => tauri.getPrismSettings(),
    retry: false,
  });
  const packs = useQuery({
    queryKey: ["packs"],
    queryFn: () => tauri.listPacks(),
  });
  const sidebarUsername = prismSettings.data?.offlineUsername?.trim() || "UNKNOWN USER";

  const onPacks = view.kind === "packs" || view.kind === "pack";
  const updateProgressLabel = installAppUpdate.progress?.percent
    ? `${installAppUpdate.progress.percent}%`
    : installAppUpdate.progress?.phase === "installing"
      ? "INSTALLING"
      : "UPDATING";

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3">
            <img
              src={appIcon}
              alt="gisketch//s_modpack_syncer"
              className="h-9 w-9 rounded-md object-cover outline outline-1 outline-black/10 shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
                :: NAVIGATION
              </span>
              <span className="truncate font-heading text-sm font-bold tracking-[0.14em] text-brand-core">
                {sidebarUsername}
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarItem
              href="#"
              active={onPacks}
              onClick={(e) => {
                e.preventDefault();
                go({ kind: "packs" });
              }}
            >
              <SidebarItemIcon>
                <Package className="size-4" />
              </SidebarItemIcon>
              PACKS
            </SidebarItem>
            {packs.data && packs.data.length > 0 && (
              <SidebarSubmenu>
                {packs.data.map((pack) => (
                  <SidebarSubItem
                    key={pack.id}
                    href="#"
                    active={view.kind === "pack" && view.id === pack.id}
                    onClick={(e) => {
                      e.preventDefault();
                      go({ kind: "pack", id: pack.id });
                    }}
                  >
                    {pack.id}
                  </SidebarSubItem>
                ))}
              </SidebarSubmenu>
            )}
          </SidebarGroup>
          <SidebarItem
            href="#"
            active={view.kind === "settings"}
            onClick={(e) => {
              e.preventDefault();
              go({ kind: "settings" });
            }}
          >
            <SidebarItemIcon>
              <Settings className="size-4" />
            </SidebarItemIcon>
            SETTINGS
          </SidebarItem>
        </SidebarContent>
        <SidebarFooter>
          {appUpdate.canInstall && appUpdate.updateQuery.data ? (
            <SidebarAction
              onClick={() => installAppUpdate.mutation.mutate()}
              disabled={installAppUpdate.mutation.isPending}
              className="min-h-10 active:scale-[0.96] transition-transform"
            >
              {installAppUpdate.mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              <span className="tabular-nums">
                {installAppUpdate.mutation.isPending ? updateProgressLabel : `UPDATE NOW v${appUpdate.updateQuery.data.version}`}
              </span>
            </SidebarAction>
          ) : null}
          <span className="tabular-nums text-[10px] uppercase tracking-[0.18em] text-text-low">
            :: v{appVersion.data ?? "..."}
          </span>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 overflow-auto scrollbar-tactical">
        {view.kind === "packs" && <HomeRoute />}
        {view.kind === "pack" && <PackDetailRoute packId={view.id} />}
        {view.kind === "settings" && <SettingsRoute />}
        {view.kind === "onboarding" && <OnboardingRoute openedFromSettings />}
      </main>
    </div>
  );
}
