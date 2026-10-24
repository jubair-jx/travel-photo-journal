import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:outline-none";

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
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-600">
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

export function TextField({ label, error, hint, className, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} id={id}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          CONTROL,
          error ? "ring-red-400 focus:ring-red-500" : "ring-slate-300 focus:ring-indigo-600",
          className,
        )}
        {...props}
      />
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
          error ? "ring-red-400 focus:ring-red-500" : "ring-slate-300 focus:ring-indigo-600",
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
}
