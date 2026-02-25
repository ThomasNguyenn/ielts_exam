import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/client";
import EditProfileModal from "../components/EditProfileModal";
import ProfileMainContent from "../components/ProfileMainContent";
import ProfileSidebar from "../components/ProfileSidebar";
import {
  DEFAULT_DASHBOARD,
  DEFAULT_TARGETS,
  SKILL_ORDER,
  averageTargetBand,
  clampTarget,
  createAvatarUrl,
  ensureProfileFonts,
  fallbackAvatarSeed,
  formatMemberSince,
  mergeBadges,
  normalizeDashboard,
  normalizeTargets,
  sanitizeAvatarSeed,
} from "../profile.helpers";

const createInitialDashboard = () => ({
  ...DEFAULT_DASHBOARD,
  summary: { ...DEFAULT_DASHBOARD.summary },
  skills: {
    reading: { ...DEFAULT_DASHBOARD.skills.reading },
    listening: { ...DEFAULT_DASHBOARD.skills.listening },
    speaking: { ...DEFAULT_DASHBOARD.skills.speaking },
    writing: { ...DEFAULT_DASHBOARD.skills.writing },
  },
  badges: [],
  recentActivities: [],
});

const createInitialProfile = () => ({
  _id: "",
  name: "",
  email: "",
  role: "student",
  createdAt: null,
  avatarSeed: "",
  targets: { ...DEFAULT_TARGETS },
  dashboard: createInitialDashboard(),
});

const createEditForm = (profile) => ({
  name: String(profile?.name || ""),
  avatarSeed: sanitizeAvatarSeed(profile?.avatarSeed, fallbackAvatarSeed(profile)),
  targets: normalizeTargets(profile?.targets || DEFAULT_TARGETS),
});

