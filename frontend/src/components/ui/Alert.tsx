import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "error" | "success" | "info";

const TONES: Record<Tone, string> = {
  error: "bg-red-50 text-red-800 ring-red-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  info: "bg-indigo-50 text-indigo-800 ring-indigo-200",
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
      className={cn("rounded-lg px-4 py-3 text-sm ring-1 ring-inset", TONES[tone], className)}
    >
      {children}
    </div>
  );
}
