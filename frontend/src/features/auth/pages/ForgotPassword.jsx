import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, GalleryVerticalEnd, Mail, Send } from "lucide-react"

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

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus("loading")
    setMessage("")

    try {
      const res = await api.forgotPassword(email)
      setStatus("success")
      setMessage(res?.message || "Reset email sent successfully.")
    } catch (err) {
      setStatus("error")
      setMessage(err.message || "Failed to send reset email.")
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link to="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>
          IELTS Hub
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Forgot password</CardTitle>
            <CardDescription>
              Enter your email and we will send a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === "success" ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Mail className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Check your email</p>
                  <p className="text-sm text-muted-foreground">
                    {message}
                  </p>
                  <p className="text-sm font-medium">{email}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStatus("idle")
                    setMessage("")
                  }}
                >
                  Try another email
                </Button>
                <Button asChild className="w-full">
                  <Link to="/login">
                    <ArrowLeft className="mr-1 size-4" />
                    Back to login
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="m@example.com"
                      autoFocus
                      required
                    />
                  </Field>

                  {status === "error" ? (
                    <FieldDescription className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-destructive">
                      {message}
                    </FieldDescription>
                  ) : null}

                  <Field>
                    <Button type="submit" className="w-full" disabled={status === "loading"}>
                      {status === "loading" ? "Sending link..." : "Send reset link"}
                      {status === "loading" ? null : <Send className="ml-1 size-4" />}
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

        <FieldDescription className="px-6 text-center">
          Need help? Contact your administrator if you do not receive the reset email.
        </FieldDescription>
      </div>
    </div>
  )
}
