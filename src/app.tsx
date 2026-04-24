import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { TitleBar } from "@/components/title-bar";
import { tauri } from "@/lib/tauri";
import { HomeRoute } from "@/routes/home";
import { OnboardingRoute } from "@/routes/onboarding";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-[--color-bg] text-[--color-fg]">
        <TitleBar />
        <main className="flex-1 overflow-auto">
          <RootGate />
        </main>
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
      <div className="flex h-full items-center justify-center opacity-60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!packs.data || packs.data.length === 0) {
    return <OnboardingRoute />;
  }
  return <HomeRoute />;
}
