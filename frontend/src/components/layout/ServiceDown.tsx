"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAppDispatch } from "@/store/hooks";
import { restoreSession } from "@/store/session";

// Shown instead of the app when the session could not be checked because the server could not be
// reached. The user is not signed out; retrying is all that is needed once it is back.
export function ServiceDown() {
  const dispatch = useAppDispatch();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await restoreSession(dispatch);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full space-y-4 text-center">
        <h1 className="font-display text-3xl font-semibold text-white">
          We can&apos;t reach the server
        </h1>
        <p className="text-sm text-slate-300">
          Your journal is safe. Check your connection, or the service may be waking up. Try again in
          a moment.
        </p>
        <Button onClick={() => void retry()} loading={retrying} className="w-full">
          Try again
        </Button>
      </Card>
    </main>
  );
}
