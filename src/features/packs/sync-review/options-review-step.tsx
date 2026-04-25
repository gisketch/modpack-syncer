import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardStatus, CardWindowBar, CardWindowTab } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatError } from "@/lib/format-error";
import type { OptionsSyncPreview, ShaderSettingsPreview } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { OptionsPreviewKey, OptionsPreviewValue } from "./option-value-cells";
import {
  getOptionsChangeRowTone,
  Row,
  ShaderDiffTable,
  SyncPlanActionChip,
  sortOptionsSyncChanges,
} from "./sync-review-tables";

type ShaderDecision = "undecided" | "sync" | "skip";

type OptionsReviewStepProps = {
  hasTrackedOptionsFile: boolean;
  preview?: OptionsSyncPreview;
  loading: boolean;
  error: unknown;
  onToggleIgnore: (key: string, ignored: boolean) => void;
  togglingIgnore: boolean;
  shaderPreview?: ShaderSettingsPreview;
  shaderLoading: boolean;
  shaderError: unknown;
  shaderDecision: ShaderDecision;
  onShaderDecisionChange: (decision: ShaderDecision) => void;
};

export function OptionsReviewStep({
  hasTrackedOptionsFile,
  preview,
  loading,
  error,
  onToggleIgnore,
  togglingIgnore,
  shaderPreview,
  shaderLoading,
  shaderError,
  shaderDecision,
  onShaderDecisionChange,
}: OptionsReviewStepProps) {
  const [showIgnored, setShowIgnored] = useState(true);
  const hasShaderSettings = shaderLoading || !!shaderError || !!shaderPreview?.hasPackIrisFile;
  const shaderChangeCount =
    (shaderPreview?.irisChanges.length ?? 0) + (shaderPreview?.presetChanges.length ?? 0);

  if (!hasTrackedOptionsFile && !hasShaderSettings) {
    return (
      <Card>
        <CardContent className="flex h-full min-h-[18rem] items-center justify-center p-6 text-center text-sm text-text-low">
          No tracked options or shader preset files for this pack yet.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-full min-h-[18rem] items-center gap-3 p-6 text-sm text-text-low">
          <Loader2 className="size-4 animate-spin text-brand-core" />
          Building options diff...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>OPTIONS PREVIEW FAILED</AlertTitle>
        <AlertDescription>{formatError(error)}</AlertDescription>
      </Alert>
    );
  }

  if (hasTrackedOptionsFile && !preview) {
    return null;
  }

  const reviewTabs: Array<OptionsSyncPreview["groups"][number]["category"] | "shader-settings"> =
    preview
      ? ["keybinds", "video", ...(hasShaderSettings ? (["shader-settings"] as const) : []), "other"]
      : ["shader-settings"];
  const defaultTab =
    preview?.groups.find((group) => group.changes.length > 0)?.category ??
    (hasShaderSettings && shaderChangeCount > 0 ? "shader-settings" : reviewTabs[0]);
  const changedCount = preview?.groups.reduce((sum, group) => sum + group.changes.length, 0) ?? 0;
  const totalChangedCount = changedCount + shaderChangeCount;
  const groupsByCategory = new Map((preview?.groups ?? []).map((group) => [group.category, group]));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(16rem,18rem)_minmax(0,1fr)]">
        <Card variant="window" className="flex min-h-0 flex-col">
          <CardWindowBar>
            <CardWindowTab>OPTION SUMMARY</CardWindowTab>
            <CardStatus>{totalChangedCount} CHANGES</CardStatus>
          </CardWindowBar>
          <CardContent className="min-h-0 flex-1 p-0">
            <ScrollArea className="h-full px-4 py-4">
              <div className="flex flex-col gap-3">
                <div className="grid gap-2">
                  <Row k="PACK FILE" v={preview?.hasPackFile ? "FOUND" : "MISSING"} />
                  <Row k="INSTANCE FILE" v={preview?.hasInstanceFile ? "FOUND" : "MISSING"} />
                  <Row k="IGNORED KEYS" v={String(preview?.ignoredKeys.length ?? 0)} />
                  {hasShaderSettings ? (
                    <Row k="SHADER SETTINGS" v={String(shaderChangeCount)} />
                  ) : null}
                  {(preview?.groups ?? []).map((group) => (
                    <Row key={group.category} k={group.label} v={String(group.changes.length)} />
                  ))}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-3 md:min-w-0">
          {preview || hasShaderSettings ? (
            <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col gap-4">
              <TabsList className="flex-wrap gap-2">
                {reviewTabs.map((tab) => {
                  const group = tab === "shader-settings" ? null : groupsByCategory.get(tab);
                  const label =
                    tab === "shader-settings"
                      ? "SHADER SETTINGS"
                      : (group?.label ?? tab.toUpperCase());
                  const count =
                    tab === "shader-settings" ? shaderChangeCount : (group?.changes.length ?? 0);
                  return (
                    <TabsTrigger key={tab} value={tab}>
                      <span>{label}</span>
                      <span className="font-mono text-[10px] tabular-nums text-text-low">
                        {count}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {reviewTabs.map((tab) => {
                if (tab === "shader-settings") {
                  return (
                    <TabsContent key={tab} value={tab} className="min-h-0 flex-1 outline-none">
                      <ShaderSettingsTab
                        preview={shaderPreview}
                        loading={shaderLoading}
                        error={shaderError}
                        decision={shaderDecision}
                        onDecisionChange={onShaderDecisionChange}
                      />
                    </TabsContent>
                  );
                }

                const group = groupsByCategory.get(tab);
                if (!group) {
                  return null;
                }

                const visibleChanges = sortOptionsSyncChanges(group.changes).filter(
                  (change) => showIgnored || !change.ignored,
                );

                return (
                  <TabsContent
                    key={group.category}
                    value={group.category}
                    className="min-h-0 flex-1 outline-none"
                  >
                    <Card variant="window" className="flex h-full min-h-0 flex-col">
                      <CardWindowBar>
                        <CardWindowTab>{group.label}</CardWindowTab>
                        <CardStatus>{visibleChanges.length} CHANGES</CardStatus>
                        <div className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-low">
                          <span>SHOW IGNORED</span>
                          <Switch checked={showIgnored} onCheckedChange={setShowIgnored} />
                        </div>
                      </CardWindowBar>
                      <CardContent className="min-h-0 flex-1 p-0">
                        {visibleChanges.length > 0 ? (
                          <ScrollArea className="h-full">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="px-3 py-2">ACTION</TableHead>
                                  <TableHead className="px-3 py-2">KEY</TableHead>
                                  <TableHead className="px-3 py-2">PACK VALUE</TableHead>
                                  <TableHead className="px-3 py-2">LOCAL VALUE</TableHead>
                                  <TableHead className="px-3 py-2 text-center">IGNORE</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="divide-y-0">
                                {visibleChanges.map((change) => (
                                  <TableRow
                                    key={`${group.category}:${change.key}`}
                                    className={cn(
                                      "h-8 border-l-2",
                                      getOptionsChangeRowTone(change.action),
                                      change.ignored && "opacity-45",
                                    )}
                                  >
                                    <TableCell className="px-3 py-1.5 align-top">
                                      <SyncPlanActionChip action={change.action} />
                                    </TableCell>
                                    <TableCell className="px-3 py-1.5 align-top">
                                      <OptionsPreviewKey optionKey={change.key} />
                                    </TableCell>
                                    <TableCell className="px-3 py-1.5 align-top">
                                      <OptionsPreviewValue
                                        optionKey={change.key}
                                        value={change.packValue ?? null}
                                      />
                                    </TableCell>
                                    <TableCell className="px-3 py-1.5 align-top">
                                      <OptionsPreviewValue
                                        optionKey={change.key}
                                        value={change.instanceValue ?? null}
                                      />
                                    </TableCell>
                                    <TableCell
                                      className="cursor-pointer px-3 py-1.5 align-middle"
                                      role="button"
                                      tabIndex={togglingIgnore ? -1 : 0}
                                      title={change.ignored ? "Stop ignoring key" : "Ignore key"}
                                      onClick={() => {
                                        if (!togglingIgnore) {
                                          onToggleIgnore(change.key, !change.ignored);
                                        }
                                      }}
                                      onKeyDown={(event) => {
                                        if (
                                          (event.key === "Enter" || event.key === " ") &&
                                          !togglingIgnore
                                        ) {
                                          event.preventDefault();
                                          onToggleIgnore(change.key, !change.ignored);
                                        }
                                      }}
                                    >
                                      <div className="flex items-center justify-center">
                                        <Checkbox
                                          checked={change.ignored}
                                          disabled={togglingIgnore}
                                          aria-label={`Ignore ${change.key}`}
                                          className="pointer-events-none"
                                        />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        ) : (
                          <div className="px-4 py-8 text-center text-sm text-text-low">
                            {showIgnored
                              ? `No changes in ${group.label.toLowerCase()}.`
                              : `No visible changes in ${group.label.toLowerCase()}.`}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex h-full min-h-[18rem] items-center justify-center p-6 text-center text-sm text-text-low">
                No tracked <span className="mx-1 font-mono text-text-high">options.txt</span> preset
                for this pack yet.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ShaderSettingsTab({
  preview,
  loading,
  error,
  decision,
  onDecisionChange,
}: {
  preview?: ShaderSettingsPreview;
  loading: boolean;
  error: unknown;
  decision: ShaderDecision;
  onDecisionChange: (decision: ShaderDecision) => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 px-4 py-3 text-sm text-text-low">
          <Loader2 className="size-4 animate-spin text-brand-core" />
          Reading shader settings...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>SHADER PREVIEW FAILED</AlertTitle>
        <AlertDescription>{formatError(error)}</AlertDescription>
      </Alert>
    );
  }

  if (!preview?.hasPackIrisFile) {
    return (
      <Card>
        <CardContent className="flex h-full min-h-[18rem] items-center justify-center p-6 text-center text-sm text-text-low">
          No tracked shader settings for this pack yet.
        </CardContent>
      </Card>
    );
  }

  const localShader = preview.localShaderPack ?? "NONE";
  const packShader = preview.packShaderPack ?? "NONE";
  const statusLabel =
    preview.status === "disabled-local"
      ? "SHADERS OFF LOCALLY"
      : preview.status === "mismatch"
        ? "SHADER MISMATCH"
        : preview.status === "missing-preset"
          ? "PACK PRESET MISSING"
          : "SHADER PRESET READY";

  return (
    <Card variant="window" className="flex h-full min-h-0 flex-col">
      <CardWindowBar>
        <CardWindowTab>SHADER SETTINGS</CardWindowTab>
        <CardStatus>{statusLabel}</CardStatus>
      </CardWindowBar>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div className="grid gap-2 md:grid-cols-2">
          <Row k="LOCAL SHADER" v={localShader} />
          <Row k="PACK SHADER" v={packShader} />
          <Row k="IRIS DIFFS" v={String(preview.irisDiffCount)} />
          <Row k="PRESET DIFFS" v={String(preview.presetDiffCount)} />
        </div>
        <p className="text-xs text-text-low [text-wrap:pretty]">
          {preview.status === "disabled-local"
            ? "Shaders off locally. Sync can still write pack shader selection + preset."
            : preview.status === "mismatch"
              ? "Local shader differs from pack shader preset. Sync shader applies pack iris.properties + matching preset file."
              : preview.status === "missing-preset"
                ? "Pack iris.properties exists, but matching shader preset .txt missing. Sync shader will only update iris.properties."
                : "Sync shader copies pack iris.properties and matching shader preset .txt when present."}
        </p>
        {preview.requiresDecision ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={decision === "sync" ? "default" : "outline"}
              onClick={() => onDecisionChange("sync")}
            >
              SYNC SHADER
            </Button>
            <Button
              variant={decision === "skip" ? "secondary" : "outline"}
              onClick={() => onDecisionChange("skip")}
            >
              IGNORE THIS SYNC
            </Button>
          </div>
        ) : (
          <p className="text-[10px] uppercase tracking-[0.18em] text-text-low">
            No shader sync decision needed.
          </p>
        )}
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-2">
          <ShaderDiffTable
            title="IRIS.PROPERTIES"
            description="Pack config values vs local instance config/iris.properties."
            changes={preview.irisChanges}
          />
          <ShaderDiffTable
            title="SHADER PRESET"
            description="Pack shaderpacks/*.txt values vs local active preset sidecar."
            changes={preview.presetChanges}
          />
        </div>
      </CardContent>
    </Card>
  );
}
