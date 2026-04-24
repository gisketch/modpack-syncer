import { Package } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [iconUrl]);

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden bg-transparent",
        className,
      )}
    >
      {iconUrl && !imageFailed ? (
        <img
          src={iconUrl}
          alt={`${name} icon`}
          className={cn("size-full object-cover", imageClassName)}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Package className={cn("size-5 text-text-low", fallbackClassName)} />
      )}
    </div>
  );
}