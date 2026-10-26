"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { ServiceDown } from "@/components/layout/ServiceDown";
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

  if (status === "unavailable") return <ServiceDown />;
  if (status !== "authenticated") return <FullPageSpinner />;

  const signOut = async () => {
    await logout();
    toast.success("Signed out");
    router.replace("/login");
  };

  const initial = user?.email.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto flex max-w-6xl items-center gap-2 rounded-2xl bg-white/6 px-3 py-2 ring-1 ring-white/10 backdrop-blur-xl sm:gap-4 sm:px-4 sm:py-2.5">
          <Link href="/photos" aria-label="Travel Journal home">
            <Logo compact />
          </Link>
          <nav aria-label="Main" className="ml-1 flex gap-0.5 sm:ml-4 sm:gap-1">
            {LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-sm font-medium transition sm:px-3.5",
                    active
                      ? "bg-white/12 text-white"
                      : "text-slate-400 hover:bg-white/8 hover:text-white",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden max-w-48 truncate text-sm text-slate-400 md:inline">
              {user?.email}
            </span>
            <span
              aria-hidden="true"
              className="hidden size-9 items-center justify-center rounded-full sm:flex bg-linear-to-br from-sky-400 to-fuchsia-500 text-sm font-semibold text-white"
            >
              {initial}
            </span>
            <Button
              variant="secondary"
              onClick={signOut}
              loading={isLoading}
              aria-label="Sign out"
              className="px-3 sm:px-4"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 sm:hidden"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}
