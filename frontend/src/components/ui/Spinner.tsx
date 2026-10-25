"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <svg
        className={cn("size-5 animate-spin text-current", className)}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          className="opacity-25"
        />
        <path
          d="M4 12a8 8 0 0 1 8-8"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="opacity-90"
        />
      </svg>
    </span>
  );
}

// How long the wait has to last before the explanation appears: a warm server answers well within
// this, so most visitors never see the note flash by.
const NOTE_DELAY_MS = 1_500;

export function FullPageSpinner() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSlow(true);
    }, NOTE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-orange-400">
      <Spinner className="size-8" label="Loading your session" />
      <div
        aria-live="polite"
        className={cn(
          "max-w-sm rounded-2xl bg-white/6 px-5 py-4 text-center text-sm text-slate-300 ring-1 ring-white/10 backdrop-blur-xl transition-opacity duration-500",
          slow ? "opacity-100" : "opacity-0",
        )}
      >
        <p className="font-medium text-white">Waking up the server</p>
        <p className="mt-1">
          This demo runs on a free hosting plan that sleeps when idle, so the first load can take up
          to a minute. Thanks for waiting.
        </p>
      </div>
    </div>
  );
}
