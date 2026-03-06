import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, CheckCircle2, GalleryVerticalEnd, Lock, Loader2 } from "lucide-react"

import { api } from "@/shared/api/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = String(searchParams.get("token") || "").trim()
  const navigate = useNavigate()
  const redirectTimeoutRef = useRef(null)

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState("idle")
  const [message, setMessage] = useState("")

  useEffect(() => () => {
    if (redirectTimeoutRef.current) {
      window.clearTimeout(redirectTimeoutRef.current)
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (newPassword !== confirmPassword) {
      setStatus("error")
      setMessage("Passwords do not match.")
      return
    }

    if (newPassword.length < 6) {
      setStatus("error")
      setMessage("Password must be at least 6 characters.")
      return
    }

    setStatus("loading")
    setMessage("")

    try {
      const res = await api.resetPassword(token, newPassword)
      setStatus("success")
      setMessage(res?.message || "Password reset successfully.")
      redirectTimeoutRef.current = window.setTimeout(() => {
        navigate("/login")
      }, 3000)
    } catch (err) {
      setStatus("error")
      setMessage(err.message || "Failed to reset password.")
    }
  }

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
            <CardTitle className="text-xl">Reset password</CardTitle>
            <CardDescription>Set a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="space-y-4">
                <FieldDescription className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-destructive">
                  Invalid request. No token provided.
                </FieldDescription>
                <Button asChild className="w-full">
                  <Link to="/login">
                    <ArrowLeft className="mr-1 size-4" />
                    Back to login
                  </Link>
                </Button>
              </div>
            ) : status === "success" ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Password reset complete</p>
                  <p className="text-sm text-muted-foreground">{message}</p>
                  <p className="text-xs text-muted-foreground">Redirecting to login...</p>
                </div>
                <Button asChild className="w-full">
                  <Link to="/login">Login now</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="new-password">New password</FieldLabel>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="pl-9"
                        autoFocus
                        required
                      />
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="pl-9"
                        required
                      />
                    </div>
                  </Field>

                  {status === "error" ? (
                    <FieldDescription className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-destructive">
                      {message}
                    </FieldDescription>
                  ) : null}

                  <FieldDescription>Use at least 6 characters.</FieldDescription>

                  <Field>
                    <Button type="submit" className="w-full" disabled={status === "loading"}>
                      {status === "loading" ? (
                        <>
                          <Loader2 className="mr-1 size-4 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        "Reset password"
                      )}
                    </Button>
                  </Field>

                  <FieldDescription className="text-center">
                    <Link to="/login" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                      <ArrowLeft className="size-3.5" />
                      Back to login
                    </Link>
                  </FieldDescription>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
