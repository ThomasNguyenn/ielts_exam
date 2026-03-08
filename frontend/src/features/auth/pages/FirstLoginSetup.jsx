import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getDefaultRouteForUser } from "@/app/roleRouting";
import AccountSecurityModal from "@/features/auth/components/AccountSecurityModal";
import { api } from "@/shared/api/client";

export default function FirstLoginSetupPage() {
  const navigate = useNavigate();
  const currentUser = api.getUser();

  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      if (!api.isAuthenticated() || !api.getUser()) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const res = await api.getFirstLoginStatus();
        const status = res?.data || {};
        const mustComplete = Boolean(status.mustCompleteFirstLogin);
        const sessionUser = api.getUser();

        if (sessionUser) {
          api.setUser({
            ...sessionUser,
            createdByTeacherBulk: Boolean(status.createdByTeacherBulk),
            mustCompleteFirstLogin: mustComplete,
          });
        }

        if (!mustComplete) {
          const nextUser = api.getUser() || sessionUser;
          navigate(getDefaultRouteForUser(nextUser), { replace: true });
        }
      } catch (statusError) {
        setError(statusError?.message || "Cannot verify first-login status.");
      } finally {
        if (mounted) setCheckingStatus(false);
      }
    };

    void checkStatus();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleSubmit = async ({ email, password, studyTrack }) => {
    setError("");

    try {
      setSubmitting(true);
      const res = await api.completeFirstLogin({ email, password, studyTrack });
      const nextUser = res?.data?.user;

      if (!nextUser) {
        throw new Error("First-login setup response is invalid.");
      }

      if (res?.data?.token) {
        api.setToken(res.data.token);
      }
      api.setUser(nextUser);
      navigate(getDefaultRouteForUser(nextUser), { replace: true });
    } catch (submitError) {
      setError(submitError?.message || "First-login setup failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    navigate("/login", { replace: true });
  };

  if (checkingStatus) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted px-4">
        <p className="text-sm text-muted-foreground">Checking your first-login status...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted px-4 py-10">
      <AccountSecurityModal
        mode="first-login"
        isOpen
        closable={false}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
        submitLabel="Complete setup"
        secondaryActionLabel="Logout"
        onSecondaryAction={handleLogout}
        initialEmail={String(currentUser?.email || "")}
        initialStudyTrack="ielts"
      />
    </div>
  );
}
