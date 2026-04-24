import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SidebarItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: ReactNode;
}

export function Sidebar({
  items,
  active,
  onSelect,
  footer,
}: {
  items: SidebarItem[];
  active: string;
  onSelect: (id: string) => void;
  footer?: ReactNode;
}) {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-[--line-soft] border-r bg-[--surface-sunken]">
      <div className="flex flex-col gap-1 border-[--line-soft] border-b px-3 py-4">
        <span className="cp-tactical-label text-[--text-low] text-[10px]">:: NAVIGATION</span>
        <span className="cp-tactical-label text-[--brand-core] text-sm">MODSYNC</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => onSelect(item.id)}
              className={cn(
                "cp-tactical-label relative flex items-center gap-3 px-3 py-2 text-left text-xs transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-40",
                isActive
                  ? "border-[--brand-core] border-l-2 bg-[--surface-elevated] text-[--brand-core]"
                  : "border-transparent border-l-2 text-[--text-low] hover:border-[--line-strong] hover:bg-[--surface-elevated] hover:text-[--text-high]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge}
            </button>
          );
        })}
      </nav>
      {footer && <div className="border-[--line-soft] border-t p-3">{footer}</div>}
    </aside>
  );
}
