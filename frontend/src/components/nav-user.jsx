"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ChevronsUpDown,
  Check,
  Loader2,
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

const ADMIN_THEME_STORAGE_KEY = "admin_sidebar_theme_color"
const ADMIN_THEME_OPTIONS = [
  { value: "#111111", label: "Black" },
  { value: "#2057E0", label: "Blue" },
  { value: "#6A7E3F", label: "Olive" },
  { value: "#FFB2B2", label: "Pink" },
]
const DASHBOARD_CHART_PALETTES = {
  "#2057E0": { submitted: "#2B7FFF", notSubmitted: "#8EC5FF" },
  "#111111": { submitted: "#2F2F2F", notSubmitted: "#8A94A6" },
  "#6A7E3F": { submitted: "#6F8F3D", notSubmitted: "#BFD79A" },
  "#FFB2B2": { submitted: "#E77F95", notSubmitted: "#FFD9E1" },
}

function normalizeHexColor(value) {
  const raw = String(value || "").trim().toUpperCase()
  const shortHexMatch = raw.match(/^#([0-9A-F]{3})$/)
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split("")
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (/^#[0-9A-F]{6}$/.test(raw)) return raw
  return ""
}

function hexToRgb(value) {
  const normalized = normalizeHexColor(value)
  if (!normalized) return null
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  return { r, g, b }
}

function toHex({ r, g, b }) {
  const toChannel = (channel) => {
    const bounded = Math.max(0, Math.min(255, Math.round(channel)))
    return bounded.toString(16).padStart(2, "0")
  }
  return `#${toChannel(r)}${toChannel(g)}${toChannel(b)}`.toUpperCase()
}

function darkenHex(value, ratio = 0.18) {
  const rgb = hexToRgb(value)
  if (!rgb) return value
  return toHex({
    r: rgb.r * (1 - ratio),
    g: rgb.g * (1 - ratio),
    b: rgb.b * (1 - ratio),
  })
}

function lightenHex(value, ratio = 0.5) {
  const rgb = hexToRgb(value)
  if (!rgb) return value
  return toHex({
    r: rgb.r + (255 - rgb.r) * ratio,
    g: rgb.g + (255 - rgb.g) * ratio,
    b: rgb.b + (255 - rgb.b) * ratio,
  })
}

function getReadableForeground(value) {
  const rgb = hexToRgb(value)
  if (!rgb) return "#FFFFFF"
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.72 ? "#0F172A" : "#FFFFFF"
}

function resolveDashboardChartPalette(value) {
  const normalized = normalizeHexColor(value)
  if (!normalized) {
    return DASHBOARD_CHART_PALETTES["#2057E0"]
  }

  if (DASHBOARD_CHART_PALETTES[normalized]) {
    return DASHBOARD_CHART_PALETTES[normalized]
  }

  return {
    submitted: darkenHex(normalized, 0.06),
    notSubmitted: lightenHex(normalized, 0.56),
  }
}

function applyAdminThemeColor(value) {
  if (typeof document === "undefined") return
  const normalized = normalizeHexColor(value) || ADMIN_THEME_OPTIONS[0].value
  const rgb = hexToRgb(normalized)
  if (!rgb) return
  const chartPalette = resolveDashboardChartPalette(normalized)

  document.documentElement.style.setProperty("--admin-shell-theme-accent", normalized)
  document.documentElement.style.setProperty("--admin-shell-theme-accent-strong", darkenHex(normalized, 0.18))
  document.documentElement.style.setProperty("--admin-shell-theme-accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`)
  document.documentElement.style.setProperty("--admin-shell-theme-accent-shadow", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.34)`)
  document.documentElement.style.setProperty("--admin-shell-theme-accent-foreground", getReadableForeground(normalized))
  document.documentElement.style.setProperty("--staff-dashboard-chart-submitted", chartPalette.submitted)
  document.documentElement.style.setProperty("--staff-dashboard-chart-not-submitted", chartPalette.notSubmitted)
}

export function NavUser({
  user,
  onLogout,
  isLoggingOut = false,
}) {
  const { isMobile } = useSidebar()
  const [selectedThemeColor, setSelectedThemeColor] = useState(ADMIN_THEME_OPTIONS[0].value)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = normalizeHexColor(window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY))
    const fallback = ADMIN_THEME_OPTIONS[0].value
    const nextColor = ADMIN_THEME_OPTIONS.some((option) => option.value === stored) ? stored : fallback
    setSelectedThemeColor(nextColor)
    applyAdminThemeColor(nextColor)
  }, [])

  const handleThemeColorChange = (nextColor) => {
    const normalized = normalizeHexColor(nextColor)
    if (!normalized) return
    setSelectedThemeColor(normalized)
    applyAdminThemeColor(normalized)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, normalized)
    }
  }

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

  const handleOpenLogoutDialog = (event) => {
    event.preventDefault()
    if (isLoggingOut) return
    setIsLogoutDialogOpen(true)
  }

  const handleConfirmLogout = () => {
    if (isLoggingOut) return
    setIsLogoutDialogOpen(false)
    if (typeof onLogout === "function") onLogout()
  }

  return (
    <>
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
              <div className="px-2 py-1.5">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Theme Color</p>
                <div className="flex items-center gap-2">
                  {ADMIN_THEME_OPTIONS.map((option) => {
                    const isSelected = selectedThemeColor === option.value
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Use ${option.label} theme`}
                        onClick={() => handleThemeColorChange(option.value)}
                        className="h-7 w-7 rounded-full border-2 p-0"
                        style={{
                          backgroundColor: option.value,
                          borderColor: isSelected ? getReadableForeground(option.value) : "transparent",
                          color: getReadableForeground(option.value),
                        }}
                      >
                        {isSelected ? <Check className="size-3.5 text-current" /> : <span className="sr-only">{option.label}</span>}
                      </Button>
                    )
                  })}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleOpenLogoutDialog}
                disabled={isLoggingOut}
                className="text-rose-600 focus:text-rose-600"
              >
                <LogOut />
                {isLoggingOut ? "Logging out..." : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out of this account?</AlertDialogTitle>
            <AlertDialogDescription>
              You can sign in again at any time. Unsaved actions may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLogout}
              disabled={isLoggingOut}
              className="bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" />
                  Logging out...
                </>
              ) : (
                "Log out"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
