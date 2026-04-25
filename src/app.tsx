import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Info, Loader2, Package, Settings } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useRef } from "react";
import { TitleBar } from "@/components/title-bar";
import { AnimatedPage } from "@/components/ui/motion";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarItem,
  SidebarItemIcon,
  SidebarSubItem,
  SidebarSubmenu,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAppVersion } from "@/hooks/use-app-version";
import { tauri } from "@/lib/tauri";
import { AboutRoute } from "@/routes/about";
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
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-[--surface-base] text-[--text-high]">
        <TitleBar />
        <RootGate />
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

function RootGate() {
  const installDirectory = useQuery({
    queryKey: ["install-directory"],
    queryFn: () => tauri.getInstallDirectory(),
    retry: false,
  });
  const managedJava = useQuery({
    queryKey: ["managed-java", 21],
    queryFn: () => tauri.hasManagedJava(21),
    retry: false,
  });
  const prism = useQuery({
    queryKey: ["prism"],
    queryFn: () => tauri.detectPrism(),
    retry: false,
  });
  const prismSettings = useQuery({
    queryKey: ["prism-settings"],
    queryFn: () => tauri.getPrismSettings(),
    retry: false,
  });
  const loading =
    installDirectory.isLoading ||
    managedJava.isLoading ||
    prism.isLoading ||
    prismSettings.isLoading;
  const setupReady =
    !!installDirectory.data?.defaultDir &&
    !!managedJava.data &&
    !!prism.data &&
    !!prismSettings.data?.binaryPath &&
    !!prismSettings.data?.dataDir &&
    !!prismSettings.data?.offlineUsername?.trim();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[--text-low]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!setupReady) {
    return (
      <main className="flex-1 overflow-auto">
        <AnimatedPage>
          <OnboardingRoute />
        </AnimatedPage>
      </main>
    );
  }
  return <Shell />;
}

function Shell() {
  const view = useNav((s) => s.view);
  const go = useNav((s) => s.go);
  const appVersion = useAppVersion();
  const packs = useQuery({
    queryKey: ["packs"],
    queryFn: () => tauri.listPacks(),
  });
  const prismSettings = useQuery({
    queryKey: ["prism-settings"],
    queryFn: () => tauri.getPrismSettings(),
    retry: false,
  });

  const onPacks = view.kind === "packs" || view.kind === "pack";
  const sidebarName = prismSettings.data?.offlineUsername?.trim() || "MODSYNC";
  const routeKey = view.kind === "pack" ? `pack:${view.id}` : view.kind;
  const initialRouteKey = useRef(routeKey);
  const route =
    view.kind === "packs" ? (
      <HomeRoute />
    ) : view.kind === "pack" ? (
      <PackDetailRoute packId={view.id} />
    ) : view.kind === "settings" ? (
      <SettingsRoute />
    ) : view.kind === "about" ? (
      <AboutRoute />
    ) : (
      <OnboardingRoute openedFromSettings />
    );

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar>
        <SidebarHeader>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
              :: NAVIGATION
            </span>
            <span className="truncate font-heading text-sm font-bold tracking-wider text-brand-core">
              {sidebarName}
            </span>
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
          <SidebarItem
            href="#"
            active={view.kind === "about"}
            onClick={(e) => {
              e.preventDefault();
              go({ kind: "about" });
            }}
          >
            <SidebarItemIcon>
              <Info className="size-4" />
            </SidebarItemIcon>
            ABOUT
          </SidebarItem>
        </SidebarContent>
        <SidebarFooter>
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
            :: v{appVersion.data ?? "..."}
          </span>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 overflow-auto scrollbar-tactical">
        <AnimatePresence mode="wait" initial={false}>
          <AnimatedPage key={routeKey} stagger={routeKey !== initialRouteKey.current}>
            {route}
          </AnimatedPage>
        </AnimatePresence>
      </main>
    </div>
  );
}
