import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthCard } from "@/components/layout/AuthCard";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard title="Sign in" subtitle="Welcome back to your journal.">
      <LoginForm />
    </AuthCard>
  );
}
