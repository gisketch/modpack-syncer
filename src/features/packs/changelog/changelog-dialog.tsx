import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { PackChangelogEntry } from "@/lib/tauri";
import { ChangelogCard } from "./changelog-card";

type ChangelogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  entry: PackChangelogEntry | null;
  entryIndex: number;
  entryCount: number;
  newUpdateCount: number;
  onPrevious: () => void;
  onNext: () => void;
};

export function ChangelogDialog({
  open,
  onOpenChange,
  loading,
  entry,
  entryIndex,
  entryCount,
  newUpdateCount,
  onPrevious,
  onNext,
}: ChangelogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden max-w-[96vw] sm:max-w-[72rem] xl:max-w-[80rem]">
        <DialogHeader>
          <DialogTitle>PACK UPDATES</DialogTitle>
          <DialogDescription>Recent changes for this pack</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex min-h-0 flex-col gap-4 overflow-hidden p-5 xl:p-6">
          {loading ? (
            <div className="flex items-center gap-3 py-4 text-text-low">
              <Loader2 className="size-4 animate-spin text-brand-core" />
              <span className="text-sm">Loading commit history</span>
            </div>
          ) : entry ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" onClick={onPrevious} disabled={entryIndex === 0}>
                  <ChevronLeft /> NEWER
                </Button>
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-text-low">
                    {entryIndex + 1} / {entryCount}
                  </span>
                  <span className="text-xs text-text-low">
                    {entryIndex < newUpdateCount ? "NEW UPDATE" : "HISTORY"}
                  </span>
                </div>
                <Button variant="outline" onClick={onNext} disabled={entryIndex >= entryCount - 1}>
                  OLDER <ChevronRight />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                  <div className="min-h-[28rem] pb-1">
                    <ChangelogCard
                      entry={entry}
                      expanded
                      highlighted={entryIndex < newUpdateCount}
                      collapsible={false}
                      className="min-h-[28rem]"
                    />
                  </div>
                </ScrollArea>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-low">No recent commits found.</p>
          )}
        </DialogBody>
        <DialogFooter className="px-6 py-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            CLOSE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
