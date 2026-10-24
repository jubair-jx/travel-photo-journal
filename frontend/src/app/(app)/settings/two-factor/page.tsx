import type { Metadata } from "next";
import { SessionsPanel } from "@/components/security/SessionsPanel";
import { TwoFactorPanel } from "@/components/security/TwoFactorPanel";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <>
      <TwoFactorPanel />
      <SessionsPanel />
    </>
  );
}
