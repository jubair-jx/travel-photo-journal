"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// A page inside the signed-in area crashed. The header and navigation stay, so the user can move
// to another page or try again without losing their place in the app.
export default function AppErrorPage({
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
    <Card className="mx-auto max-w-md space-y-4 text-center">
      <h1 className="font-display text-3xl font-semibold text-white">Something went wrong</h1>
      <p className="text-sm text-slate-300">
        This page hit an unexpected problem. Your photos are not affected. You can try again or use
        the menu above.
      </p>
      <Button onClick={reset}>Try again</Button>
    </Card>
  );
}
