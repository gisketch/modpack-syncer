import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

type DialogVariant = "default" | "destructive" | "success" | "warning";

const DialogVariantContext = React.createContext<DialogVariant>("default");

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-background/80 backdrop-blur-sm duration-100",
        "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

const variantTopBorder: Record<DialogVariant, string> = {
  default: "border-t-brand-core",
  destructive: "border-t-signal-alert",
  success: "border-t-brand-core",
  warning: "border-t-signal-alert",
};

const variantShadow: Record<DialogVariant, string> = {
  default: "shadow-[0_0_40px_color-mix(in_srgb,var(--brand-core)_10%,transparent)]",
  destructive: "shadow-[0_0_40px_color-mix(in_srgb,var(--signal-alert)_12%,transparent)]",
  success: "shadow-[0_0_40px_color-mix(in_srgb,var(--brand-core)_12%,transparent)]",
  warning: "shadow-[0_0_40px_color-mix(in_srgb,var(--signal-alert)_10%,transparent)]",
};

function DialogContent({
  className,
  children,
  variant = "default",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  variant?: DialogVariant;
  showCloseButton?: boolean;
}) {
  return (
    <DialogVariantContext.Provider value={variant}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          data-variant={variant}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-lg",
            "bg-surface-panel-strong border border-line-soft/25 border-t-2 clip-diagonal-btn-secondary scanlines-overlay",
            "font-body text-sm text-text-high outline-none",
            "dialog-pop-animate dialog-stagger-children",
            variantTopBorder[variant],
            variantShadow[variant],
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className={cn(
                "absolute right-3 top-3 z-10 inline-flex size-7 items-center justify-center",
                "text-text-low transition-colors hover:text-text-high",
                "focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand-core/60",
              )}
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </DialogVariantContext.Provider>
  );
}

const variantHeaderBg: Record<DialogVariant, string> = {
  default: "bg-surface-panel",
  destructive: "bg-surface-panel",
  success: "bg-surface-panel",
  warning: "bg-surface-panel",
};

const variantAccentText: Record<DialogVariant, string> = {
  default: "text-brand-core",
  destructive: "text-signal-alert",
  success: "text-brand-core",
  warning: "text-signal-alert",
};

function DialogHeader({ className, children, ...props }: React.ComponentProps<"div">) {
  const variant = React.useContext(DialogVariantContext);
  return (
    <div
      data-slot="dialog-header"
      data-variant={variant}
      className={cn(
        "flex items-start gap-4 px-6 py-4 border-b border-line-soft/25",
        variantHeaderBg[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("relative z-[2] px-6 py-5 flex flex-col gap-4", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "relative z-[2] flex flex-col-reverse gap-3 border-t border-line-soft/25 bg-surface-panel px-6 py-4",
        "sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  const variant = React.useContext(DialogVariantContext);
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base font-bold uppercase tracking-tight text-text-high",
        className,
      )}
      data-variant={variant}
      {...props}
    />
  );
}

function DialogTag({ className, ...props }: React.ComponentProps<"p">) {
  const variant = React.useContext(DialogVariantContext);
  return (
    <p
      data-slot="dialog-tag"
      className={cn(
        "font-heading text-[10px] uppercase tracking-widest mt-1",
        variantAccentText[variant],
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("font-body text-sm leading-relaxed text-text-low", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTag,
  DialogTitle,
  DialogTrigger,
};
