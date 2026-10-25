"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// The last line of defence for anything that throws while rendering a page: a calm message and a
// way back, instead of a blank screen.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full space-y-4 text-center">
        <h1 className="font-display text-3xl font-semibold text-white">Something went wrong</h1>
        <p className="text-sm text-slate-300">
          This page hit an unexpected problem. Your photos are not affected.
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </Card>
    </main>
  );
}
