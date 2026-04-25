import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
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
import type { OptionPresetSummary, OptionsSyncPreview, ShaderSettingsPreview } from "@/lib/tauri";
import { formatBytes } from "../artifact-status/artifact-status-rows";
import { OptionsReviewStep } from "./options-review-step";
import type { SyncCategorySummary, SyncReviewTab } from "./sync-artifact-preview";
import { SyncPlanActionChip, SyncPreviewCard } from "./sync-artifact-preview";

type SyncReviewStep = "artifacts" | "options";
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
  syncPending,
  onClose,
  onNext,
  onBack,
  onConfirm,
}: SyncReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex h-[min(92vh,48rem)] max-h-[92vh] flex-col overflow-hidden max-w-[96vw] sm:max-w-[72rem] xl:max-w-[80rem]">
        <DialogHeader>
          <DialogTitle>{step === "artifacts" ? "SYNC PREVIEW" : "OPTIONS REVIEW"}</DialogTitle>
          <DialogDescription>
            {step === "artifacts"
              ? "Review mods, resourcepacks, and shaderpacks before writing Prism instance."
              : "Review options categories before final sync confirm."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5 xl:p-6">
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
              optionPresets={optionPresets}
              selectedOptionPresetId={selectedOptionPresetId}
              onOptionPresetChange={onOptionPresetChange}
            />
          )}
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
          ) : (
            <>
              <Button variant="secondary" onClick={onBack}>
                <ChevronLeft /> BACK
              </Button>
              <Button
                onClick={onConfirm}
                disabled={
                  syncPending ||
                  (!!shaderPreview?.requiresDecision && shaderDecision === "undecided")
                }
              >
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
