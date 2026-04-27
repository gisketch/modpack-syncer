import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardStatus, CardWindowBar, CardWindowTab } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "@/components/ui/motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  OptionPresetSummary,
  OptionsSyncCategory,
  OptionsSyncPreview,
  ShaderSettingsPreview,
} from "@/lib/tauri";
import { NO_OPTION_PRESET_ID, PACK_DEFAULT_PRESET_ID } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { formatBytes } from "../artifact-status/artifact-status-rows";
import { OptionsReviewStep } from "./options-review-step";
import type { SyncCategorySummary, SyncReviewTab } from "./sync-artifact-preview";
import { SyncPlanActionChip, SyncPreviewCard } from "./sync-artifact-preview";

type SyncReviewStep = "artifacts" | "presets" | "options";
type ShaderDecision = "undecided" | "sync" | "skip";

type SyncReviewDialogProps = {
  open: boolean;
  step: SyncReviewStep;
  artifactLoading: boolean;
  syncSummary: SyncCategorySummary[];
  syncReviewTabs: SyncReviewTab[];
  defaultTab: SyncReviewTab["id"];
  hasTrackedOptionsFile: boolean;
  optionsPreview?: OptionsSyncPreview;
  optionsLoading: boolean;
  optionsError: unknown;
  onToggleIgnore: (key: string, ignored: boolean) => void;
  togglingIgnore: boolean;
  shaderPreview?: ShaderSettingsPreview;
  shaderLoading: boolean;
  shaderError: unknown;
  shaderDecision: ShaderDecision;
  onShaderDecisionChange: (decision: ShaderDecision) => void;
  optionPresets: OptionPresetSummary[];
  selectedOptionPresetId: string;
  onOptionPresetChange: (presetId: string) => void;
  enabledOptionSyncCategories: OptionsSyncCategory[];
  onOptionSyncCategoryChange: (category: OptionsSyncCategory, enabled: boolean) => void;
  syncPending: boolean;
  onClose: () => void;
  onNext: () => void;
  onBack: () => void;
  onConfirm: () => void;
};

