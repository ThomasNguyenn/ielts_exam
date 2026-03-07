import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { GalleryVerticalEnd } from "lucide-react"

import { api } from "@/shared/api/client"
import { getDefaultRouteForUser } from "@/app/roleRouting"
import { LoginForm } from "@/components/login-form"

function FirstLoginModal({ open, form, loading, error, onChange, onSubmit }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">First Login Setup</h2>
        <p className="mt-1 text-sm text-slate-600">
          Please update your email, set a new password, and choose your Student Track.
        </p>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">New email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange({ email: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">New password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => onChange({ password: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Student Track</label>
            <select
              value={form.studyTrack}
              onChange={(e) => onChange({ studyTrack: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              required
            >
              <option value="ielts">IELTS</option>
              <option value="aca">Academic</option>
            </select>
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Saving..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [firstLoginOpen, setFirstLoginOpen] = useState(false)
  const [firstLoginSaving, setFirstLoginSaving] = useState(false)
  const [firstLoginError, setFirstLoginError] = useState("")
  const [firstLoginForm, setFirstLoginForm] = useState({
    email: "",
    password: "",
    studyTrack: "ielts",
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await api.login(form)
      api.setToken(res.data.token)
      api.setUser(res.data.user)

      if (res?.data?.user?.mustCompleteFirstLogin) {
        setFirstLoginForm({
          email: form.email,
          password: "",
          studyTrack: "ielts",
        })
        setFirstLoginError("")
        setFirstLoginOpen(true)
        return
      }

      navigate(getDefaultRouteForUser(res.data.user), { replace: true })
    } catch (err) {
      setError(err.message || "Login failed. Please check your account.")
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteFirstLogin = async (event) => {
    event.preventDefault()
    setFirstLoginSaving(true)
    setFirstLoginError("")

    try {
      const response = await api.completeFirstLogin(firstLoginForm)
      const nextUser = response?.data?.user
      if (nextUser) {
        api.setUser(nextUser)
      }
      setFirstLoginOpen(false)
      navigate(getDefaultRouteForUser(nextUser || api.getUser()), { replace: true })
    } catch (err) {
      setFirstLoginError(err.message || "Failed to complete first login setup.")
    } finally {
      setFirstLoginSaving(false)
    }
  }

  return (
    <>
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
            loading={loading}
            error={error}
            showPassword={showPassword}
            onSubmit={handleSubmit}
            onTogglePassword={() => setShowPassword((prev) => !prev)}
            onEmailChange={(email) => setForm((prev) => ({ ...prev, email }))}
            onPasswordChange={(password) => setForm((prev) => ({ ...prev, password }))}
          />
        </div>
      </div>

      <FirstLoginModal
        open={firstLoginOpen}
        form={firstLoginForm}
        loading={firstLoginSaving}
        error={firstLoginError}
        onChange={(patch) => setFirstLoginForm((prev) => ({ ...prev, ...patch }))}
        onSubmit={handleCompleteFirstLogin}
      />
    </>
  )
}
