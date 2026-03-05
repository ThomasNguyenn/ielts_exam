import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import {
  createAvatarUrl,
  fallbackAvatarSeed,
  sanitizeAvatarSeed,
} from '@/features/profile/profile.helpers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

const createEmptyProfile = () => ({
  _id: '',
  email: '',
  pendingEmail: null,
  emailChangeTokenExpires: null,
  name: '',
  avatarSeed: '',
});

const formatDateTime = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getInitials = (value) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(createEmptyProfile);
  const [displayName, setDisplayName] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    currentPassword: '',
  });

  const syncProfile = useCallback((source = {}) => {
    const nextProfile = {
      _id: String(source._id || ''),
      email: String(source.email || ''),
      pendingEmail: source.pendingEmail ? String(source.pendingEmail) : null,
      emailChangeTokenExpires: source.emailChangeTokenExpires || null,
      name: String(source.name || ''),
      avatarSeed: sanitizeAvatarSeed(source.avatarSeed, fallbackAvatarSeed(source)),
    };
    setProfile(nextProfile);
    setDisplayName(nextProfile.name);
    setAvatarSeed(nextProfile.avatarSeed);
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getProfile();
      if (!res?.success || !res?.data) {
        throw new Error('Failed to load profile');
      }
      syncProfile(res.data);
    } catch (error) {
      showNotification(error?.message || 'Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification, syncProfile]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const effectiveAvatarSeed = useMemo(
    () => sanitizeAvatarSeed(avatarSeed, fallbackAvatarSeed({ ...profile, avatarSeed })),
    [avatarSeed, profile],
  );

  const avatarSrc = useMemo(
    () => createAvatarUrl(effectiveAvatarSeed),
    [effectiveAvatarSeed],
  );

  const hasProfileChanges = useMemo(() => {
    const normalizedName = String(displayName || '').trim();
    const normalizedSeed = sanitizeAvatarSeed(avatarSeed, fallbackAvatarSeed(profile));
    return normalizedName !== String(profile.name || '').trim() || normalizedSeed !== profile.avatarSeed;
  }, [avatarSeed, displayName, profile]);
  const hasPasswordInput = useMemo(
    () => Object.values(passwordForm).some((value) => String(value || '').trim().length > 0),
    [passwordForm],
  );
  const hasEmailInput = useMemo(
    () => Object.values(emailForm).some((value) => String(value || '').trim().length > 0),
    [emailForm],
  );
  const hasAnyChanges = useMemo(
    () => hasProfileChanges || hasPasswordInput || hasEmailInput,
    [hasEmailInput, hasPasswordInput, hasProfileChanges],
  );

  const pendingEmailLabel = useMemo(
    () => formatDateTime(profile.emailChangeTokenExpires),
    [profile.emailChangeTokenExpires],
  );

  const regenerateAvatar = () => {
    const base = String(displayName || profile.name || 'staff')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    setAvatarSeed(`${base || 'staff'}-${Date.now().toString(36)}`);
  };

  const handleSaveAll = async () => {
    const nextName = String(displayName || '').trim();
    if (!nextName) {
      showNotification('Display name is required', 'error');
      return;
    }

    if (!hasAnyChanges) {
      showNotification('No changes to save', 'info');
      return;
    }

    setIsSaving(true);
    try {
      let shouldLogoutAfterSave = false;

      if (hasProfileChanges) {
        const payload = {
          name: nextName,
          avatarSeed: sanitizeAvatarSeed(avatarSeed, fallbackAvatarSeed(profile)),
        };
        const res = await api.updateProfile(payload);
        if (!res?.success || !res?.data) {
          throw new Error('Failed to update profile');
        }

        syncProfile(res.data);
        const sessionUser = api.getUser();
        if (sessionUser) {
          api.setUser({
            ...sessionUser,
            name: String(res.data.name || payload.name),
            avatarSeed: String(res.data.avatarSeed || payload.avatarSeed),
          });
        }
      }

      if (hasEmailInput) {
        const newEmail = String(emailForm.newEmail || '').trim().toLowerCase();
        const currentPassword = String(emailForm.currentPassword || '');

        if (!newEmail || !currentPassword) {
          showNotification('New email and current password are required', 'error');
          return;
        }
        if (!EMAIL_REGEX.test(newEmail)) {
          showNotification('Please enter a valid email address', 'error');
          return;
        }
        if (newEmail === String(profile.email || '').trim().toLowerCase()) {
          showNotification('New email must be different from current email', 'error');
          return;
        }

        await api.requestEmailChange({ newEmail, currentPassword });
        setEmailForm({ newEmail: '', currentPassword: '' });
        await loadProfile();
      }

      if (hasPasswordInput) {
        const currentPassword = String(passwordForm.currentPassword || '');
        const newPassword = String(passwordForm.newPassword || '');
        const confirmPassword = String(passwordForm.confirmPassword || '');

        if (!currentPassword || !newPassword || !confirmPassword) {
          showNotification('Please fill all password fields', 'error');
          return;
        }
        if (newPassword !== confirmPassword) {
          showNotification('New password and confirmation do not match', 'error');
          return;
        }
        if (!PASSWORD_REGEX.test(newPassword)) {
          showNotification('Password must contain uppercase, lowercase, number (8-72 chars)', 'error');
          return;
        }

        await api.changePassword({ currentPassword, newPassword });
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        shouldLogoutAfterSave = true;
      }

      if (shouldLogoutAfterSave) {
        showNotification('Settings saved. Please log in again.', 'success');
        await api.logout();
        navigate('/login', { replace: true });
        return;
      }

      showNotification('Settings saved', 'success');
    } catch (error) {
      showNotification(error?.message || 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        <Card className="rounded-xl border-zinc-200 shadow-sm">
          <CardContent className="py-10 text-sm text-zinc-500">Loading settings...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
      <main className="space-y-4">
          <header className="space-y-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold text-zinc-900">Account Settings</h1>
              <Badge variant="secondary" className="rounded-md border-zinc-200 bg-zinc-50 text-zinc-600">
                {hasAnyChanges ? 'Unsaved Changes' : 'Saved'}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500">Manage your staff account with a focused, minimal workspace.</p>
            <div>
              <Button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving || !hasAnyChanges}
                className="rounded-lg bg-zinc-900 text-white shadow-sm transition-colors duration-150 hover:bg-zinc-800 focus-visible:ring-zinc-400 disabled:bg-zinc-300 disabled:text-zinc-100"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </header>

          <Card className="rounded-xl border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Profile & Avatar</CardTitle>
              <CardDescription>Update your display name and seed-based avatar in one place.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="settings-name">Display Name</Label>
                  <Input
                    id="settings-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Your name"
                    className="rounded-lg"
                  />
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 rounded-xl border border-zinc-200">
                      <AvatarImage src={avatarSrc} alt={displayName || profile.name} />
                      <AvatarFallback className="rounded-xl bg-zinc-100 text-zinc-700">
                        {getInitials(displayName || profile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-900">{displayName || profile.name || 'Staff User'}</p>
                      <p className="text-xs text-zinc-500">Seed-based avatar preview</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="settings-avatar-seed">Avatar Seed</Label>
                  <Input
                    id="settings-avatar-seed"
                    value={avatarSeed}
                    onChange={(event) => setAvatarSeed(event.target.value)}
                    placeholder="avatar seed"
                    className="rounded-lg"
                  />
                </div>
                <Button type="button" variant="outline" onClick={regenerateAvatar} className="rounded-lg">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Password</CardTitle>
              <CardDescription>
                Use your current password to set a new one. You will be asked to log in again.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="settings-current-password">Current Password</Label>
                  <Input
                    id="settings-current-password"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-new-password">New Password</Label>
                  <Input
                    id="settings-new-password"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-confirm-password">Confirm New Password</Label>
                  <Input
                    id="settings-confirm-password"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    className="rounded-lg"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Email</CardTitle>
              <CardDescription>Changing email requires password and verification on the new email.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Current Email</p>
                <p className="text-sm text-zinc-900">{profile.email || 'Unknown'}</p>
              </div>

              {profile.pendingEmail ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-md border-zinc-200 bg-white text-zinc-600">
                      Pending Verification
                    </Badge>
                    <span className="text-xs text-zinc-500">{profile.pendingEmail}</span>
                  </div>
                  {pendingEmailLabel ? (
                    <p className="text-xs text-zinc-500">Expires: {pendingEmailLabel}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="settings-new-email">New Email</Label>
                  <Input
                    id="settings-new-email"
                    type="email"
                    value={emailForm.newEmail}
                    onChange={(event) => setEmailForm((prev) => ({ ...prev, newEmail: event.target.value }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-email-password">Current Password</Label>
                  <Input
                    id="settings-email-password"
                    type="password"
                    value={emailForm.currentPassword}
                    onChange={(event) => setEmailForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                    className="rounded-lg"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
      </main>
    </div>
  );
}
