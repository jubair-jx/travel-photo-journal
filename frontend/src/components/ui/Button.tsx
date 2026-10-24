import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-linear-to-r from-amber-400 via-orange-500 to-pink-500 font-semibold text-slate-950 shadow-lg shadow-orange-500/25 hover:brightness-110 focus-visible:outline-orange-400",
  secondary:
    "bg-white/6 text-slate-100 ring-1 ring-inset ring-white/15 hover:bg-white/12 focus-visible:outline-orange-400",
  danger: "bg-red-500 text-white hover:bg-red-400 focus-visible:outline-red-400",
  ghost: "text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-orange-400",
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
