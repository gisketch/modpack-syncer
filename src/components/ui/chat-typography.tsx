import type * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const components: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "mt-4 mb-2 pb-1 font-heading text-2xl font-bold uppercase tracking-widest text-brand-core",
        "border-b border-brand-core/30",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "mt-4 mb-2 font-heading text-xl font-bold uppercase tracking-widest text-brand-accent",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn(
        "mt-4 mb-2 font-heading text-lg font-bold uppercase tracking-widest text-brand-core",
        className,
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("mb-4 leading-relaxed", className)} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-text-high", className)} {...props} />
  ),
  em: ({ className, ...props }) => (
    <em className={cn("italic text-brand-core", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "text-brand-core underline underline-offset-2 hover:text-brand-accent",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "mb-4 list-['■_'] pl-6 text-text-low marker:text-brand-core [&>li]:mb-1",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "mb-4 list-decimal pl-6 font-heading text-text-low marker:text-brand-core [&>li]:mb-1",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => <li className={cn("font-body", className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "relative mb-4 border-l-4 border-brand-accent bg-brand-core/5 px-4 py-2 italic text-text-high",
        "before:absolute before:right-0 before:top-0 before:size-2.5 before:border-r-2 before:border-t-2 before:border-brand-accent",
        "after:absolute after:right-0 after:bottom-0 after:size-2.5 after:border-r-2 after:border-b-2 after:border-brand-accent",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-6 border-t border-dashed border-line-strong/50", className)} {...props} />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn(
        "border border-brand-core/30 bg-surface-sunken px-1 py-0.5 font-mono text-[0.85em] text-brand-accent",
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "mb-4 overflow-x-auto border border-line-soft/30 bg-surface-sunken p-4 font-mono text-xs text-text-low",
        "[&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit",
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="mb-4 overflow-x-auto">
      <table className={cn("w-full border-separate border-spacing-y-1", className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => <thead className={cn(className)} {...props} />,
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "bg-surface-panel-strong px-3 py-2 text-left font-heading text-xs uppercase tracking-widest text-brand-accent",
        "[clip-path:polygon(0_0,calc(100%-6px)_0,100%_6px,100%_100%,0_100%)]",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "border-b border-line-soft/40 bg-surface-panel-strong/50 px-3 py-2 text-sm",
        className,
      )}
      {...props}
    />
  ),
};

function ChatTypography({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  children: string;
}) {
  return (
    <div data-slot="chat-typography" className={cn("text-sm text-text-low", className)} {...props}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export { ChatTypography };
