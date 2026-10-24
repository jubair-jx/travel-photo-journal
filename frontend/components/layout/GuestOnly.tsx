"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { useAppSelector } from "@/store/hooks";

// Login and register are for people who are not signed in; anyone who is goes straight to the journal.
export function GuestOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAppSelector((state) => state.auth.status);

  useEffect(() => {
    if (status === "authenticated") router.replace("/photos");
  }, [status, router]);

  if (status !== "anonymous") return <FullPageSpinner />;
  return children;
}
