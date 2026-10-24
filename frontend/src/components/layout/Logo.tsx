import { cn } from "@/lib/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 via-orange-500 to-pink-500 shadow-lg shadow-orange-500/30">
        <svg viewBox="0 0 24 24" fill="none" className="size-5 text-slate-950" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="currentColor" />
        </svg>
      </span>
      <span className="font-display text-lg font-semibold tracking-tight text-white">
        Travel Journal
      </span>
    </span>
  );
}
