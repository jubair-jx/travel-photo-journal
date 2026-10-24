"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { applyFieldIssues, errorMessage, isApiError } from "@/lib/errors";
import {
  disableTwoFactorSchema,
  twoFactorCodeSchema,
  type DisableTwoFactorValues,
  type TwoFactorCodeValues,
} from "@/lib/schemas";
import type { TwoFactorSetup } from "@/lib/types";
import {
  useDisableTwoFactorMutation,
  useSetupTwoFactorMutation,
  useTwoFactorStatusQuery,
  useVerifyTwoFactorMutation,
} from "@/store/api";

type Stage = "intro" | "scan";

function ConfirmCodeForm({ onEnabled }: { onEnabled: () => void }) {
  const [verify, { isLoading }] = useVerifyTwoFactorMutation();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TwoFactorCodeValues>({
    resolver: zodResolver(twoFactorCodeSchema),
    defaultValues: { code: "" },
  });

  const submit = async (values: TwoFactorCodeValues) => {
    setFailure(null);
    const result = await verify(values);
    if ("data" in result) {
      toast.success("Two-factor authentication is on");
      onEnabled();
      return;
    }
    const error = result.error;
    if (isApiError(error) && error.code === "INVALID_TOTP_CODE") {
      setError("code", {
        type: "server",
        message: "That code did not match. Check your app and try again.",
      });
    } else if (!isApiError(error) || !applyFieldIssues(error, setError, ["code"])) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
      {failure && <Alert>{failure}</Alert>}
      <TextField
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        error={errors.code?.message}
        {...register("code")}
      />
      <Button type="submit" loading={isLoading}>
        Turn on two-factor authentication
      </Button>
    </form>
  );
}

function DisableForm({ onCancel }: { onCancel: () => void }) {
  const [disable, { isLoading }] = useDisableTwoFactorMutation();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DisableTwoFactorValues>({
    resolver: zodResolver(disableTwoFactorSchema),
    defaultValues: { password: "", code: "" },
  });

  const submit = async (values: DisableTwoFactorValues) => {
    setFailure(null);
    const result = await disable(values);
    if ("data" in result) {
      toast.success("Two-factor authentication is off");
      return;
    }
    const error = result.error;
    if (isApiError(error) && error.code === "INCORRECT_PASSWORD") {
      setError("password", { type: "server", message: "That password is not correct." });
    } else if (isApiError(error) && error.code === "INVALID_TOTP_CODE") {
      setError("code", { type: "server", message: "That code did not match. Try the next one." });
    } else if (!isApiError(error) || !applyFieldIssues(error, setError, ["password", "code"])) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
      <p className="text-sm text-slate-300">
        Confirm it is you: enter your password and a current code from your authenticator app.
      </p>
      {failure && <Alert>{failure}</Alert>}
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <TextField
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        error={errors.code?.message}
        {...register("code")}
      />
      <div className="flex gap-3">
        <Button type="submit" variant="danger" loading={isLoading}>
          Turn off two-factor
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={
        enabled
          ? "rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30"
          : "rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-slate-300 ring-1 ring-white/15"
      }
    >
      {enabled ? "Enabled" : "Not enabled"}
    </span>
  );
}

export function TwoFactorPanel() {
  const {
    data: status,
    error: statusError,
    isLoading: loadingStatus,
    refetch,
  } = useTwoFactorStatusQuery();
  const [setup, { isLoading }] = useSetupTwoFactorMutation();
  const [stage, setStage] = useState<Stage>("intro");
  const [details, setDetails] = useState<TwoFactorSetup | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState(false);

  const enabled = status?.enabled === true;

  const start = async () => {
    setFailure(null);
    const result = await setup();
    if (!("error" in result)) {
      setDetails(result.data);
      setStage("scan");
      return;
    }
    const error = result.error;
    if (isApiError(error) && error.code === "TWO_FACTOR_ALREADY_ENABLED") {
      void refetch();
    } else {
      setFailure(errorMessage(error));
    }
  };

  const copyKey = async () => {
    if (!details) return;
    try {
      await navigator.clipboard.writeText(details.manualKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the key and copy it manually.");
    }
  };

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-white">
            Two-factor authentication
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Add a second step to signing in, using a code from an authenticator app.
          </p>
        </div>
        {status && <StatusBadge enabled={enabled} />}
      </div>

      {loadingStatus && (
        <div className="flex justify-center py-4 text-orange-400">
          <Spinner label="Loading status" />
        </div>
      )}

      {statusError && !status && (
        <div className="space-y-3">
          <Alert>{errorMessage(statusError)}</Alert>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {failure && <Alert>{failure}</Alert>}

      {status && enabled && (
        <div className="space-y-4">
          <Alert tone="success">
            Two-factor authentication is on. You will be asked for a code each time you sign in.
          </Alert>
          {confirmingOff ? (
            <DisableForm onCancel={() => setConfirmingOff(false)} />
          ) : (
            <Button variant="secondary" onClick={() => setConfirmingOff(true)}>
              Turn off two-factor
            </Button>
          )}
        </div>
      )}

      {status && !enabled && stage === "intro" && (
        <Button onClick={start} loading={isLoading}>
          Set up two-factor authentication
        </Button>
      )}

      {status && !enabled && stage === "scan" && details && (
        <div className="space-y-5">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-200">
            <li>Open an authenticator app (such as Google Authenticator or 1Password).</li>
            <li>Scan this QR code, or enter the key by hand.</li>
            <li>Type the 6-digit code the app shows to confirm.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL */}
            <img
              src={details.qrCodeDataUrl}
              alt="QR code for your authenticator app"
              width={176}
              height={176}
              className="size-44 rounded-lg ring-1 ring-white/15"
            />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-slate-200">Can&apos;t scan? Enter this key:</p>
              <code className="block rounded-lg bg-white/10 px-3 py-2 text-sm break-all text-slate-100">
                {details.manualKey}
              </code>
              <Button variant="secondary" onClick={copyKey}>
                {copied ? "Copied" : "Copy key"}
              </Button>
            </div>
          </div>
          <ConfirmCodeForm
            onEnabled={() => {
              setStage("intro");
              setDetails(null);
            }}
          />
        </div>
      )}
    </Card>
  );
}
