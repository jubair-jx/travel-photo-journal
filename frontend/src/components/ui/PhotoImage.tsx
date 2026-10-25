"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface PhotoImageProps {
  src: string;
  alt: string;
  className?: string;
  // Called when the image could not be loaded, e.g. so the owner can fetch fresh signed links.
  onFailure?: () => void;
}

// An image that never leaves a broken-image icon behind: if the file cannot be loaded (an expired
// signed link, a deleted file, no connection) a quiet placeholder takes its place. A new `src`
// (for example after the links are refreshed) gets another chance.
export function PhotoImage({ src, alt, className, onFailure }: PhotoImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <span
        role="img"
        aria-label={`${alt} (image unavailable)`}
        className={cn(
          "flex items-center justify-center bg-slate-800 text-xs text-slate-400",
          className,
        )}
      >
        Image unavailable
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs from a configurable host, so next/image's host allow-list does not fit
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => {
        setFailedSrc(src);
        onFailure?.();
      }}
      className={className}
    />
  );
}
