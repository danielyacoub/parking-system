import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Reaching this layout means proxy.ts already validated the session.
  return <AppShell authenticated>{children}</AppShell>;
}
