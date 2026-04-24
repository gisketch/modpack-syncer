// Minimal theme-provider stub for Tauri (dark-only). Replaces next-themes
// dependency from the cyberpunk-shadcn registry.
export function useTheme() {
  return { theme: "dark" as const, setTheme: (_t: string) => {} };
}
