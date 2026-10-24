import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-white/6 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}
