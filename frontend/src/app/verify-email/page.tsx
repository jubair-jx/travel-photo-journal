import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailPanel } from "@/components/auth/VerifyEmailPanel";
import { AuthCard } from "@/components/layout/AuthCard";
import { Spinner } from "@/components/ui/Spinner";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Verify your email">
      {/* useSearchParams needs a Suspense boundary so the page can still be prerendered. */}
      <Suspense fallback={<Spinner />}>
        <VerifyEmailPanel />
      </Suspense>
    </AuthCard>
  );
}
