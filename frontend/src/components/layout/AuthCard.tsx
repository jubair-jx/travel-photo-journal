import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Logo } from "./Logo";

const HIGHLIGHTS = [
  "Private by default: only you can see your photos",
  "A short summary written for every memory",
  "Two-factor sign-in to keep it that way",
];

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
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-4 py-10 lg:grid-cols-2 lg:px-8">
      <section className="hidden lg:block">
        <Link href="/" aria-label="Travel Journal home">
          <Logo />
        </Link>
        <h2 className="mt-10 font-display text-6xl leading-[1.05] font-semibold tracking-tight text-white">
          Keep the places{" "}
          <span className="bg-linear-to-r from-amber-300 via-orange-400 to-pink-400 bg-clip-text text-transparent italic">
            you&apos;ve been
          </span>
          .
        </h2>
        <p className="mt-6 max-w-md text-lg text-slate-300">
          A quiet, private home for your travel photos, with the story behind each one.
        </p>
        <ul className="mt-10 space-y-3">
          {HIGHLIGHTS.map((line) => (
            <li key={line} className="flex items-center gap-3 text-slate-300">
              <span className="size-1.5 rounded-full bg-linear-to-r from-amber-400 to-pink-500" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col items-center">
        <Link href="/" className="mb-8 lg:hidden" aria-label="Travel Journal home">
          <Logo />
        </Link>
        <Card className="w-full max-w-md p-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-2 mb-7 text-sm text-slate-300">{subtitle}</p>}
          {!subtitle && <div className="mb-7" />}
          {children}
        </Card>
      </div>
    </main>
  );
}
