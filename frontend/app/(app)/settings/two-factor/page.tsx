import type { Metadata } from "next";
import { TwoFactorPanel } from "@/components/security/TwoFactorPanel";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default function TwoFactorPage() {
  return <TwoFactorPanel />;
}
