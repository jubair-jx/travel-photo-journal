"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { applyFieldIssues, errorMessage, isApiError } from "@/lib/errors";
import { loginSchema, totpCodeSchema, type LoginValues } from "@/lib/schemas";
import { useLoginMutation } from "@/store/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { emailForgotten, emailRemembered } from "@/store/slices";
import { ResendVerification } from "./ResendVerification";

export function LoginForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const rememberedEmail = useAppSelector((state) => state.ui.lastEmail);
  const [login, { isLoading }] = useLoginMutation();

  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [remember, setRemember] = useState(rememberedEmail !== null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: rememberedEmail ?? "", password: "" },
  });

  const attempt = async (values: LoginValues, totpCode?: string) => {
    setFailure(null);
    setUnverified(false);
    const result = await login({ ...values, ...(totpCode && { totpCode }) });

    if ("data" in result) {
      dispatch(remember ? emailRemembered(values.email) : emailForgotten());
      toast.success("Welcome back");
      router.replace("/photos");
      return;
    }

    const error = result.error;
    if (!isApiError(error)) {
      setFailure(errorMessage(error));
    } else if (error.code === "TOTP_REQUIRED") {
      setStep("code");
    } else if (error.code === "EMAIL_NOT_VERIFIED") {
      setUnverified(true);
      setFailure(error.message);
    } else if (!applyFieldIssues(error, setError, ["email", "password"])) {
      // A wrong code is deliberately indistinguishable from a wrong password (see the API docs).
      setFailure(error.message);
    }
  };

  const submitCredentials = (values: LoginValues) => attempt(values);

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = totpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message);
      return;
    }
    setCodeError(undefined);
    await attempt(getValues(), parsed.data);
  };

  if (step === "code") {
    return (
      <form onSubmit={submitCode} noValidate className="space-y-4">
        <p className="text-sm text-slate-300">
          Enter the 6-digit code from your authenticator app to finish signing in.
        </p>
        {failure && <Alert>{failure}</Alert>}
        <TextField
          label="Authentication code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          value={code}
          error={codeError}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        />
        <div className="flex gap-3">
          <Button type="submit" loading={isLoading} className="flex-1">
            Verify and sign in
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setStep("credentials");
              setCode("");
              setFailure(null);
            }}
          >
            Back
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(submitCredentials)} noValidate className="space-y-4">
      {failure && <Alert>{failure}</Alert>}
      {unverified && <ResendVerification email={getValues("email")} />}
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="size-4 cursor-pointer rounded border-white/20 bg-white/5 accent-orange-500"
        />
        Remember my email on this device
      </label>
      <Button type="submit" loading={isLoading} className="w-full">
        Sign in
      </Button>
      <p className="text-center text-sm text-slate-300">
        New here?{" "}
        <Link
          href="/register"
          className="font-medium text-orange-300 hover:text-orange-200 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
