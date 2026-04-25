import { Package } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function PackIcon({
  iconUrl,
  name,
  className,
  imageClassName,
  fallbackClassName,
}: {
  iconUrl?: string | null;
  name: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
}) {
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null);
  const showImage = !!iconUrl && failedIconUrl !== iconUrl;

  return (
    <div
      className={cn("flex items-center justify-center overflow-hidden bg-transparent", className)}
    >
      {showImage ? (
        <img
          src={iconUrl}
          alt={`${name} icon`}
          className={cn("size-full object-cover", imageClassName)}
          loading="lazy"
          onError={() => setFailedIconUrl(iconUrl ?? null)}
        />
      ) : (
        <Package className={cn("size-5 text-text-low", fallbackClassName)} />
      )}
    </div>
  );
}
