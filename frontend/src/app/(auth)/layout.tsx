import { GuestOnly } from "@/components/layout/GuestOnly";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <GuestOnly>{children}</GuestOnly>;
}
