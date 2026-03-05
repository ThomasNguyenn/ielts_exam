"use client"

import { useMemo } from "react"
import {
  ChevronsUpDown,
  LogOut,
  Settings,
} from "lucide-react"
import { Link } from "react-router-dom"
import {
  createAvatarUrl,
  fallbackAvatarSeed,
  sanitizeAvatarSeed,
} from "@/features/profile/profile.helpers"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser({
  user,
  onLogout,
  isLoggingOut = false,
}) {
  const { isMobile } = useSidebar()
  const avatarSrc = useMemo(() => {
    const seed = String(user?.avatarSeed || "").trim()
    if (seed) {
      return createAvatarUrl(sanitizeAvatarSeed(seed, fallbackAvatarSeed(user || {})))
    }

    const directAvatar = String(user?.avatar || user?.avatarUrl || user?.photoURL || "").trim()
    if (directAvatar) return directAvatar

    return createAvatarUrl(fallbackAvatarSeed(user || {}))
  }, [user])

  const fallbackInitials = useMemo(() => {
    const parts = String(user?.name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
    if (!parts.length) return "U"
    return parts.map((part) => part.charAt(0).toUpperCase()).join("")
  }, [user?.name])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatarSrc} alt={user?.name || "User"} />
                <AvatarFallback className="rounded-lg">{fallbackInitials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user?.name || "User"}</span>
                <span className="truncate text-xs">{user?.email || "-"}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatarSrc} alt={user?.name || "User"} />
                  <AvatarFallback className="rounded-lg">{fallbackInitials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user?.name || "User"}</span>
                  <span className="truncate text-xs">{user?.email || "-"}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onLogout}
              disabled={isLoggingOut}
            >
              <LogOut />
              {isLoggingOut ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
