"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { errorMessage } from "@/lib/errors";
import { resendSchema, type ResendValues } from "@/lib/schemas";
import { useResendVerificationMutation } from "@/store/api";

// Asks the server for a fresh verification link. The server answers identically whether or not the
// address has an unverified account, and so does this component.
export function ResendVerification({ email }: { email?: string }) {
  const [resend, { isLoading }] = useResendVerificationMutation();
  const [done, setDone] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResendValues>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: email ?? "" },
  });

  const send = async (values: ResendValues) => {
    setFailure(null);
    const result = await resend(values);
    if ("error" in result) {
      setFailure(errorMessage(result.error));
      return;
    }
    setDone(result.data.message);
    toast.success("If that account needs verifying, a new link is on its way.");
  };

  if (done) return <Alert tone="success">{done}</Alert>;

  return (
    <form onSubmit={handleSubmit(send)} noValidate className="space-y-3">
      {failure && <Alert>{failure}</Alert>}
      {!email && (
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
      )}
      <Button type="submit" variant="secondary" loading={isLoading}>
        Resend verification email
      </Button>
    </form>
  );
}
