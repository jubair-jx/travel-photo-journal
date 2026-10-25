import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full space-y-4 text-center">
        <p className="text-sm font-medium tracking-widest text-orange-300 uppercase">404</p>
        <h1 className="font-display text-3xl font-semibold text-white">Lost along the way</h1>
        <p className="text-sm text-slate-300">That page does not exist or has moved.</p>
        <Link
          href="/"
          className="inline-flex cursor-pointer rounded-xl bg-linear-to-r from-amber-400 via-orange-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-500/20 transition hover:brightness-110"
        >
          Back to the journal
        </Link>
      </Card>
    </main>
  );
}
