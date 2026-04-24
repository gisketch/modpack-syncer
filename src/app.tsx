import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Loader2, Package, Settings } from "lucide-react";
import { useState } from "react";
import { TitleBar } from "@/components/title-bar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarItemIcon,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { tauri } from "@/lib/tauri";
import { HomeRoute } from "@/routes/home";
import { OnboardingRoute } from "@/routes/onboarding";
import { SettingsRoute } from "@/routes/settings";

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
  const [active, setActive] = useState<"packs" | "settings">("packs");

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
          <SidebarItem
            href="#"
            active={active === "packs"}
            onClick={(e) => {
              e.preventDefault();
              setActive("packs");
            }}
          >
            <SidebarItemIcon>
              <Package className="size-4" />
            </SidebarItemIcon>
            PACKS
          </SidebarItem>
          <SidebarItem
            href="#"
            active={active === "settings"}
            onClick={(e) => {
              e.preventDefault();
              setActive("settings");
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
        {active === "packs" && <HomeRoute />}
        {active === "settings" && <SettingsRoute />}
      </main>
    </div>
  );
}
