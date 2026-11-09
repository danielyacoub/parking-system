import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({
  children,
  authenticated,
}: {
  children: ReactNode;
  authenticated?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider className="bg-sidebar">
        <AppSidebar authenticated={authenticated} />
        <SidebarInset className="min-w-0 bg-muted/25">
          <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:hidden">
            <SidebarTrigger />
            <span className="font-semibold text-sm">HK Parking</span>
          </div>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
