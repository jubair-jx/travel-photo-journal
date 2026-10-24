"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { useLogoutMutation } from "@/store/api";
import { useAppSelector } from "@/store/hooks";

const LINKS = [
  { href: "/photos", label: "Photos" },
  { href: "/settings/two-factor", label: "Security" },
];

// Everything behind sign-in. Until the first silent refresh settles the user's state is "unknown",
// so nothing is shown (and nobody is redirected) until it is clear who is looking.
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user } = useAppSelector((state) => state.auth);
  const [logout, { isLoading }] = useLogoutMutation();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return <FullPageSpinner />;

  const signOut = async () => {
    await logout();
    toast.success("Signed out");
    router.replace("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <Link href="/photos" className="font-semibold text-indigo-600">
            Travel Photo Journal
          </Link>
          <nav aria-label="Main" className="flex gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname.startsWith(link.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  pathname.startsWith(link.href)
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{user?.email}</span>
            <Button variant="secondary" onClick={signOut} loading={isLoading}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
