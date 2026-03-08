import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import AccountSecurityModal from "@/features/auth/components/AccountSecurityModal";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";

const createEmptyProfile = () => ({
  email: "",
  pendingEmail: "",
  emailChangeTokenExpires: null,
});

export default function StudentAccountSecurityPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showNotification } = useNotification();
  const isStudentAca = location.pathname.startsWith("/student-aca");
  const fallbackPath = isStudentAca ? "/student-aca/homework" : "/student-ielts/profile";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState(createEmptyProfile);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getProfile();
      if (!res?.success || !res?.data) {
        throw new Error("Failed to load profile.");
      }

      const data = res.data;
      setProfile({
        email: String(data?.email || ""),
        pendingEmail: String(data?.pendingEmail || ""),
        emailChangeTokenExpires: data?.emailChangeTokenExpires || null,
      });
    } catch (profileError) {
      setError(profileError?.message || "Failed to load account details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const modalDescription = useMemo(
    () =>
      "You can request email update and/or set a new password. Current password is required for security.",
    [],
  );

  const handleClose = () => {
    navigate(fallbackPath, { replace: true });
  };

  const handleSubmit = async ({ newEmail, currentPassword, newPassword }) => {
    setError("");
    setSuccessMessage("");
    setSubmitting(true);
    try {
      const normalizedCurrentPassword = String(currentPassword || "");
      let emailChanged = false;
      let passwordChanged = false;

      if (newEmail) {
        await api.requestEmailChange({
          newEmail: String(newEmail || "").trim().toLowerCase(),
          currentPassword: normalizedCurrentPassword,
        });
        emailChanged = true;
      }

      if (newPassword) {
        await api.changePassword({
          currentPassword: normalizedCurrentPassword,
          newPassword: String(newPassword || ""),
        });
        passwordChanged = true;
      }

      if (!emailChanged && !passwordChanged) {
        throw new Error("No changes to save.");
      }

      if (passwordChanged) {
        showNotification("Password updated. Please log in again.", "success");
        await api.logout();
        navigate("/login", { replace: true });
        return;
      }

      if (emailChanged) {
        const emailMessage = "Email change requested. Please verify from your new email.";
        showNotification(emailMessage, "success");
        setSuccessMessage(emailMessage);
      }

      await loadProfile();
    } catch (submitError) {
      setError(submitError?.message || "Failed to update account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-70px)] bg-[#f6f6f8] text-slate-900">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
        <h1 className="text-2xl font-semibold text-slate-900">Account security</h1>
        <p className="mt-2 text-sm text-slate-600">
          Update your email and password from one secure place.
        </p>
      </div>

      {!loading ? (
        <AccountSecurityModal
          mode="account-update"
          isOpen
          closable
          title="Update account"
          description={modalDescription}
          submitLabel="Save changes"
          submitting={submitting}
          error={error}
          successMessage={successMessage}
          currentEmail={profile.email}
          pendingEmail={profile.pendingEmail}
          pendingEmailExpires={profile.emailChangeTokenExpires}
          onSubmit={handleSubmit}
          onClose={handleClose}
        />
      ) : (
        <div className="mx-auto w-full max-w-5xl px-4 pb-8 md:px-6">
          <p className="text-sm text-slate-500">Loading account details...</p>
        </div>
      )}
    </div>
  );
}
