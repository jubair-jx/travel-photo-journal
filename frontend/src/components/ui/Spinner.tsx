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

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-orange-400">
      <Spinner className="size-8" label="Loading your session" />
    </div>
  );
}
