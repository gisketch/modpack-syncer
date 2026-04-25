import { openUrl } from "@tauri-apps/plugin-opener";
import { Code2, ExternalLink, Hammer, PackageCheck } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardStatus, CardWindowBar, CardWindowTab } from "@/components/ui/card";
import { useAppVersion } from "@/hooks/use-app-version";
import { formatError } from "@/lib/format-error";

const GITHUB_URL = "https://github.com/gisketch/s_modpack_syncer";

export function AboutRoute() {
  const appVersion = useAppVersion();

  async function openGithub() {
    try {
      await openUrl(GITHUB_URL);
    } catch (error) {
      toast.error("GitHub open failed", { description: formatError(error) });
    }
  }

  return (
    <div className="relative flex min-h-full flex-col gap-6 overflow-auto p-8 scrollbar-tactical">
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-tactical-grid opacity-40" />
      <header className="relative flex flex-col gap-1">
        <span className="cp-tactical-label text-[--brand-core] text-[10px]">:: ABOUT</span>
        <h1 className="text-2xl text-[--text-high]">modsync</h1>
        <p className="max-w-2xl text-sm text-[--text-low]">
          A custom Minecraft pack syncer for one group, one launcher flow, and one source of truth.
        </p>
      </header>

      <Card variant="window" className="relative max-w-4xl">
        <CardWindowBar>
          <CardWindowTab>WHY THIS EXISTS</CardWindowTab>
          <CardStatus>v{appVersion.data ?? "..."}</CardStatus>
        </CardWindowBar>
        <CardContent className="grid gap-5 p-5 text-sm leading-7 text-text-low sm:p-6">
          <p>
            I made modsync for me and my friends so we can play custom Minecraft modpacks without
            turning setup into a whole second game. Mods, configs, shader settings, profiles, and
            pack updates live in one place. The app pulls that into Prism and keeps everyone on the
            same page.
          </p>
          <p>
            The goal is simple: this should be the one app we keep using now and later. The pack
            repo is the source of truth, modsync is the button that makes it real on everyone&apos;s
            machine.
          </p>
          <p>
            I worked hard on this because I like tweaking things until they feel right, and I wanted
            that work to make playing easier for everybody instead of becoming files, screenshots,
            and instructions scattered everywhere.
          </p>

          <div className="grid gap-3 border-line-soft/30 border-t pt-5 sm:grid-cols-3">
            <AboutFact icon={<PackageCheck className="size-4" />} label="SOURCE" value="GITHUB" />
            <AboutFact icon={<Hammer className="size-4" />} label="MADE FOR" value="FRIENDS" />
            <AboutFact icon={<Code2 className="size-4" />} label="PROJECT" value="MODSYNC" />
          </div>

          <div className="flex flex-col gap-3 border-line-soft/30 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <span className="truncate font-mono text-[11px] text-text-low">{GITHUB_URL}</span>
            <Button type="button" onClick={() => void openGithub()}>
              <Code2 className="size-4" /> GITHUB <ExternalLink className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AboutFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border border-line-soft/40 bg-surface-sunken px-4 py-3">
      <span className="flex size-8 items-center justify-center border border-brand-core/40 bg-brand-core/10 text-brand-core">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="cp-tactical-label text-[10px] text-text-low">{label}</p>
        <p className="truncate font-heading text-sm text-text-high">{value}</p>
      </div>
    </div>
  );
}
