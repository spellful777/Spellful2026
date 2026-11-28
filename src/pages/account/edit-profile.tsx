import { DEFAULT_AVATARS, profileAvatar } from '@/lib/default-avatars';
import { useEntitlement } from '@/lib/use-plus-entitlement';
import { uploadedMediaUrl } from '@/lib/native-api';
/**
 * /account/edit-profile — Compact profile identity editor
 * Avatar picker (bottom sheet), display name, username, bio, location, witch path
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useSession } from '@/lib/auth/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, ChevronLeft, Check, X, Upload, Loader2 } from 'lucide-react';
import { account as pg } from 'virtual:content';

// ── Avatar picker bottom sheet ────────────────────────────────────────────────

function AvatarPickerSheet({
  current,
  onSelect,
  onClose,
}: {
  current: string | null;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const { data: { isPlus } } = useEntitlement();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await fetch('/api/account/avatar', { method: 'POST', body: fd, credentials: 'include' });
      if (res.ok) {
        const d = await res.json() as { url?: string };
        if (d.url) { onSelect(d.url); onClose(); }
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setUploadError(d.error ?? 'Upload failed. Try again.');
      }
    } catch {
      setUploadError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function selectHat(url: string) {
    setUploadError('');
    setUploading(true);
    try {
      const response = await fetch('/api/account/avatar/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error();
      const saved = await response.json() as { url: string };
      onSelect(saved.url);
      onClose();
    } catch {
      setUploadError('Your hat could not be saved. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'hsl(var(--background)/0.8)', backdropFilter: 'blur(4px)' }}
      onClick={uploading ? undefined : onClose}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-lg rounded-t-3xl pb-safe"
        style={{ background: 'hsl(var(--card))', borderTop: '1px solid hsl(var(--border))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'hsl(var(--border))' }} />
        </div>

        <div className="px-5 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              {pg.profileTab.avatarPickerTitle}
            </h2>
            <button disabled={uploading} aria-label="Close avatar picker" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Upload custom */}
          {isPlus && <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed mb-4 transition-colors hover:border-primary/60"
              style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--muted))' }}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'hsl(var(--primary))' }} />
              ) : (
                <Upload className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              )}
              <span className="text-sm text-foreground">
                {uploading ? 'Uploading…' : 'Upload a custom photo'}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">JPEG · PNG · WebP · max 5 MB</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={(e) => { void handleFileUpload(e); }}
            />
          </>}
          {uploadError && <p role="alert" className="text-xs text-destructive mb-3">{uploadError}</p>}


          {/* Witch hat grid */}
          <div className="grid grid-cols-5 gap-2">
            {DEFAULT_AVATARS.map((av) => {
              const isSelected = current === av.src;
              return (
                <button
                  key={av.key}
                  type="button"
                  disabled={uploading}
                  aria-pressed={isSelected}
                  onClick={() => { void selectHat(av.src); }}
                  className="relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all"
                  style={{
                    background: isSelected ? 'hsl(var(--primary)/0.15)' : 'transparent',
                    border: isSelected ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                  }}
                >
                  <img
                    src={av.src}
                    alt={av.label}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <span className="text-xs text-muted-foreground leading-none">{av.label}</span>
                  {isSelected && (
                    <div
                      className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: 'hsl(var(--primary))' }}
                    >
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface ProfileData {
  name: string;
  username: string;
  bio: string;
  location: string;
  witchPath: string;
  image: string | null;
}

export default function EditProfilePage() {
  const { data: session, refetch } = useSession();
  const navigate = useNavigate();

  const [form, setForm] = useState<ProfileData>({
    name: '', username: '', bio: '', location: '', witchPath: '', image: null,
  });
  const [originalUsername, setOriginalUsername] = useState('');
  const [usernameCooldownDays, setUsernameCooldownDays] = useState<number | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  // Debounce ref for username check
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/account/profile', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { profile?: { username?: string; bio?: string; location?: string; witchPath?: string; usernameCooldownDays?: number } }) => {
        if (d.profile) {
          const u = session.user as { name?: string | null; image?: string | null; avatarPreset?: string };
          setForm({
            name: u.name ?? '',
            username: d.profile.username ?? '',
            bio: d.profile.bio ?? '',
            location: d.profile.location ?? '',
            witchPath: d.profile.witchPath ?? '',
            image: profileAvatar(u.image, u.avatarPreset),
          });
          setOriginalUsername(d.profile.username ?? '');
          if (d.profile.usernameCooldownDays) {
            setUsernameCooldownDays(d.profile.usernameCooldownDays);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.user.id]);

  // Username availability check (debounced)
  useEffect(() => {
    const val = form.username.trim();
    if (!val || val === originalUsername) {
      setUsernameAvailable(null);
      setUsernameError('');
      return;
    }
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const res = await fetch(`/api/account/username/check?username=${encodeURIComponent(val)}`, { credentials: 'include' });
        const d = await res.json() as { available?: boolean; error?: string };
        setUsernameAvailable(d.available ?? false);
        setUsernameError(d.available ? '' : (d.error ?? 'Username not available.'));
      } catch {
        setUsernameError('Could not check username.');
      } finally {
        setUsernameChecking(false);
      }
    }, 500);
    return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.username]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (usernameError) return;
    setSaveError('');
    setStatus('saving');
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: form.username,
          bio: form.bio,
          location: form.location,
          witchPath: form.witchPath,
        }),
      });
      if (res.ok) {
        setStatus('saved');
        setOriginalUsername(form.username);
        setTimeout(() => setStatus('idle'), 2500);
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string; message?: string };
        setSaveError(d.error ?? d.message ?? 'Failed to save. Please try again.');
        setStatus('error');
      }
    } catch {
      setSaveError('Network error. Please try again.');
      setStatus('error');
    }
  }

  function handleAvatarSelect(url: string) {
    setForm((f) => ({ ...f, image: url }));
    void refetch();
  }

  if (!session?.user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const usernameChanged = form.username.trim() !== originalUsername;

  return (
    <>
      <Helmet>
        <title>Edit Profile — Spellful</title>
        <meta name="description" content="Edit your Spellful profile name, username, bio, location, and avatar." />
        <meta name="robots" content="noindex" />
      </Helmet>

      {showAvatarPicker && (
        <AvatarPickerSheet
          current={form.image}
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      <main className="container mx-auto px-4 pt-4 pb-28 max-w-lg">
        {/* Back nav */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => navigate('/account')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Account
          </button>
        </div>

        <h1 className="font-serif text-2xl font-semibold text-foreground mb-5">Edit Profile</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSave(e); }} className="space-y-5">

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                {form.image ? (
                  <img
                    src={uploadedMediaUrl(form.image)}
                    alt="Your avatar"
                    className="w-16 h-16 rounded-full object-cover border-2"
                    style={{ borderColor: 'hsl(var(--primary)/0.4)' }}
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: 'hsl(var(--primary)/0.15)' }}
                  >
                    <span className="text-2xl">🧙</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(true)}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors hover:opacity-90"
                  style={{
                    background: 'hsl(var(--primary))',
                    borderColor: 'hsl(var(--background))',
                  }}
                  aria-label="Change avatar"
                >
                  <Camera className="w-3.5 h-3.5 text-primary-foreground" />
                </button>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Profile picture</p>
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(true)}
                  className="text-xs mt-0.5 transition-colors hover:opacity-80"
                  style={{ color: 'hsl(var(--primary))' }}
                >
                  Change photo
                </button>
              </div>
            </div>

            {/* Display name */}
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-muted border-border"
                placeholder="Your display name"
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username">{pg.profileTab.usernameLabel}</Label>
              {usernameCooldownDays !== null && usernameCooldownDays > 0 ? (
                <div
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
                >
                  @{originalUsername}
                  <span className="block text-xs mt-0.5">
                    Username can be changed again in {usernameCooldownDays} day{usernameCooldownDays !== 1 ? 's' : ''}.
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    className="bg-muted border-border pr-8"
                    placeholder="your_username"
                  />
                  {usernameChanged && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameChecking ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : usernameAvailable === true ? (
                        <Check className="w-4 h-4" style={{ color: 'hsl(var(--success))' }} />
                      ) : usernameAvailable === false ? (
                        <X className="w-4 h-4 text-destructive" />
                      ) : null}
                    </div>
                  )}
                </div>
              )}
              {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
              {usernameChanged && usernameAvailable && (
                <p className="text-xs" style={{ color: 'hsl(var(--success))' }}>Username available</p>
              )}
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <Label htmlFor="bio">{pg.profileTab.bioLabel}</Label>
              <textarea
                id="bio"
                rows={3}
                value={form.bio}
                placeholder={pg.profileTab.bioPlaceholder}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Location + Witch Path */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="location">{pg.profileTab.locationLabel}</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="bg-muted border-border"
                  placeholder="City, Country"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="witchPath">{pg.profileTab.witchPathLabel}</Label>
                <Input
                  id="witchPath"
                  value={form.witchPath}
                  onChange={(e) => setForm((f) => ({ ...f, witchPath: e.target.value }))}
                  className="bg-muted border-border"
                  placeholder="e.g. Eclectic, Green Witch"
                />
              </div>
            </div>

            {/* Studio shortcut */}
            <Link
              to="/account/profile"
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 border transition-colors hover:border-primary/60"
              style={{ background: 'hsl(var(--muted))', borderColor: 'hsl(var(--border))' }}
            >
              <div>
                <p className="text-sm font-medium text-foreground">Avatar frames, themes &amp; more</p>
                <p className="text-xs text-muted-foreground">Open Profile Design Studio</p>
              </div>
              <ChevronLeft className="w-4 h-4 rotate-180 text-muted-foreground flex-shrink-0" />
            </Link>

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}

            <Button
              type="submit"
              disabled={status === 'saving' || !!usernameError}
              className="w-full bg-primary text-primary-foreground"
            >
              {status === 'saving' ? pg.profileTab.savingButton : status === 'saved' ? pg.profileTab.savedButton : pg.profileTab.saveButton}
            </Button>

          </form>
        )}
      </main>
    </>
  );
}
