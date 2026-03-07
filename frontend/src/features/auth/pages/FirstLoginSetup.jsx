import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { getDefaultRouteForUser } from "@/app/roleRouting"
import { api } from "@/shared/api/client"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export default function FirstLoginSetupPage() {
  const navigate = useNavigate()
  const currentUser = api.getUser()

  const [form, setForm] = useState({
    email: String(currentUser?.email || ""),
    password: "",
    confirmPassword: "",
    studyTrack: "ielts",
  })
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    const checkStatus = async () => {
      if (!api.isAuthenticated() || !api.getUser()) {
        navigate("/login", { replace: true })
        return
      }

      try {
        const res = await api.getFirstLoginStatus()
        const status = res?.data || {}
        const mustComplete = Boolean(status.mustCompleteFirstLogin)
        const sessionUser = api.getUser()

        if (sessionUser) {
          api.setUser({
            ...sessionUser,
            createdByTeacherBulk: Boolean(status.createdByTeacherBulk),
            mustCompleteFirstLogin: mustComplete,
          })
        }

        if (!mustComplete) {
          const nextUser = api.getUser() || sessionUser
          navigate(getDefaultRouteForUser(nextUser), { replace: true })
        }
      } catch (err) {
        setError(err?.message || "Cannot verify first-login status.")
      } finally {
        if (mounted) setCheckingStatus(false)
      }
    }

    void checkStatus()

    return () => {
      mounted = false
    }
  }, [navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")

    const email = String(form.email || "").trim().toLowerCase()
    const password = String(form.password || "")
    const confirmPassword = String(form.confirmPassword || "")
    const studyTrack = String(form.studyTrack || "").trim().toLowerCase()

    if (!EMAIL_REGEX.test(email)) {
      setError("Please enter a valid email.")
      return
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }

    if (password !== confirmPassword) {
      setError("Password confirmation does not match.")
      return
    }

    if (!["ielts", "aca"].includes(studyTrack)) {
      setError("Please choose a study track.")
      return
    }

    try {
      setLoading(true)
      const res = await api.completeFirstLogin({ email, password, studyTrack })
      const nextUser = res?.data?.user

      if (!nextUser) {
        throw new Error("First-login setup response is invalid.")
      }

      if (res?.data?.token) {
        api.setToken(res.data.token)
      }
      api.setUser(nextUser)
      navigate(getDefaultRouteForUser(nextUser), { replace: true })
    } catch (err) {
      setError(err?.message || "First-login setup failed.")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await api.logout()
    navigate("/login", { replace: true })
  }

  if (checkingStatus) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted px-4">
        <p className="text-sm text-muted-foreground">Checking your first-login status...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Complete first login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please update your email, password, and choose your Student Track.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="first-login-email">
              New email
            </label>
            <input
              id="first-login-email"
              type="email"
              autoComplete="email"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="first-login-password">
              New password
            </label>
            <input
              id="first-login-password"
              type="password"
              autoComplete="new-password"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="first-login-confirm-password">
              Confirm password
            </label>
            <input
              id="first-login-confirm-password"
              type="password"
              autoComplete="new-password"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={form.confirmPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="first-login-track">
              Student Track
            </label>
            <select
              id="first-login-track"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={form.studyTrack}
              onChange={(event) => setForm((prev) => ({ ...prev, studyTrack: event.target.value }))}
            >
              <option value="ielts">IELTS</option>
              <option value="aca">Academic</option>
            </select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Saving..." : "Complete setup"}
          </button>
        </form>

        <button
          type="button"
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
          onClick={handleLogout}
          disabled={loading}
        >
          Logout
        </button>
      </div>
    </div>
  )
}
