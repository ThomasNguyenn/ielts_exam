import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { GalleryVerticalEnd } from "lucide-react"

import { api } from "@/shared/api/client"
import { getDefaultRouteForUser, requiresFirstLoginSetup } from "@/app/roleRouting"
import { LoginForm } from "@/features/auth/components/login-form"

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: "", password: "", rememberMe: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await api.login(form)
      api.setToken(res.data.token)
      api.setUser(res.data.user)
      if (requiresFirstLoginSetup(res.data.user)) {
        navigate('/first-login', { replace: true })
      } else {
        navigate(getDefaultRouteForUser(res.data.user), { replace: true })
      }
    } catch (err) {
      setError(err.message || "Login failed. Please check your account.")
    } finally {
      setLoading(false)
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

        <LoginForm
          email={form.email}
          password={form.password}
          rememberMe={form.rememberMe}
          loading={loading}
          error={error}
          showPassword={showPassword}
          onSubmit={handleSubmit}
          onTogglePassword={() => setShowPassword((prev) => !prev)}
          onEmailChange={(email) => setForm((prev) => ({ ...prev, email }))}
          onPasswordChange={(password) => setForm((prev) => ({ ...prev, password }))}
          onRememberMeChange={(rememberMe) => setForm((prev) => ({ ...prev, rememberMe }))}
        />
      </div>
    </div>
  )
}