function ProfilePage() {
  const [profile, setProfile] = useState(createInitialProfile);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [editForm, setEditForm] = useState(() => createEditForm(createInitialProfile()));

  useEffect(() => {
    ensureProfileFonts();
  }, []);

  useEffect(() => {
    let active = true;

    const fetchProfile = async () => {
      try {
        if (!api.isAuthenticated()) {
          if (active) setLoading(false);
          return;
        }

        const response = await api.getProfile();
        if (!active || !response?.success || !response?.data) return;

        const data = response.data;
        const targets = normalizeTargets(data.targets || DEFAULT_TARGETS);
        const avatarSeed = sanitizeAvatarSeed(data.avatarSeed, fallbackAvatarSeed(data));
        const dashboard = normalizeDashboard(data.dashboard, targets);

        setProfile({
          _id: String(data._id || ""),
          name: String(data.name || ""),
          email: String(data.email || ""),
          role: String(data.role || "student"),
          createdAt: data.createdAt || null,
          avatarSeed,
          targets,
          dashboard,
        });
      } catch (error) {
        console.error("Failed to load profile", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      active = false;
    };
  }, []);

  const summary = profile.dashboard.summary || DEFAULT_DASHBOARD.summary;
  const skills = profile.dashboard.skills || DEFAULT_DASHBOARD.skills;

  const badges = useMemo(() => mergeBadges(profile.dashboard.badges), [profile.dashboard.badges]);

  const activities = useMemo(
    () =>
      Array.isArray(profile.dashboard.recentActivities)
        ? profile.dashboard.recentActivities.slice(0, 10)
        : [],
    [profile.dashboard.recentActivities],
  );

  const profileName = profile.name || "Student";
  const memberSince = useMemo(() => formatMemberSince(profile.createdAt), [profile.createdAt]);

  const targetBand = useMemo(() => {
    const avg = averageTargetBand(profile.targets);
    return avg > 0 ? avg : clampTarget(summary.averageBandScore);
  }, [profile.targets, summary.averageBandScore]);

  const avatarSrc = useMemo(
    () => createAvatarUrl(sanitizeAvatarSeed(profile.avatarSeed, fallbackAvatarSeed(profile))),
    [profile.avatarSeed, profile.name, profile.email, profile._id],
  );

  const editorAvatarSrc = useMemo(
    () => createAvatarUrl(sanitizeAvatarSeed(editForm.avatarSeed, fallbackAvatarSeed(profile))),
    [editForm.avatarSeed, profile.avatarSeed, profile.name, profile.email, profile._id],
  );

  const openEditor = useCallback(() => {
    setSaveMessage("");
    setSaveError("");
    setEditForm(createEditForm(profile));
    setIsEditorOpen(true);
  }, [profile]);

  const closeEditor = useCallback(() => {
    if (saving) return;
    setIsEditorOpen(false);
  }, [saving]);

  const updateEditTarget = useCallback((key, value) => {
    setEditForm((prev) => ({
      ...prev,
      targets: {
        ...prev.targets,
        [key]: clampTarget(value),
      },
    }));
  }, []);

  const regenerateAvatarSeed = useCallback(() => {
    const base = String(editForm.name || profile.name || "student")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");

    const nextSeed = `${base || "student"}-${Date.now().toString(36)}`;
    setEditForm((prev) => ({ ...prev, avatarSeed: nextSeed }));
  }, [editForm.name, profile.name]);

  const updateEditName = useCallback((name) => {
    setEditForm((prev) => ({ ...prev, name }));
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    if (String(profile.name || "").trim() !== String(editForm.name || "").trim()) return true;

    const profileSeed = sanitizeAvatarSeed(profile.avatarSeed, fallbackAvatarSeed(profile));
    const editSeed = sanitizeAvatarSeed(editForm.avatarSeed, fallbackAvatarSeed(profile));
    if (profileSeed !== editSeed) return true;

    for (const key of SKILL_ORDER) {
      if (clampTarget(profile.targets?.[key]) !== clampTarget(editForm.targets?.[key])) return true;
    }

    return false;
  }, [profile, editForm]);

  const saveProfile = useCallback(async () => {
    setSaveMessage("");
    setSaveError("");
    setSaving(true);

    try {
      const payload = {
        name: String(editForm.name || "").trim(),
        targets: normalizeTargets(editForm.targets),
        avatarSeed: sanitizeAvatarSeed(editForm.avatarSeed, fallbackAvatarSeed(profile)),
      };

      const response = await api.updateProfile(payload);
      if (!response?.success || !response?.data) {
        throw new Error("Failed to update profile.");
      }

      const data = response.data;
      const targets = normalizeTargets(data.targets || payload.targets);
      const avatarSeed = sanitizeAvatarSeed(data.avatarSeed, payload.avatarSeed);
      const dashboard = normalizeDashboard(data.dashboard, targets);

      const nextProfile = {
        _id: String(data._id || profile._id || ""),
        name: String(data.name || payload.name || profile.name),
        email: String(data.email || profile.email || ""),
        role: String(data.role || profile.role || "student"),
        createdAt: data.createdAt || profile.createdAt,
        avatarSeed,
        targets,
        dashboard,
      };

      setProfile(nextProfile);
      setEditForm(createEditForm(nextProfile));
      setSaveMessage("Profile updated successfully.");
      setIsEditorOpen(false);

      const currentUser = api.getUser();
      if (currentUser) {
        api.setUser({
          ...currentUser,
          name: nextProfile.name,
          avatarSeed: nextProfile.avatarSeed,
        });
      }
    } catch (error) {
      setSaveError(error?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }, [editForm, profile]);

  useEffect(() => {
    if (!isEditorOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeEditor();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (hasUnsavedChanges && !saving) {
          saveProfile();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isEditorOpen, closeEditor, hasUnsavedChanges, saving, saveProfile]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading profile...</div>;
  }

  return (
    <>
      <div className="w-full bg-[#f6f6f8] min-h-[calc(100vh-70px)] text-slate-900">
        <div
          className="w-full max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6"
          style={{ fontFamily: "Lexend, sans-serif" }}
        >
          <ProfileSidebar
            profileName={profileName}
            memberSince={memberSince}
            targetBand={targetBand}
            avatarSrc={avatarSrc}
            onOpenEditor={openEditor}
            skills={skills}
          />

          <ProfileMainContent summary={summary} badges={badges} activities={activities} />
        </div>
      </div>

      <EditProfileModal
        isOpen={isEditorOpen}
        onClose={closeEditor}
        onSave={saveProfile}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        saveError={saveError}
        saveMessage={saveMessage}
        editForm={editForm}
        avatarSrc={editorAvatarSrc}
        onRegenerateAvatar={regenerateAvatarSeed}
        onEditNameChange={updateEditName}
        onUpdateTarget={updateEditTarget}
      />
    </>
  );
}

export default ProfilePage;
