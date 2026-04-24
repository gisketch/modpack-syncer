import * as React from "react";

import { cn } from "@/lib/utils";

type ChatBubbleRole = "user" | "assistant";

const ChatBubbleRoleContext = React.createContext<ChatBubbleRole>("assistant");

function ChatBubble({
  className,
  role = "assistant",
  ...props
}: React.ComponentProps<"div"> & { role?: ChatBubbleRole }) {
  return (
    <ChatBubbleRoleContext.Provider value={role}>
      <div
        data-slot="chat-bubble"
        data-role={role}
        className={cn(
          "flex w-full max-w-3xl flex-col gap-1",
          role === "user" ? "items-end self-end" : "items-start self-start",
          className,
        )}
        {...props}
      />
    </ChatBubbleRoleContext.Provider>
  );
}

function ChatBubbleMeta({ className, ...props }: React.ComponentProps<"span">) {
  const role = React.useContext(ChatBubbleRoleContext);
  return (
    <span
      data-slot="chat-bubble-meta"
      className={cn(
        "font-heading text-[10px] uppercase tracking-widest text-text-low",
        role === "user" ? "mr-2" : "ml-2",
        className,
      )}
      {...props}
    />
  );
}

function ChatBubbleContent({ className, ...props }: React.ComponentProps<"div">) {
  const role = React.useContext(ChatBubbleRoleContext);
  const isAssistant = role === "assistant";
  return (
    <div
      data-slot="chat-bubble-content"
      data-role={role}
      className={cn(
        "relative p-4 clip-diagonal-tab font-body text-sm text-text-high",
        isAssistant
          ? "bg-surface-panel-strong border-l-2 border-brand-core scanlines-overlay shadow-[0_0_24px_color-mix(in_srgb,var(--brand-core)_6%,transparent)]"
          : "bg-[color-mix(in_srgb,var(--color-surface-panel-strong)_100%,white_6%)] border border-line-strong/35",
        className,
      )}
      {...props}
    />
  );
}

export { ChatBubble, ChatBubbleContent, ChatBubbleMeta };
