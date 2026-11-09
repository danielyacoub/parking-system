"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CarFrontIcon,
  DoorOpenIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  LoaderCircleIcon,
  LogOutIcon,
  ShieldCheckIcon,
  SquareParkingIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const monitorItems = [
  {
    href: "/dashboard",
    label: "Live dashboard",
    icon: LayoutDashboardIcon,
  },
] as const;

const adminItems = [
  {
    href: "/admin",
    label: "Overview",
    icon: ShieldCheckIcon,
  },
  {
    href: "/admin/slots",
    label: "Parking slots",
    icon: CarFrontIcon,
  },
  {
    href: "/admin/gates",
    label: "Gate logs",
    icon: DoorOpenIcon,
  },
  {
    href: "/admin/activity",
    label: "Slot history",
    icon: HistoryIcon,
  },
] as const;

function isItemActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  authenticated: initialAuthenticated,
}: {
  authenticated?: boolean;
}) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(
    initialAuthenticated ?? null,
  );
  const [loggingOut, setLoggingOut] = useState(false);

  const showAdmin = authenticated === true;

  useEffect(() => {
    if (initialAuthenticated !== undefined) {
      return;
    }

    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = (await response.json()) as { authenticated?: boolean };

        if (!cancelled) {
          setAuthenticated(response.ok && data.authenticated === true);
        }
      } catch {
        if (!cancelled) {
          setAuthenticated(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [initialAuthenticated]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      // Full navigation so the server re-checks the cleared session and no
      // cached admin page remains visible.
      window.location.replace("/admin/login");
    }
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border/70 px-2 py-3">
        <div className="flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground group-data-[collapsible=icon]:hidden">
            <SquareParkingIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold text-sm">HK Parking</span>
            <span className="truncate text-[11px] text-muted-foreground">
              Operations console
            </span>
          </span>
          <SidebarTrigger className="shrink-0 group-data-[collapsible=icon]:mx-auto" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1 py-2">
        <SidebarGroup>
          <SidebarGroupLabel>Monitoring</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {monitorItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(pathname, item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(pathname, item.href);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-2">
        <SidebarMenu>
          {authenticated === null ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-muted-foreground"
                disabled
                tooltip="Checking admin session"
              >
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
                <span>Checking access…</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : showAdmin ? (
            <>
              <SidebarMenuItem>
                <div
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  title="Signed in as admin"
                >
                  <ShieldCheckIcon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">
                    Signed in as admin
                  </span>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={cn(
                    "text-muted-foreground hover:text-destructive",
                    loggingOut && "opacity-60",
                  )}
                  disabled={loggingOut}
                  onClick={handleLogout}
                  tooltip="Log out"
                >
                  {loggingOut ? (
                    <LoaderCircleIcon
                      aria-hidden="true"
                      className="animate-spin"
                    />
                  ) : (
                    <LogOutIcon aria-hidden="true" />
                  )}
                  <span>{loggingOut ? "Signing out…" : "Log out"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Admin sign in">
                <Link href="/admin">
                  <ShieldCheckIcon aria-hidden="true" />
                  <span>Admin sign in</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
