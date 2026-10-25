"use client";

import "./globals.css";

// Replaces the whole document when even the root layout fails, so it carries its own <html>.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full items-center justify-center bg-[#070b14] px-4 font-sans text-slate-100 antialiased">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-3xl font-semibold text-white">Something went wrong</h1>
          <p className="text-sm text-slate-300">
            The app could not load. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer rounded-xl bg-linear-to-r from-amber-400 via-orange-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-slate-950"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
