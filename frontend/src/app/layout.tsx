import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { Backdrop } from "@/components/layout/Backdrop";
import { StoreProvider } from "@/store/StoreProvider";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: { default: "Travel Photo Journal", template: "%s · Travel Photo Journal" },
  description: "A private journal for your travel photos.",
};

export const viewport: Viewport = { colorScheme: "dark", themeColor: "#070b14" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full bg-[#070b14] font-sans text-slate-100 antialiased selection:bg-orange-400/30">
        <Backdrop />
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
