"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { errorMessage } from "@/lib/errors";
import { useVerifyEmailMutation } from "@/store/api";
import { ResendVerification } from "./ResendVerification";

export function VerifyEmailPanel() {
  const token = useSearchParams().get("token");
  const [verify, { isSuccess, isError, error, isUninitialized }] = useVerifyEmailMutation();
  // A token works exactly once. React strict mode runs effects twice in development, and a second
  // request would turn a success into "already used", so the call is guarded.
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;
    void verify({ token });
  }, [token, verify]);

  if (!token) {
    return (
      <div className="space-y-4">
        <Alert>
          This link is missing its token. Use the link from your email, or ask for a new one.
        </Alert>
        <ResendVerification />
      </div>
    );
  }

  if (isUninitialized || (!isSuccess && !isError)) {
    return (
      <div className="flex items-center gap-3 text-slate-600">
        <Spinner />
        <span>Verifying your email…</span>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="space-y-4">
        <Alert tone="success">Your email is verified. You can sign in now.</Alert>
        <Link
          href="/login"
          className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>{errorMessage(error)}</Alert>
      <p className="text-sm text-slate-600">
        Links work once and expire after 24 hours. Get a fresh one:
      </p>
      <ResendVerification />
    </div>
  );
}
