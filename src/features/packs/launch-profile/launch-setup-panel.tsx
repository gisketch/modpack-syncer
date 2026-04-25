import { Download, HardDrive, MemoryStick, Package, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardStatus, CardWindowBar, CardWindowTab } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { LaunchProfile, Loader } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export type JavaInstallChoice = {
  id: string;
  major: number;
  imageType: "jre" | "jdk";
  title: string;
  detail: string;
  recommended: boolean;
};

type LaunchSetupPanelProps = {
  packName: string;
  profile: LaunchProfile;
  packSynced: boolean;
  launchRiskCount: number;
  onChange: (profile: LaunchProfile) => void;
  onBrowseJavaPath: () => void;
  onUsePrismAutoJava: () => void;
  onOpenJavaInstall: () => void;
};

export function LaunchSetupPanel({
  packName,
  profile,
  packSynced,
  launchRiskCount,
  onChange,
  onBrowseJavaPath,
  onUsePrismAutoJava,
  onOpenJavaInstall,
}: LaunchSetupPanelProps) {
  const sliderValue = [profile.maxMemoryMb];
  const packValue = packSynced ? "SYNCED" : `${launchRiskCount} RISKS`;
  const presets = [
    { label: "LOW", detail: "4 GB / safe baseline", minMemoryMb: 2048, maxMemoryMb: 4096 },
    { label: "MED", detail: "6 GB / default play", minMemoryMb: 3072, maxMemoryMb: 6144 },
    { label: "HIGH", detail: "8 GB / heavy packs", minMemoryMb: 4096, maxMemoryMb: 8192 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <CompactLaunchStat
            icon={<Package className="size-3.5" />}
            label="PACK"
            value={packValue}
            detail={packSynced ? packName : "Sync recommended"}
            tone={packSynced ? "ok" : "warn"}
          />
          <CompactLaunchStat
            icon={<HardDrive className="size-3.5" />}
            label="JAVA"
            value={profile.autoJava ? "AUTO" : profile.javaPath ? "CUSTOM" : "GLOBAL"}
            detail={
              profile.autoJava ? "Prism auto Java" : (profile.javaPath ?? "Prism global Java")
            }
            tone={profile.autoJava || profile.javaPath ? "ok" : "warn"}
          />
          <CompactLaunchStat
            icon={<MemoryStick className="size-3.5" />}
            label="RAM"
            value={`${Math.round(profile.maxMemoryMb / 1024)} GB`}
            detail={`Min ${profile.minMemoryMb} MiB`}
            tone="ok"
          />
        </CardContent>
      </Card>

      {!packSynced ? (
        <div className="border border-signal-alert/35 bg-signal-alert/8 px-4 py-3 text-sm text-text-low">
          <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-signal-alert">
            Pack not fully synced
          </span>
          <p className="mt-1 text-xs">
            {launchRiskCount} mod{launchRiskCount === 1 ? " is" : "s are"} missing or outdated.
            Launching may break pack.
          </p>
        </div>
      ) : null}

      <Card variant="window">
        <CardWindowBar>
          <CardWindowTab>LAUNCH PROFILE</CardWindowTab>
          <CardStatus>{profile.autoJava ? "Auto Java" : "Manual Java"}</CardStatus>
        </CardWindowBar>
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[16rem_minmax(0,1.1fr)_minmax(20rem,0.95fr)] xl:gap-6 xl:p-6">
          <div className="flex flex-col gap-3 border border-line-soft/20 bg-surface-sunken/60 p-4">
            <div>
              <Label>PRESETS</Label>
              <p className="mt-1 text-xs text-text-low">
                Quick memory profiles for common pack sizes.
              </p>
            </div>
            <div className="grid gap-2">
              {presets.map((preset) => {
                const active =
                  profile.maxMemoryMb === preset.maxMemoryMb &&
                  profile.minMemoryMb === preset.minMemoryMb;

                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...profile,
                        minMemoryMb: preset.minMemoryMb,
                        maxMemoryMb: preset.maxMemoryMb,
                      })
                    }
                    className={cn(
                      "flex items-center justify-between border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-brand-core bg-brand-core/10 text-brand-core"
                        : "border-line-soft/20 bg-surface/70 text-text-high hover:border-brand-core/40 hover:bg-brand-core/5",
                    )}
                  >
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em]">{preset.label}</p>
                      <p className="text-[11px] text-text-low">{preset.detail}</p>
                    </div>
                    <span className="font-mono text-xs">
                      {Math.round(preset.maxMemoryMb / 1024)}G
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <Label>MAX RAM</Label>
                <span className="font-mono text-xs text-text-low">{profile.maxMemoryMb} MiB</span>
              </div>
              <Slider
                value={sliderValue}
                min={2048}
                max={16384}
                step={256}
                onValueChange={(value) => {
                  const nextValue = Array.isArray(value) ? value[0] : value;
                  const maxMemoryMb = nextValue ?? profile.maxMemoryMb;
                  onChange({
                    ...profile,
                    maxMemoryMb,
                    minMemoryMb: Math.min(profile.minMemoryMb, maxMemoryMb),
                  });
                }}
              >
                <SliderControl>
                  <SliderTrack>
                    <SliderIndicator />
                  </SliderTrack>
                  <SliderThumb />
                </SliderControl>
              </Slider>
              <p className="text-xs text-text-low">
                Launcher writes Prism `MaxMemAlloc` + `MinMemAlloc` overrides.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Label htmlFor="extra-jvm-args">EXTRA JVM ARGS</Label>
              <Textarea
                id="extra-jvm-args"
                value={profile.extraJvmArgs}
                onChange={(event) => onChange({ ...profile, extraJvmArgs: event.target.value })}
                placeholder="-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions"
                className="min-h-24 font-mono text-xs"
              />
              <p className="text-xs text-text-low">
                Do not put `-Xmx` / `-Xms` here. Memory slider owns those.
              </p>
            </div>

            <div className="flex min-h-10 items-center justify-between gap-4 border border-line-soft/20 bg-surface-sunken/60 px-4 py-3">
              <Label htmlFor="show-console">SHOW CONSOLE</Label>
              <Switch
                checked={profile.showConsole}
                onCheckedChange={(checked) => onChange({ ...profile, showConsole: checked })}
                aria-label="Show modsync console window on launch"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 border border-line-soft/20 bg-surface-sunken/60 p-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="java-path">JAVA PATH</Label>
              <Input
                id="java-path"
                value={profile.javaPath ?? ""}
                onChange={(event) =>
                  onChange({
                    ...profile,
                    autoJava: false,
                    javaPath: event.target.value,
                  })
                }
                placeholder="/path/to/java or javaw.exe"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onBrowseJavaPath}>
                  <Settings2 className="size-4" /> BROWSE JAVA
                </Button>
                <Button variant="outline" onClick={onUsePrismAutoJava}>
                  <HardDrive className="size-4" /> USE PRISM AUTO
                </Button>
                <Button variant="outline" onClick={onOpenJavaInstall}>
                  <Download className="size-4" /> INSTALL JAVA
                </Button>
              </div>
              <p className="text-xs text-text-low">
                Prism auto mode resolves managed compatible Java. Install dialog downloads Temurin
                runtime into modsync app data.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <LaunchPanelRow k="MIN RAM" v={`${profile.minMemoryMb} MiB`} />
              <LaunchPanelRow k="AUTO JAVA" v={profile.autoJava ? "ON" : "OFF"} />
              <LaunchPanelRow k="JVM ARGS" v={profile.extraJvmArgs.trim() ? "CUSTOM" : "DEFAULT"} />
              <LaunchPanelRow k="PACK" v={packSynced ? "SYNCED" : "CHECK SYNC"} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function formatByteCount(value: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return unitIndex === 0
    ? `${Math.round(size)} ${units[unitIndex]}`
    : `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function getJavaInstallChoices(mcVersion?: string, loader?: Loader): JavaInstallChoice[] {
  const requiredMajor = mcVersion?.startsWith("1.21") ? 21 : 17;
  const loaderLabel = loader ? loader.toUpperCase() : "PACK";

  return [
    {
      id: `temurin-${requiredMajor}-jre`,
      major: requiredMajor,
      imageType: "jre",
      title: `Temurin ${requiredMajor} JRE`,
      detail: `${loaderLabel} ${mcVersion ?? "runtime"} recommended pick. Smallest install for play.`,
      recommended: true,
    },
    {
      id: `temurin-${requiredMajor}-jdk`,
      major: requiredMajor,
      imageType: "jdk",
      title: `Temurin ${requiredMajor} JDK`,
      detail: `Same Java ${requiredMajor}, but with full JDK tools bundled.`,
      recommended: false,
    },
    {
      id: "temurin-17-jre",
      major: 17,
      imageType: "jre",
      title: "Temurin 17 JRE",
      detail:
        requiredMajor === 21
          ? "Legacy fallback only. Not recommended for Minecraft 1.21.1 packs."
          : "Legacy runtime for older packs.",
      recommended: false,
    },
  ];
}

function CompactLaunchStat({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "ok" | "warn";
}) {
  return (
    <div className="flex items-start gap-3 border border-line-soft/20 bg-surface-sunken/50 px-3 py-3">
      <div className={cn("mt-0.5", tone === "ok" ? "text-brand-core" : "text-signal-alert")}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-text-low">{label}</p>
        <p
          className={cn(
            "mt-1 text-sm leading-none",
            tone === "ok" ? "text-brand-core" : "text-signal-alert",
          )}
        >
          {value}
        </p>
        <p className="mt-1 truncate text-[11px] text-text-low">{detail}</p>
      </div>
    </div>
  );
}

function LaunchPanelRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-line-soft/30 border-b pb-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">{k}</span>
      <span className="font-mono text-xs text-text-high">{v}</span>
    </div>
  );
}
