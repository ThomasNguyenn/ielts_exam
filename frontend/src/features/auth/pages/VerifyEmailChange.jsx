import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  GalleryVerticalEnd,
  Loader2,
  XCircle,
} from "lucide-react"

import { api } from "@/shared/api/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function VerifyEmailChange() {
  const [searchParams] = useSearchParams()
  const token = String(searchParams.get("token") || "").trim()
  const [status, setStatus] = useState("loading")
  const [message, setMessage] = useState("Verifying your email change...")

  useEffect(() => {
    let active = true

    const run = async () => {
      if (!token) {
        if (!active) return
        setStatus("error")
        setMessage("Missing verification token.")
        return
      }

      try {
        const res = await api.confirmEmailChange(token)
        if (!res?.success) {
          throw new Error("Unable to verify email change.")
        }

        await api.logout().catch(() => {
          api.removeToken()
          api.removeUser()
        })

        if (!active) return
        setStatus("success")
        setMessage("Email updated successfully. Please log in again.")
      } catch (error) {
        if (!active) return
        setStatus("error")
        setMessage(error?.message || "Email verification failed. Token may be invalid or expired.")
      }
    }

    void run()
    return () => {
      active = false
    }
  }, [token])

  const icon = status === "loading"
    ? <Loader2 className="size-8 animate-spin text-zinc-500" />
    : status === "success"
      ? <CheckCircle2 className="size-8 text-emerald-600" />
      : <XCircle className="size-8 text-rose-600" />

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link to="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>
          IELTS Pro
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Verify email change</CardTitle>
            <CardDescription>Confirming ownership of your new email address.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
              {icon}
              <p className="text-sm text-zinc-700">{message}</p>
            </div>

            <div className="flex justify-center">
              {status === "success" ? (
                <Button asChild className="w-full">
                  <Link to="/login">Go to login</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login">
                    <ArrowLeft className="mr-1 size-4" />
                    Back to login
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
