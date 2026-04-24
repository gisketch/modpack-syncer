import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tauri } from "@/lib/tauri";

export function HomeRoute() {
  const greet = useQuery({
    queryKey: ["greet"],
    queryFn: () => tauri.greet("gisketch"),
  });

  return (
    <div className="flex h-full flex-col p-8 gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">modsync</h1>
        <p className="text-sm opacity-70">Minecraft modpack syncer + Prism launcher wrapper</p>
      </header>

      <section className="rounded-lg border border-[--color-muted] p-6">
        <h2 className="text-lg font-medium mb-2">Backend status</h2>
        <p className="text-sm opacity-80 font-mono">
          {greet.isLoading ? "…" : (greet.data ?? "no response")}
        </p>
      </section>

      <section className="flex gap-3">
        <Button>
          <Play className="w-4 h-4" /> Launch (placeholder)
        </Button>
        <Button variant="secondary">Sync</Button>
        <Button variant="outline">Add pack</Button>
      </section>
    </div>
  );
}
