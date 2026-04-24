import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Loader2, Package, Settings } from "lucide-react";
import { TitleBar } from "@/components/title-bar";
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
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-[--surface-base] text-[--text-high]">
        <TitleBar />
        <RootGate />
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

function RootGate() {
  const packs = useQuery({
    queryKey: ["packs"],
    queryFn: () => tauri.listPacks(),
  });

  if (packs.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[--text-low]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!packs.data || packs.data.length === 0) {
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
  const packs = useQuery({
    queryKey: ["packs"],
    queryFn: () => tauri.listPacks(),
  });

  const onPacks = view.kind === "packs" || view.kind === "pack";

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar>
        <SidebarHeader>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
              :: NAVIGATION
            </span>
            <span className="font-heading text-sm font-bold uppercase tracking-wider text-brand-core">
              MODSYNC
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
        </SidebarContent>
        <SidebarFooter>
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">:: v0.1.0</span>
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
