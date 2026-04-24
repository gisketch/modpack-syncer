import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppVersion } from "@/hooks/use-app-version";
import { cn } from "@/lib/utils";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const appVersion = useAppVersion();

  useEffect(() => {
    const win = getCurrentWindow();
    void win.isMaximized().then(setMaximized);
    const unlisten = win.onResized(() => {
      void win.isMaximized().then(setMaximized);
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, []);

  const win = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 select-none items-center justify-between border-[--line-soft] border-b bg-[--surface-sunken] pl-4"
    >
      <div data-tauri-drag-region className="flex items-center gap-3 text-xs">
        <span
          data-tauri-drag-region
          aria-hidden
          className="h-1.5 w-1.5 bg-[--signal-live] shadow-[0_0_8px_var(--signal-live)]"
        />
        <span data-tauri-drag-region className="cp-tactical-label text-[--brand-core] text-xs">
          MODSYNC :: v{appVersion.data ?? "..."}
        </span>
      </div>
      <div className="flex h-full">
        <WindowButton aria-label="Minimize" onClick={() => void win.minimize()}>
          <Minus className="h-3.5 w-3.5" />
        </WindowButton>
        <WindowButton
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={() => void win.toggleMaximize()}
        >
          <Square className="h-3 w-3" />
        </WindowButton>
        <WindowButton aria-label="Close" onClick={() => void win.close()} variant="close">
          <X className="h-3.5 w-3.5" />
        </WindowButton>
      </div>
    </div>
  );
}

function WindowButton({
  children,
  onClick,
  variant = "default",
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "close";
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-full w-11 items-center justify-center text-[--text-low] transition-colors",
        variant === "close"
          ? "hover:bg-[--signal-alert] hover:text-white"
          : "hover:bg-[--surface-elevated] hover:text-[--brand-core]",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
