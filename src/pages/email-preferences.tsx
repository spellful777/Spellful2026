/**
 * /email-preferences — Marketing email preference center.
 * Accessed via signed token link in emails (no login required)
 * OR by authenticated users from account settings.
 */
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { email_preferences } from 'virtual:content';

interface Category {
  id: string;
  label: string;
  desc: string;
  consented: boolean;
}

type LoadState = 'loading' | 'ready' | 'invalid' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function EmailPreferencesPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeToken, setActiveToken] = useState('');

  useEffect(() => {
    if (!token) { setLoadState('invalid'); return; }
    fetch(`/api/email-preferences?token=${encodeURIComponent(token)}`)
      .then(async r => {
        if (r.status === 401) { setLoadState('invalid'); return; }
        if (!r.ok) { setLoadState('error'); return; }
        const data = await r.json() as { categories: Category[]; token: string };
        setCategories(data.categories);
        setActiveToken(data.token);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [token]);

  function toggle(id: string) {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, consented: !c.consented } : c));
    setSaveState('idle');
  }

  async function save() {
    setSaveState('saving');
    const catMap: Record<string, boolean> = {};
    for (const c of categories) catMap[c.id] = c.consented;
    try {
      const r = await fetch('/api/email-preferences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: activeToken, categories: catMap }),
      });
      setSaveState(r.ok ? 'saved' : 'error');
    } catch {
      setSaveState('error');
    }
  }

  const allOff = categories.every(c => !c.consented);

  return (
    <>
      <Helmet>
        <title>Email Preferences — Spellful</title>
        <meta name="description" content="Manage your Spellful email preferences and marketing subscriptions." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="min-h-screen flex items-center justify-center px-4"
            style={{ background: 'hsl(var(--background))' }}>
        <div className="w-full max-w-md py-16 space-y-6">
          {/* Logo */}
          <div className="text-center">
            <img src="/airo-assets/images/logo/email" alt="Spellful"
                 className="h-10 w-auto mx-auto mb-6" />
          </div>

          {loadState === 'loading' && (
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin" style={{ color: 'hsl(var(--primary))' }} />
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                Loading your preferences...
              </p>
            </div>
          )}

          {(loadState === 'invalid' || loadState === 'error') && (
            <div className="text-center space-y-4">
              <Mail className="w-10 h-10 mx-auto" style={{ color: 'hsl(var(--muted-foreground))' }} />
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
                {email_preferences.invalidTitle}
              </h1>
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                {email_preferences.invalidBody}
              </p>
              <Link to="/account">
                <Button variant="outline" className="w-full">Sign in to manage preferences</Button>
              </Link>
            </div>
          )}

          {loadState === 'ready' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold mb-1" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
                  {email_preferences.title}
                </h1>
                <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                  {email_preferences.subtitle}
                </p>
              </div>

              {/* Category toggles */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
                {categories.map((cat, i) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between px-4 py-4"
                    style={{
                      background: 'hsl(var(--card))',
                      borderTop: i > 0 ? '1px solid hsl(var(--border))' : 'none',
                    }}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>
                        {cat.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                        {cat.desc}
                      </p>
                    </div>
                    <Switch
                      checked={cat.consented}
                      onCheckedChange={() => toggle(cat.id)}
                      aria-label={`Toggle ${cat.label}`}
                    />
                  </div>
                ))}
              </div>

              {/* All-off notice */}
              {allOff && (
                <p className="text-xs px-1" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                  {email_preferences.allOffNote}
                </p>
              )}

              {/* Save button */}
              <Button
                className="w-full"
                onClick={save}
                disabled={saveState === 'saving'}
              >
                {saveState === 'saving' ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : saveState === 'saved' ? (
                  <><CheckCircle2 className="w-4 h-4 mr-2" />{email_preferences.savedMessage}</>
                ) : (
                  email_preferences.saveButton
                )}
              </Button>

              {saveState === 'error' && (
                <p className="text-xs text-center" style={{ color: 'hsl(var(--destructive))', fontFamily: 'var(--font-sans)' }}>
                  Could not save preferences. Please try again.
                </p>
              )}

              <p className="text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                <Link to="/" style={{ color: 'hsl(var(--primary))' }}>Return to Spellful</Link>
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
