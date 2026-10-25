"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { useAppSelector } from "@/store/hooks";

export function HomeRedirect() {
  const router = useRouter();
  const status = useAppSelector((state) => state.auth.status);

  useEffect(() => {
    if (status === "authenticated") router.replace("/photos");
    if (status === "anonymous" || status === "unavailable") router.replace("/login");
  }, [status, router]);

  return <FullPageSpinner />;
}
