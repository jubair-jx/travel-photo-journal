import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthCard } from "@/components/layout/AuthCard";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthCard title="Create your account" subtitle="Keep your travel photos private and organized.">
      <RegisterForm />
    </AuthCard>
  );
}
