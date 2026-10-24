"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "block w-full rounded-xl border-0 bg-white/6 px-3.5 py-2.5 text-sm text-white ring-1 ring-inset placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:outline-none";

interface FieldShellProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  id: string;
  children: ReactNode;
}

function FieldShell({ label, error, hint, id, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-300">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends ComponentProps<"input"> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

// A password field gets a show/hide toggle; every other type renders as a plain input.
export function TextField({ label, error, hint, className, type, ...props }: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <FieldShell label={label} error={error} hint={hint} id={id}>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            CONTROL,
            isPassword && "pr-11",
            error ? "ring-red-400/60 focus:ring-red-400" : "ring-white/15 focus:ring-orange-400",
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-slate-400 transition hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-400"
          >
            <EyeIcon off={revealed} />
          </button>
        )}
      </div>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends ComponentProps<"textarea"> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

export function TextAreaField({ label, error, hint, className, ...props }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} id={id}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          CONTROL,
          error ? "ring-red-400/60 focus:ring-red-400" : "ring-white/15 focus:ring-orange-400",
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
}
