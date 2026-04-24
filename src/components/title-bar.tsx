import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

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
      className="flex h-8 shrink-0 select-none items-center justify-between border-[--color-muted] border-b bg-[--color-bg] pl-3"
    >
      <div data-tauri-drag-region className="flex items-center gap-2 text-xs opacity-70">
        <span data-tauri-drag-region className="font-semibold tracking-tight">
          modsync
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
        "flex h-full w-11 items-center justify-center text-white/70 transition-colors",
        variant === "close" ? "hover:bg-red-600 hover:text-white" : "hover:bg-white/10",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
