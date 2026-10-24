import type { Metadata } from "next";
import { SessionsPanel } from "@/components/security/SessionsPanel";
import { TwoFactorPanel } from "@/components/security/TwoFactorPanel";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <TwoFactorPanel />
      <SessionsPanel />
    </div>
  );
}
