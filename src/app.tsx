import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Loader2, Package, Settings } from "lucide-react";
import { useState } from "react";
import { Sidebar, type SidebarItem } from "@/components/sidebar";
import { TitleBar } from "@/components/title-bar";
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
  const [active, setActive] = useState("packs");

  const items: SidebarItem[] = [
    { id: "packs", label: "PACKS", icon: Package },
    { id: "settings", label: "SETTINGS", icon: Settings },
  ];

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar
        items={items}
        active={active}
        onSelect={setActive}
        footer={<span className="cp-tactical-label text-[--text-low] text-[10px]">:: v0.1.0</span>}
      />
      <main className="flex-1 overflow-auto scrollbar-tactical">
        {active === "packs" && <HomeRoute />}
        {active === "settings" && <SettingsRoute />}
      </main>
    </div>
  );
}
