import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "error" | "success" | "info";

const TONES: Record<Tone, string> = {
  error: "bg-red-500/10 text-red-200 ring-red-400/30",
  success: "bg-emerald-500/10 text-emerald-200 ring-emerald-400/30",
  info: "bg-sky-500/10 text-sky-200 ring-sky-400/30",
};

export function Alert({
  tone = "error",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-xl px-4 py-3 text-sm ring-1 ring-inset", TONES[tone], className)}
    >
      {children}
    </div>
  );
}
