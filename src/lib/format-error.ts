export function formatError(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyE = e as { kind?: string; message?: string };
    if (anyE.kind && anyE.message) return `${anyE.kind}: ${anyE.message}`;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