export function SyncReviewDialog({
  open,
  step,
  artifactLoading,
  syncSummary,
  syncReviewTabs,
  defaultTab,
  hasTrackedOptionsFile,
  optionsPreview,
  optionsLoading,
  optionsError,
  onToggleIgnore,
  togglingIgnore,
  shaderPreview,
  shaderLoading,
  shaderError,
  shaderDecision,
  onShaderDecisionChange,
  optionPresets,
  selectedOptionPresetId,
  onOptionPresetChange,
  enabledOptionSyncCategories,
  onOptionSyncCategoryChange,
  syncPending,
  onClose,
  onNext,
  onBack,
  onConfirm,
}: SyncReviewDialogProps) {
  const reduceMotion = useReducedMotion();
  const stepContentKey = step === "artifacts" && artifactLoading ? "artifacts-loading" : step;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex h-[min(92vh,48rem)] max-h-[92vh] flex-col overflow-hidden max-w-[96vw] sm:max-w-[72rem] xl:max-w-[80rem]">
        <DialogHeader>
          <DialogTitle>{syncStepTitle(step)}</DialogTitle>
          <DialogDescription>
            {syncStepDescription(step)}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5 xl:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stepContentKey}
              className="flex min-h-0 flex-1 flex-col"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: step === "options" ? 18 : -18, filter: "blur(2px)" }
              }
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: step === "options" ? -14 : 14, filter: "blur(2px)" }
              }
              transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === "artifacts" && artifactLoading ? (
                <Card>
                  <CardContent className="flex items-center gap-3 p-5 text-sm text-text-low">
                    <Loader2 className="size-4 animate-spin text-brand-core" />
                    Building sync diff...
                  </CardContent>
                </Card>
              ) : step === "artifacts" ? (
                <SyncArtifactReview
                  syncSummary={syncSummary}
                  syncReviewTabs={syncReviewTabs}
                  defaultTab={defaultTab}
                />
              ) : step === "presets" ? (
                <PresetSelectionStep
                  presets={optionPresets}
                  selectedPresetId={selectedOptionPresetId}
                  onChange={onOptionPresetChange}
                />
              ) : (
                <OptionsReviewStep
                  hasTrackedOptionsFile={hasTrackedOptionsFile}
                  preview={optionsPreview}
                  loading={optionsLoading}
                  error={optionsError}
                  onToggleIgnore={onToggleIgnore}
                  togglingIgnore={togglingIgnore}
                  shaderPreview={shaderPreview}
                  shaderLoading={shaderLoading}
                  shaderError={shaderError}
                  shaderDecision={shaderDecision}
                  onShaderDecisionChange={onShaderDecisionChange}
                  enabledOptionSyncCategories={enabledOptionSyncCategories}
                  onOptionSyncCategoryChange={onOptionSyncCategoryChange}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </DialogBody>
        <DialogFooter className="px-6 py-4 sm:justify-between">
          {step === "artifacts" ? (
            <>
              <Button variant="secondary" onClick={onClose}>
                CANCEL
              </Button>
              <Button onClick={onNext} disabled={artifactLoading}>
                NEXT <ChevronRight />
              </Button>
            </>
          ) : step === "presets" ? (
            <>
              <Button variant="secondary" onClick={onBack}>
                <ChevronLeft /> BACK
              </Button>
              <Button onClick={onNext}>
                NEXT <ChevronRight />
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onBack}>
                <ChevronLeft /> BACK
              </Button>
              <Button onClick={onConfirm} disabled={syncPending}>
                {syncPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                CONTINUE TO SYNC
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function syncStepTitle(step: SyncReviewStep) {
  if (step === "artifacts") return "SYNC PREVIEW";
  if (step === "presets") return "CHOOSE PRESET";
  return "KEYBINDS / OPTIONS";
}

function syncStepDescription(step: SyncReviewStep) {
  if (step === "artifacts") {
    return "Review mods, resourcepacks, and shaderpacks before writing Prism instance.";
  }
  if (step === "presets") {
    return "Choose how pack settings, preset files, and optional disabled mods apply.";
  }
  return "Review option categories before final sync.";
}

function PresetSelectionStep({
  presets,
  selectedPresetId,
  onChange,
}: {
  presets: OptionPresetSummary[];
  selectedPresetId: string;
  onChange: (presetId: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const options = [
    {
      id: PACK_DEFAULT_PRESET_ID,
      label: "PACK DEFAULT",
      description: "Recommended on first install. Use pack baseline settings and synced pack files.",
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
                "cursor-pointer overflow-hidden transition-colors",
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
                <div className="px-4 py-3 text-[11px] text-text-low">{option.description}</div>
                <AnimatePresence initial={false}>
                  {selected ? (
                    <motion.div
                      key="preset-details"
                      initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="grid gap-2 border-line-soft/20 border-t px-4 py-3 text-[11px] text-text-low">
                        {option.disabledMods.length > 0 ? (
                          <PresetDetailRow
                            label="MODS DISABLED"
                            value={option.disabledMods.join(", ")}
                          />
                        ) : null}
                        {option.shaderPack ? (
                          <PresetDetailRow label="SHADER SELECTED" value={option.shaderPack} />
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

function SyncArtifactReview({
  syncSummary,
  syncReviewTabs,
  defaultTab,
}: {
  syncSummary: SyncCategorySummary[];
  syncReviewTabs: SyncReviewTab[];
  defaultTab: SyncReviewTab["id"];
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {syncSummary.map((item) => (
          <SyncPreviewCard key={item.category} summary={item} />
        ))}
      </div>
      <Tabs defaultValue={defaultTab} className="min-h-0 gap-4">
        <TabsList className="flex-wrap gap-2">
          {syncReviewTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              <span>{tab.label}</span>
              <span className="font-mono text-[10px] tabular-nums text-text-low">{tab.count}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {syncReviewTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="min-h-0 outline-none">
            <Card variant="window" className="min-h-0">
              <CardWindowBar>
                <CardWindowTab>{tab.label}</CardWindowTab>
                <CardStatus>{tab.count} CHANGES</CardStatus>
              </CardWindowBar>
              <CardContent className="min-h-0 p-0">
                {tab.items.length > 0 ? (
                  <ScrollArea className="h-[26rem] px-4 py-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ACTION</TableHead>
                          <TableHead>PATH</TableHead>
                          <TableHead>SOURCE</TableHead>
                          <TableHead className="text-right">SIZE</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tab.items.map((item) => (
                          <TableRow key={`${tab.id}:${item.relativePath}:${item.action}`}>
                            <TableCell>
                              <SyncPlanActionChip action={item.action} />
                            </TableCell>
                            <TableCell className="font-mono text-[10px] text-text-low">
                              {item.relativePath}
                            </TableCell>
                            <TableCell className="text-xs text-text-low">
                              {item.source ?? "instance-local"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-text-low tabular-nums">
                              {typeof item.size === "number" ? formatBytes(item.size) : "--"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-text-low">
                    No changes in {tab.label.toLowerCase()}.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      <Card>
        <CardContent className="px-4 py-3 text-xs text-text-low">
          Sync adds missing pack files, updates changed managed files, deletes local-only managed
          extras in selected categories.
        </CardContent>
      </Card>
    </>
  );
}
