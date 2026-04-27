import { AnimatePresence, useReducedMotion } from "motion/react";
import { Card, CardContent, CardStatus, CardWindowBar, CardWindowTab } from "@/components/ui/card";
import { motion } from "@/components/ui/motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { OptionPresetSummary } from "@/lib/tauri";
import { NO_OPTION_PRESET_ID, PACK_DEFAULT_PRESET_ID } from "@/lib/tauri";
import { cn } from "@/lib/utils";

type OptionPresetSelectionProps = {
  presets: OptionPresetSummary[];
  selectedPresetId: string;
  onChange: (presetId: string) => void;
};

export function OptionPresetSelection({
  presets,
  selectedPresetId,
  onChange,
}: OptionPresetSelectionProps) {
  const reduceMotion = useReducedMotion();
  const options = [
    {
      id: PACK_DEFAULT_PRESET_ID,
      label: "PACK DEFAULT",
      description:
        "Recommended on first install. Use pack baseline settings and synced pack files.",
      detail: "RECOMMENDED FIRST INSTALL",
      shaderPack: null,
      disabledMods: [],
    },
    {
      id: NO_OPTION_PRESET_ID,
      label: "DON'T OVERRIDE SETTINGS",
      description: "Skip preset option keys, preset file overrides, and preset-disabled mods.",
      detail: "NO PRESET",
      shaderPack: null,
      disabledMods: [],
    },
    ...presets.map((preset) => ({
      id: preset.id,
      label: preset.label,
      description: preset.description || "No description.",
      detail: presetCountLabel(preset),
      shaderPack: preset.shaderPack ?? null,
      disabledMods: preset.disabledMods ?? [],
    })),
  ];

  return (
    <ScrollArea className="min-h-0 flex-1 pr-3">
      <div className="grid gap-3">
        {options.map((option) => {
          const selected = option.id === selectedPresetId;
          return (
            <Card
              key={option.id}
              variant="window"
              className={cn(
                "min-h-10 cursor-pointer overflow-hidden transition-[background-color,border-color,scale] duration-150 active:scale-[0.96]",
                selected && "border-brand-core/60 bg-brand-core/10",
              )}
              role="button"
              tabIndex={0}
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onChange(option.id);
                }
              }}
            >
              <CardWindowBar className="select-none">
                <CardWindowTab>{option.label}</CardWindowTab>
                <CardStatus>{option.detail}</CardStatus>
              </CardWindowBar>
              <CardContent className="p-0">
                <AnimatePresence initial={false}>
                  {selected ? (
                    <motion.div
                      key="preset-details"
                      initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{
                        duration: reduceMotion ? 0.01 : 0.18,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="overflow-hidden"
                    >
                      <div className="grid gap-2 border-line-soft/20 border-t px-4 py-3 text-[11px] text-text-low">
                        <div className="text-text-low [text-wrap:pretty]">{option.description}</div>
                        {option.disabledMods.length > 0 ? (
                          <PresetDetailRow
                            label="MODS DISABLED"
                            value={option.disabledMods.join(", ")}
                          />
                        ) : null}
                        {option.shaderPack ? (
                          <PresetDetailRow
                            label={
                              option.shaderPack === "Disabled"
                                ? "SHADERS DISABLED"
                                : "SHADER SELECTED"
                            }
                            value={option.shaderPack === "Disabled" ? "OFF" : option.shaderPack}
                          />
                        ) : null}
                        {option.disabledMods.length === 0 && !option.shaderPack ? (
                          <PresetDetailRow label="PRESET EFFECT" value={option.detail} />
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function PresetDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <span className="text-[10px] uppercase tracking-[0.16em] text-text-low">{label}</span>
      <span className="min-w-0 truncate font-mono text-[11px] text-text-high" title={value}>
        {value}
      </span>
    </div>
  );
}

function presetCountLabel(preset: OptionPresetSummary) {
  const keyCount =
    preset.counts.video + preset.counts.keybinds + preset.counts.other + preset.counts.shader;
  const parts = [];
  if (keyCount > 0) parts.push(`${keyCount} keys`);
  if (preset.counts.files > 0) parts.push(`${preset.counts.files} files`);
  if (preset.counts.disabledMods > 0) parts.push(`${preset.counts.disabledMods} mods off`);
  return parts.length > 0 ? parts.join(" / ") : "empty";
}
