import { useEffect, useMemo, useState } from "react";
import "./AccountSecurityModal.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

const createFirstLoginForm = (initialEmail = "", initialStudyTrack = "ielts") => ({
  email: String(initialEmail || "").trim().toLowerCase(),
  password: "",
  confirmPassword: "",
  studyTrack: initialStudyTrack === "aca" ? "aca" : "ielts",
});

const createAccountUpdateForm = () => ({
  newEmail: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const formatDateTime = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AccountSecurityModal({
  mode = "account-update",
  isOpen = false,
  closable = true,
  title = "",
  description = "",
  submitLabel = "",
  submitting = false,
  error = "",
  successMessage = "",
  onSubmit,
  onClose,
  onSecondaryAction,
  secondaryActionLabel = "",
  initialEmail = "",
  initialStudyTrack = "ielts",
  currentEmail = "",
  pendingEmail = "",
  pendingEmailExpires = null,
}) {
  const [firstLoginForm, setFirstLoginForm] = useState(() =>
    createFirstLoginForm(initialEmail, initialStudyTrack),
  );
  const [accountUpdateForm, setAccountUpdateForm] = useState(createAccountUpdateForm);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLocalError("");
    setFirstLoginForm(createFirstLoginForm(initialEmail, initialStudyTrack));
    setAccountUpdateForm(createAccountUpdateForm());
  }, [initialEmail, initialStudyTrack, isOpen, mode]);

  const mergedError = localError || String(error || "");
  const normalizedCurrentEmail = useMemo(
    () => String(currentEmail || "").trim().toLowerCase(),
    [currentEmail],
  );
  const pendingEmailExpiryLabel = useMemo(
    () => formatDateTime(pendingEmailExpires),
    [pendingEmailExpires],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setLocalError("");

    try {
      if (mode === "first-login") {
        const email = String(firstLoginForm.email || "").trim().toLowerCase();
        const password = String(firstLoginForm.password || "");
        const confirmPassword = String(firstLoginForm.confirmPassword || "");
        const studyTrack = String(firstLoginForm.studyTrack || "").trim().toLowerCase();

        if (!EMAIL_REGEX.test(email)) {
          setLocalError("Please enter a valid email.");
          return;
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
          setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
          return;
        }

        if (password !== confirmPassword) {
          setLocalError("Password confirmation does not match.");
          return;
        }

        if (!["ielts", "aca"].includes(studyTrack)) {
          setLocalError("Please choose a study track.");
          return;
        }

        await onSubmit?.({ email, password, confirmPassword, studyTrack });
        return;
      }

      const newEmail = String(accountUpdateForm.newEmail || "").trim().toLowerCase();
      const currentPassword = String(accountUpdateForm.currentPassword || "");
      const newPassword = String(accountUpdateForm.newPassword || "");
      const confirmPassword = String(accountUpdateForm.confirmPassword || "");

      const hasEmailChange = newEmail.length > 0;
      const hasPasswordChange = newPassword.length > 0 || confirmPassword.length > 0;

      if (!hasEmailChange && !hasPasswordChange) {
        setLocalError("No changes to save.");
        return;
      }

      if (!currentPassword) {
        setLocalError("Current password is required.");
        return;
      }

      if (hasEmailChange) {
        if (!EMAIL_REGEX.test(newEmail)) {
          setLocalError("Please enter a valid email address.");
          return;
        }
        if (newEmail === normalizedCurrentEmail) {
          setLocalError("New email must be different from current email.");
          return;
        }
      }

      if (hasPasswordChange) {
        if (!newPassword || !confirmPassword) {
          setLocalError("Please enter new password and confirmation.");
          return;
        }
        if (newPassword !== confirmPassword) {
          setLocalError("New password and confirmation do not match.");
          return;
        }
        if (!PASSWORD_REGEX.test(newPassword)) {
          setLocalError("Password must contain uppercase, lowercase, number (8-72 chars).");
          return;
        }
      }

      await onSubmit?.({
        newEmail: hasEmailChange ? newEmail : "",
        currentPassword,
        newPassword: hasPasswordChange ? newPassword : "",
        confirmPassword: hasPasswordChange ? confirmPassword : "",
      });
    } catch (submitError) {
      setLocalError(submitError?.message || "Unable to submit. Please try again.");
    }
  };

  if (!isOpen) return null;

  const resolvedTitle =
    title ||
    (mode === "first-login" ? "Complete first login" : "Account security");
  const resolvedDescription =
    description ||
    (mode === "first-login"
      ? "Please update your email, password, and student track."
      : "Update your email and password securely.");
  const resolvedSubmitLabel =
    submitLabel || (mode === "first-login" ? "Complete setup" : "Save changes");

  return (
    <div
      className="account-security-overlay fixed inset-0 z-[120] bg-black/45 p-3 sm:p-4 flex items-center justify-center"
      onMouseDown={(event) => {
        if (!closable) return;
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="account-security-modal w-full max-w-[420px] rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="account-security-header px-4 py-3 border-b border-zinc-200 flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-zinc-900">{resolvedTitle}</h2>
            <p className="text-sm text-zinc-500">{resolvedDescription}</p>
          </div>
          {closable ? (
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50"
              onClick={() => onClose?.()}
              aria-label="Close dialog"
            >
              x
            </button>
          ) : null}
        </div>

        <form className="account-security-form p-4 space-y-3" onSubmit={handleSubmit}>
          {mode === "first-login" ? (
            <>
              <div className="account-security-field space-y-1">
                <label className="text-sm font-medium text-zinc-900" htmlFor="auth-security-email">
                  New email
                </label>
                <input
                  id="auth-security-email"
                  type="email"
                  autoComplete="email"
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                  value={firstLoginForm.email}
                  onChange={(event) =>
                    setFirstLoginForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="account-security-field space-y-1">
                <label className="text-sm font-medium text-zinc-900" htmlFor="auth-security-password">
                  New password
                </label>
                <input
                  id="auth-security-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                  value={firstLoginForm.password}
                  onChange={(event) =>
                    setFirstLoginForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="account-security-field space-y-1">
                <label className="text-sm font-medium text-zinc-900" htmlFor="auth-security-confirm-password">
                  Confirm password
                </label>
                <input
                  id="auth-security-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                  value={firstLoginForm.confirmPassword}
                  onChange={(event) =>
                    setFirstLoginForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="account-security-field space-y-1">
                <label className="text-sm font-medium text-zinc-900" htmlFor="auth-security-track">
                  Student track
                </label>
                <select
                  id="auth-security-track"
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                  value={firstLoginForm.studyTrack}
                  onChange={(event) =>
                    setFirstLoginForm((prev) => ({ ...prev, studyTrack: event.target.value }))
                  }
                >
                  <option value="ielts">IELTS</option>
                  <option value="aca">Academic</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <p className="text-zinc-700">
                  <span className="font-medium">Current email:</span>{" "}
                  {normalizedCurrentEmail || "Unknown"}
                </p>
                {pendingEmail ? (
                  <p className="mt-1 text-zinc-600">
                    <span className="font-medium">Pending verification:</span>{" "}
                    {String(pendingEmail)}
                    {pendingEmailExpiryLabel ? ` (expires ${pendingEmailExpiryLabel})` : ""}
                  </p>
                ) : null}
              </div>

              <div className="account-security-field space-y-1">
                <label className="text-sm font-medium text-zinc-900" htmlFor="auth-security-update-email">
                  New email (optional)
                </label>
                <input
                  id="auth-security-update-email"
                  type="email"
                  autoComplete="email"
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                  value={accountUpdateForm.newEmail}
                  onChange={(event) =>
                    setAccountUpdateForm((prev) => ({ ...prev, newEmail: event.target.value }))
                  }
                />
              </div>

              <div className="account-security-field space-y-1">
                <label className="text-sm font-medium text-zinc-900" htmlFor="auth-security-current-password">
                  Current password
                </label>
                <input
                  id="auth-security-current-password"
                  type="password"
                  autoComplete="current-password"
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                  value={accountUpdateForm.currentPassword}
                  onChange={(event) =>
                    setAccountUpdateForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                  }
                />
              </div>

              <div className="account-security-field space-y-1">
                <label className="text-sm font-medium text-zinc-900" htmlFor="auth-security-update-password">
                  New password (optional)
                </label>
                <input
                  id="auth-security-update-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                  value={accountUpdateForm.newPassword}
                  onChange={(event) =>
                    setAccountUpdateForm((prev) => ({ ...prev, newPassword: event.target.value }))
                  }
                />
              </div>

              <div className="account-security-field space-y-1">
                <label className="text-sm font-medium text-zinc-900" htmlFor="auth-security-update-confirm-password">
                  Confirm new password
                </label>
                <input
                  id="auth-security-update-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                  value={accountUpdateForm.confirmPassword}
                  onChange={(event) =>
                    setAccountUpdateForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                />
              </div>
            </>
          )}

          {mergedError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {mergedError}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          <div className="account-security-actions flex flex-wrap items-center justify-end gap-2 pt-1">
            {secondaryActionLabel && onSecondaryAction ? (
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                onClick={() => onSecondaryAction()}
                disabled={submitting}
              >
                {secondaryActionLabel}
              </button>
            ) : null}

            {closable ? (
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                onClick={() => onClose?.()}
                disabled={submitting}
              >
                Cancel
              </button>
            ) : null}

            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Saving..." : resolvedSubmitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
