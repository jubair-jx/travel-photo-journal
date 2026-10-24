"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { applyFieldIssues, isApiError } from "@/lib/errors";
import { registerSchema, type RegisterValues } from "@/lib/schemas";
import { useRegisterMutation } from "@/store/api";
import { ResendVerification } from "./ResendVerification";

export function RegisterForm() {
  const [registerAccount, { isLoading }] = useRegisterMutation();
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const submit = async ({ email, password }: RegisterValues) => {
    setFailure(null);
    const result = await registerAccount({ email, password });
    if (!("error" in result)) {
      setRegisteredEmail(result.data.email);
      return;
    }

    const error = result.error;
    if (!isApiError(error)) {
      setFailure("Something went wrong. Please try again.");
    } else if (error.code === "EMAIL_TAKEN") {
      setError("email", { type: "server", message: "An account with this email already exists" });
    } else if (!applyFieldIssues(error, setError, ["email", "password"])) {
      setFailure(error.message);
    }
  };

  if (registeredEmail) {
    return (
      <div className="space-y-4">
        <Alert tone="success">
          Account created. We sent a verification link to <strong>{registeredEmail}</strong>. Open
          it to activate your account.
        </Alert>
        <p className="text-sm text-slate-600">
          Nothing arrived? Check spam, or ask for a new link.
        </p>
        <ResendVerification email={registeredEmail} />
        <p className="text-sm text-slate-600">
          Already verified?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
      {failure && <Alert>{failure}</Alert>}
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
        autoComplete="new-password"
        hint="At least 8 characters"
        error={errors.password?.message}
        {...register("password")}
      />
      <TextField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" loading={isLoading} className="w-full">
        Create account
      </Button>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
