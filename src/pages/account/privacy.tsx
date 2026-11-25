import { useState, useEffect, useCallback } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useSession } from '@/lib/auth/auth-client';
import { useNavigate, Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Eye, EyeOff, Users, Search, Bell, MessageSquare,
  Cake, BookOpen, AtSign, ChevronLeft, CheckCircle2, Loader2,
} from 'lucide-react';
import { privacy_sanctuary as pg } from 'virtual:content';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PrivacySettings {
  profileVisibility: 'public' | 'coven' | 'private';
  discoverable: boolean;
  searchIndexed: boolean;
  hideOnlineStatus: boolean;
  messagePermission: 'everyone' | 'coven' | 'nobody';
  birthdayVisibility: 'public' | 'coven' | 'private';
  shareBirthdayInFeed: boolean;
  guestbookEnabled: boolean;
  mentionsAllowed: boolean;
  notifPreviewPrivate: boolean;
  bioVisibility: 'public' | 'coven' | 'private';
  locationVisibility: 'public' | 'coven' | 'private';
  zodiacVisibility: 'public' | 'coven' | 'private';
  socialLinksVisibility: 'public' | 'coven' | 'private';
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type VisLevel = 'public' | 'coven' | 'private';
type MsgPerm = 'everyone' | 'coven' | 'nobody';

// ─── Shared style constants ───────────────────────────────────────────────────
const iconBoxStyle: React.CSSProperties = { background: 'hsl(var(--primary)/0.15)' };
const iconStyle: React.CSSProperties = { color: 'hsl(var(--primary))' };

// ─── Visibility selector ──────────────────────────────────────────────────────
function VisibilitySelector({ value, onChange, id }: { value: VisLevel; onChange: (v: VisLevel) => void; id: string }) {
  return (
    <div className="flex gap-2 flex-wrap" role="group" aria-label="Visibility options">
      <button type="button" id={`${id}-public`} onClick={() => onChange('public')}
        className={`rounded-lg border px-3 py-2 text-left text-xs transition-all ${value === 'public' ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground hover:border-primary/40'}`}>
        <span className="font-medium block">{pg.visibility.publicLabel}</span>
        <span className="opacity-70">{pg.visibility.publicDesc}</span>
      </button>
      <button type="button" id={`${id}-coven`} onClick={() => onChange('coven')}
        className={`rounded-lg border px-3 py-2 text-left text-xs transition-all ${value === 'coven' ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground hover:border-primary/40'}`}>
        <span className="font-medium block">{pg.visibility.covenLabel}</span>
        <span className="opacity-70">{pg.visibility.covenDesc}</span>
      </button>
      <button type="button" id={`${id}-private`} onClick={() => onChange('private')}
        className={`rounded-lg border px-3 py-2 text-left text-xs transition-all ${value === 'private' ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground hover:border-primary/40'}`}>
        <span className="font-medium block">{pg.visibility.privateLabel}</span>
        <span className="opacity-70">{pg.visibility.privateDesc}</span>
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PrivacySanctuaryPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/account/privacy-settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { settings?: PrivacySettings }) => { if (d.settings) setSettings(d.settings); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!session && !loading) navigate('/login'); }, [session, loading, navigate]);

  function update<K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
  }

  async function handleSave() {
    if (!settings || !dirty) return;
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/account/privacy-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      if (res.ok) { setSaveStatus('saved'); setDirty(false); setTimeout(() => setSaveStatus('idle'), 2500); }
      else setSaveStatus('error');
    } catch { setSaveStatus('error'); }
  }

  if (!session?.user) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading…</p></main>;
  }

  const username = (session.user as { username?: string }).username ?? '';

  const saveBtnLabel = saveStatus === 'saving' ? pg.header.savingButton : saveStatus === 'saved' ? pg.header.savedButton : pg.header.saveButton;

  return (
    <>
      <Helmet>
        <title>{pg.meta.title}</title>
        <meta name="description" content={pg.meta.description} />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <Link to="/account" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          <span>{pg.header.backLink}</span>
        </Link>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={iconBoxStyle}>
              <Shield className="w-5 h-5" style={iconStyle} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>{pg.header.title}</h1>
              <p className="text-sm text-muted-foreground">{pg.header.subtitle}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={!dirty || saveStatus === 'saving'} size="sm" className="gap-2 shrink-0">
            {saveStatus === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saveStatus === 'saved' && <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{saveBtnLabel}</span>
          </Button>
        </div>

        {loading || !settings ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: 'hsl(var(--muted))' }} />)}
          </div>
        ) : (
          <div className="space-y-5">

            {/* ── Profile visibility ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="sr-only">{pg.sections.profileVisibility.title}</CardTitle>
                <div className="flex items-start gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={iconBoxStyle}><Eye className="w-4 h-4" style={iconStyle} /></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pg.sections.profileVisibility.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pg.sections.profileVisibility.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">{pg.sections.profileVisibility.bioLabel}</Label>
                  <VisibilitySelector id="bio-visibility" value={settings.bioVisibility} onChange={(v) => update('bioVisibility', v)} />
                </div>
                <Separator className="bg-border" />
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">{pg.sections.profileVisibility.locationLabel}</Label>
                  <VisibilitySelector id="location-visibility" value={settings.locationVisibility} onChange={(v) => update('locationVisibility', v)} />
                </div>
                <Separator className="bg-border" />
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">{pg.sections.profileVisibility.zodiacLabel}</Label>
                  <VisibilitySelector id="zodiac-visibility" value={settings.zodiacVisibility} onChange={(v) => update('zodiacVisibility', v)} />
                </div>
                <Separator className="bg-border" />
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">{pg.sections.profileVisibility.socialLinksLabel}</Label>
                  <VisibilitySelector id="social-links-visibility" value={settings.socialLinksVisibility} onChange={(v) => update('socialLinksVisibility', v)} />
                </div>
                <div className="pt-1">
                  <Link to={`/u/${username}?preview=guest`} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>{pg.sections.profileVisibility.previewLink}</span>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* ── Discovery & search ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="sr-only">{pg.sections.discovery.title}</CardTitle>
                <div className="flex items-start gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={iconBoxStyle}><Search className="w-4 h-4" style={iconStyle} /></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pg.sections.discovery.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pg.sections.discovery.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{pg.sections.discovery.suggestionsLabel}</p>
                    <p className="text-xs text-muted-foreground">{pg.sections.discovery.suggestionsDesc}</p>
                  </div>
                  <Switch checked={settings.discoverable} onCheckedChange={(v) => update('discoverable', v)} aria-label="Appear in member suggestions" />
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{pg.sections.discovery.searchLabel}</p>
                    <p className="text-xs text-muted-foreground">{pg.sections.discovery.searchDesc}</p>
                  </div>
                  <Switch checked={settings.searchIndexed} onCheckedChange={(v) => update('searchIndexed', v)} aria-label="Appear in on-site search" />
                </div>
              </CardContent>
            </Card>

            {/* ── Presence ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="sr-only">{pg.sections.presence.title}</CardTitle>
                <div className="flex items-start gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={iconBoxStyle}><Users className="w-4 h-4" style={iconStyle} /></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pg.sections.presence.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pg.sections.presence.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{pg.sections.presence.hideLabel}</p>
                    <p className="text-xs text-muted-foreground">{pg.sections.presence.hideDesc}</p>
                  </div>
                  <Switch checked={settings.hideOnlineStatus} onCheckedChange={(v) => update('hideOnlineStatus', v)} aria-label="Hide online status" />
                </div>
              </CardContent>
            </Card>

            {/* ── Messaging ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="sr-only">{pg.sections.messaging.title}</CardTitle>
                <div className="flex items-start gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={iconBoxStyle}><MessageSquare className="w-4 h-4" style={iconStyle} /></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pg.sections.messaging.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pg.sections.messaging.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap" role="group" aria-label="Message permission">
                  {(
                    [
                      { value: 'everyone' as MsgPerm, label: pg.messageOptions.everyoneLabel },
                      { value: 'coven' as MsgPerm, label: pg.messageOptions.covenLabel },
                      { value: 'nobody' as MsgPerm, label: pg.messageOptions.nobodyLabel },
                    ]
                  ).map((opt) => (
                    <button key={opt.value} type="button" onClick={() => update('messagePermission', opt.value)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${settings.messagePermission === opt.value ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground hover:border-primary/40'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.messagePermission === 'everyone' && pg.sections.messaging.everyoneDesc}
                  {settings.messagePermission === 'coven' && pg.sections.messaging.covenDesc}
                  {settings.messagePermission === 'nobody' && pg.sections.messaging.nobodyDesc}
                </p>
              </CardContent>
            </Card>

            {/* ── Birthday ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="sr-only">{pg.sections.birthday.title}</CardTitle>
                <div className="flex items-start gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={iconBoxStyle}><Cake className="w-4 h-4" style={iconStyle} /></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pg.sections.birthday.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pg.sections.birthday.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">{pg.sections.birthday.visibilityLabel}</Label>
                  <VisibilitySelector id="birthday-visibility" value={settings.birthdayVisibility} onChange={(v) => update('birthdayVisibility', v)} />
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{pg.sections.birthday.feedLabel}</p>
                    <p className="text-xs text-muted-foreground">{pg.sections.birthday.feedDesc}</p>
                  </div>
                  <Switch checked={settings.shareBirthdayInFeed} onCheckedChange={(v) => update('shareBirthdayInFeed', v)} aria-label="Share birthday in community feed" />
                </div>
              </CardContent>
            </Card>

            {/* ── Interactions ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="sr-only">{pg.sections.interactions.title}</CardTitle>
                <div className="flex items-start gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={iconBoxStyle}><AtSign className="w-4 h-4" style={iconStyle} /></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pg.sections.interactions.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pg.sections.interactions.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{pg.sections.interactions.guestbookLabel}</p>
                    <p className="text-xs text-muted-foreground">{pg.sections.interactions.guestbookDesc}</p>
                  </div>
                  <Switch checked={settings.guestbookEnabled} onCheckedChange={(v) => update('guestbookEnabled', v)} aria-label="Allow guestbook messages" />
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{pg.sections.interactions.mentionsLabel}</p>
                    <p className="text-xs text-muted-foreground">{pg.sections.interactions.mentionsDesc}</p>
                  </div>
                  <Switch checked={settings.mentionsAllowed} onCheckedChange={(v) => update('mentionsAllowed', v)} aria-label="Allow @mentions" />
                </div>
              </CardContent>
            </Card>

            {/* ── Notifications ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="sr-only">{pg.sections.notifications.title}</CardTitle>
                <div className="flex items-start gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={iconBoxStyle}><Bell className="w-4 h-4" style={iconStyle} /></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pg.sections.notifications.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pg.sections.notifications.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{pg.sections.notifications.lockScreenLabel}</p>
                    <p className="text-xs text-muted-foreground">{pg.sections.notifications.lockScreenDesc}</p>
                  </div>
                  <Switch checked={settings.notifPreviewPrivate} onCheckedChange={(v) => update('notifPreviewPrivate', v)} aria-label="Hide message content on lock screen" />
                </div>
              </CardContent>
            </Card>

            {/* ── Blocked accounts ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="sr-only">{pg.sections.blocked.title}</CardTitle>
                <div className="flex items-start gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={iconBoxStyle}><BookOpen className="w-4 h-4" style={iconStyle} /></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pg.sections.blocked.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pg.sections.blocked.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link to="/account" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  <span>{pg.sections.blocked.manageLink}</span>
                </Link>
              </CardContent>
            </Card>

            {/* ── Data rights ── */}
            <Card className="bg-card border-border">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="text-xs shrink-0 mt-0.5">{pg.sections.dataRights.badge}</Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span>You can </span>
                    <Link to="/account" className="text-primary hover:underline">{pg.sections.dataRights.downloadLink}</Link>
                    <span> or </span>
                    <Link to="/account" className="text-primary hover:underline">{pg.sections.dataRights.deletionLink}</Link>
                    <span> at any time from Account Settings. Read our </span>
                    <Link to="/privacy" className="text-primary hover:underline">{pg.sections.dataRights.privacyLink}</Link>
                    <span> to learn exactly what we collect and how long we keep it.</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {saveStatus === 'error' && (
              <p className="text-sm text-destructive text-center">{pg.errorMessage}</p>
            )}

            <div className="flex justify-end pb-8">
              <Button onClick={handleSave} disabled={!dirty || saveStatus === 'saving'} className="gap-2">
                {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
                {saveStatus === 'saved' && <CheckCircle2 className="w-4 h-4" />}
                <span>{saveBtnLabel}</span>
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
