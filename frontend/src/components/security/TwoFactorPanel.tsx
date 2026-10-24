"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { applyFieldIssues, errorMessage, isApiError } from "@/lib/errors";
import { twoFactorCodeSchema, type TwoFactorCodeValues } from "@/lib/schemas";
import type { TwoFactorSetup } from "@/lib/types";
import { useSetupTwoFactorMutation, useVerifyTwoFactorMutation } from "@/store/api";

type Stage = "intro" | "scan" | "enabled";

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

export function TwoFactorPanel() {
  const [setup, { isLoading }] = useSetupTwoFactorMutation();
  const [stage, setStage] = useState<Stage>("intro");
  const [details, setDetails] = useState<TwoFactorSetup | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      setStage("enabled");
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
    <Card className="max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold text-white">
          Two-factor authentication
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          Add a second step to signing in, using a code from an authenticator app.
        </p>
      </div>

      {failure && <Alert>{failure}</Alert>}

      {stage === "intro" && (
        <Button onClick={start} loading={isLoading}>
          Set up two-factor authentication
        </Button>
      )}

      {stage === "scan" && details && (
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
          <ConfirmCodeForm onEnabled={() => setStage("enabled")} />
        </div>
      )}

      {stage === "enabled" && (
        <Alert tone="success">
          Two-factor authentication is on. You will be asked for a code each time you sign in.
        </Alert>
      )}
    </Card>
  );
}
