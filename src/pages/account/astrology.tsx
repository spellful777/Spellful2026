/**
 * /account/astrology — Birth info and zodiac signs
 * Fixes mobile overflow on date/time inputs
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useSession } from '@/lib/auth/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { account as pg } from 'virtual:content';

const SIGN_EMOJI: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋',
  Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏',
  Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};

interface AstroForm {
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  sunSign: string;
  moonSign: string;
  risingSign: string;
}

export default function AstrologyPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  const [form, setForm] = useState<AstroForm>({
    birthDate: '', birthTime: '', birthLocation: '',
    sunSign: '', moonSign: '', risingSign: '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/account/astrology', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { astrology?: AstroForm }) => { if (d.astrology) setForm(d.astrology); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch('/api/account/astrology', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? 'saved' : 'error');
      if (res.ok) setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('error');
    }
  }

  if (!session?.user) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading…</p></main>;
  }

  const hasSigns = form.sunSign || form.moonSign || form.risingSign;

  return (
    <>
      <Helmet>
        <title>Astrology — Spellful</title>
        <meta name="description" content="Set your birth date, time, location, and zodiac signs for your Spellful astrological profile." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="container mx-auto px-4 pt-4 pb-28 max-w-lg">
        <button
          onClick={() => navigate('/account')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ChevronLeft className="w-4 h-4" />
          Account
        </button>

        <h1 className="font-serif text-2xl font-semibold text-foreground mb-1">Astrology</h1>
        <p className="text-sm text-muted-foreground mb-6">Your astrological profile and birth information.</p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSave(e); }} className="space-y-5">

            {/* Sign summary — shown when signs are set */}
            {hasSigns && (
              <div
                className="grid grid-cols-3 gap-3 rounded-2xl p-4"
                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              >
                {[
                  { key: 'sunSign', label: 'Sun', emoji: '☀️' },
                  { key: 'moonSign', label: 'Moon', emoji: '🌙' },
                  { key: 'risingSign', label: 'Rising', emoji: '⬆️' },
                ].map(({ key, label, emoji }) => {
                  const sign = form[key as keyof AstroForm];
                  return (
                    <div key={key} className="flex flex-col items-center gap-1 text-center">
                      <span className="text-xl">{sign ? (SIGN_EMOJI[sign] ?? emoji) : emoji}</span>
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium text-foreground">{sign || '—'}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Birth info — fixed mobile overflow with w-full min-w-0 */}
            <div
              className="rounded-2xl border p-4 space-y-4"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
            >
              <p className="text-sm font-medium text-foreground">Birth Information</p>

              {/* Date + Time on same row — each constrained to prevent overflow */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="birthDate" className="text-xs">{pg.astroTab.birthDateLabel}</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                    className="bg-muted border-border w-full min-w-0 text-sm"
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="birthTime" className="text-xs">{pg.astroTab.birthTimeLabel}</Label>
                  <Input
                    id="birthTime"
                    type="time"
                    value={form.birthTime}
                    onChange={(e) => setForm((f) => ({ ...f, birthTime: e.target.value }))}
                    className="bg-muted border-border w-full min-w-0 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="birthLocation">{pg.astroTab.birthLocationLabel}</Label>
                <Input
                  id="birthLocation"
                  value={form.birthLocation}
                  onChange={(e) => setForm((f) => ({ ...f, birthLocation: e.target.value }))}
                  className="bg-muted border-border"
                  placeholder="City, Country"
                />
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Zodiac signs */}
            <div
              className="rounded-2xl border p-4 space-y-4"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
            >
              <p className="text-sm font-medium text-foreground">Zodiac Signs</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(
                  [
                    { key: 'sunSign',    label: pg.astroTab.sunSignLabel    },
                    { key: 'moonSign',   label: pg.astroTab.moonSignLabel   },
                    { key: 'risingSign', label: pg.astroTab.risingSignLabel },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key}>{label}</Label>
                    <select
                      id={key}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">— select —</option>
                      {pg.ZODIAC_SIGNS.map((sign) => (
                        <option key={sign} value={sign}>{sign}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {status === 'error' && (
              <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
            )}

            <Button type="submit" disabled={status === 'saving'} className="w-full bg-primary text-primary-foreground">
              {status === 'saving' ? 'Saving…' : status === 'saved' ? pg.astroTab.savedButton : pg.astroTab.saveButton}
            </Button>
          </form>
        )}
      </main>
    </>
  );
}
