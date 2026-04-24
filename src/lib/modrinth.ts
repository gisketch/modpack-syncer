import { useQueries } from "@tanstack/react-query";
import type { ManifestEntry } from "@/lib/tauri";

export type ModrinthProject = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  icon_url?: string | null;
};

const BASE = "https://api.modrinth.com/v2/project";
const UA = "modsync/0.1 (https://github.com/gisketch/modsync)";

async function fetchProject(id: string): Promise<ModrinthProject> {
  const res = await fetch(`${BASE}/${id}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`modrinth ${res.status}`);
  return res.json();
}

/** Fetch Modrinth metadata for every mod that has a Modrinth projectId. */
export function useModrinthProjects(mods: ManifestEntry[]) {
  const ids = Array.from(
    new Set(
      mods.filter((m) => m.source === "modrinth" && m.projectId).map((m) => m.projectId as string),
    ),
  );

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["modrinth", "project", id] as const,
      queryFn: () => fetchProject(id),
      staleTime: 1000 * 60 * 60, // 1h
      retry: 1,
    })),
  });

  const map = new Map<string, ModrinthProject>();
  for (let i = 0; i < ids.length; i++) {
    const data = results[i]?.data;
    if (data) map.set(ids[i], data);
  }
  return map;
}
