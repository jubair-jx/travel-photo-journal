import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-6 text-lg font-semibold text-indigo-600">
        Travel Photo Journal
      </Link>
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 mb-6 text-sm text-slate-600">{subtitle}</p>}
        {!subtitle && <div className="mb-6" />}
        {children}
      </Card>
    </main>
  );
}
