import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { GalleryVerticalEnd } from "lucide-react"

import { api } from "@/shared/api/client"
import { isStudentFamilyRole, requiresFirstLoginSetup } from "@/app/roleRouting"
import { SignupForm } from "@/features/auth/components/signup-form"

export default function SignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = String(searchParams.get("invite") || "").trim()
  const normalizedInviteToken = inviteToken.includes(" ")
    ? inviteToken.replace(/\s+/g, "+")
    : inviteToken

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    studyTrack: "ielts",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [inviteData, setInviteData] = useState(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState("")

  useEffect(() => {
    if (!normalizedInviteToken) return

    setInviteLoading(true)
    setInviteData(null)
    setInviteError("")

    api.validateInvitation(normalizedInviteToken)
      .then((res) => {
        const payload = res && typeof res === "object" ? res : {}
        const invitePayload =
          payload?.data && typeof payload.data === "object"
            ? payload.data
            : payload
        const isValid = Boolean(payload?.valid ?? invitePayload?.valid)

        if (isValid) {
          const invitedEmail = String(invitePayload?.email || "").trim()
          const invitedRole = String(invitePayload?.role || "").trim()
          setInviteData({ email: invitedEmail, role: invitedRole })
          setForm((prev) => ({ ...prev, email: invitedEmail }))
        } else {
          setInviteData(null)
          setInviteError("Invitation is invalid or expired.")
        }
      })
      .catch(() => {
        setInviteData(null)
        setInviteError("Invitation is invalid or expired.")
      })
      .finally(() => setInviteLoading(false))
  }, [normalizedInviteToken])

  const roleLabelMap = {
    admin: "Admin",
    teacher: "Teacher",
    supervisor: "Supervisor",
  }
  const roleLabel = roleLabelMap[String(inviteData?.role || "").trim().toLowerCase()] || "Student"

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (!inviteData && !["ielts", "aca"].includes(String(form.studyTrack || "").trim().toLowerCase())) {
      setError("Please choose a study track.")
      return
    }

    setLoading(true)

    try {
      const registerData = {
        name: form.name,
        email: form.email,
        password: form.password,
      }

      if (normalizedInviteToken) {
        registerData.inviteToken = normalizedInviteToken
      } else {
        registerData.studyTrack = form.studyTrack
      }

      const res = await api.register(registerData)
      api.setToken(res.data.token)
      api.setUser(res.data.user)

      if (!res.data.user.isConfirmed && isStudentFamilyRole(res.data.user.role)) {
        navigate("/wait-for-confirmation")
      } else if (requiresFirstLoginSetup(res.data.user)) {
        navigate("/first-login")
      } else {
        navigate("/")
      }
    } catch (err) {
      setError(err.message || "Register failed. Please try again.")
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
          IELTS Hub
        </Link>

        <SignupForm
          form={form}
          loading={loading}
          error={error}
          inviteLoading={inviteLoading}
          inviteError={inviteError}
          inviteData={inviteData}
          roleLabel={roleLabel}
          onSubmit={handleSubmit}
          onChangeName={(name) => setForm((prev) => ({ ...prev, name }))}
          onChangeEmail={(email) => {
            if (inviteData) return
            setForm((prev) => ({ ...prev, email }))
          }}
          onChangeTrack={(studyTrack) => setForm((prev) => ({ ...prev, studyTrack }))}
          onChangePassword={(password) => setForm((prev) => ({ ...prev, password }))}
          onChangeConfirmPassword={(confirmPassword) => setForm((prev) => ({ ...prev, confirmPassword }))}
        />
      </div>
    </div>
  )
}
