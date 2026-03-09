import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function SignupForm({
  className,
  form,
  loading = false,
  error = "",
  inviteLoading = false,
  inviteError = "",
  inviteData = null,
  roleLabel = "",
  onSubmit,
  onChangeName,
  onChangeEmail,
  onChangeTrack,
  onChangePassword,
  onChangeConfirmPassword,
  ...props
}) {
  const isDisabled = loading || inviteLoading || Boolean(inviteError)

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your information below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              {inviteLoading ? (
                <FieldDescription className="rounded-md border px-3 py-2 text-center">
                  Validating invitation...
                </FieldDescription>
              ) : null}

              {inviteData ? (
                <FieldDescription className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-center text-foreground">
                  Invited role: <span className="font-medium">{roleLabel}</span>
                </FieldDescription>
              ) : null}

              {inviteError ? (
                <FieldDescription className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-destructive">
                  {inviteError}
                </FieldDescription>
              ) : null}

              {error ? (
                <FieldDescription className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-destructive">
                  {error}
                </FieldDescription>
              ) : null}

              <Field>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={(event) => onChangeName?.(event.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={form.email}
                  onChange={(event) => onChangeEmail?.(event.target.value)}
                  readOnly={Boolean(inviteData)}
                  required
                />
              </Field>

              {!inviteData ? (
                <Field>
                  <FieldLabel htmlFor="study-track">Study Track</FieldLabel>
                  <Select value={form.studyTrack} onValueChange={onChangeTrack}>
                    <SelectTrigger id="study-track">
                      <SelectValue placeholder="Select track" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ielts">IELTS</SelectItem>
                      <SelectItem value="aca">ACA</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>Choose student program: IELTS or ACA.</FieldDescription>
                </Field>
              ) : null}

              <Field className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(event) => onChangePassword?.(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) => onChangeConfirmPassword?.(event.target.value)}
                    required
                  />
                </Field>
              </Field>

              <FieldDescription>Must be at least 8 characters long.</FieldDescription>

              <Field>
                <Button type="submit" className="w-full" disabled={isDisabled}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <Link to="/login" className="underline-offset-4 hover:underline">
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <a href="#" className="underline-offset-4 hover:underline">Terms of Service</a>{" "}
        and{" "}
        <a href="#" className="underline-offset-4 hover:underline">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
