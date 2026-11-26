import { COMMENT_GIF_SETTING } from '@/lib/spark-comments';
/**
 * /account/accessibility — Reduce motion, text size, high contrast
 * Applies and saves immediately on change
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useSession } from '@/lib/auth/auth-client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronLeft } from 'lucide-react';
import { account_accessibility as pg } from 'virtual:content';

type FontSize = 'normal' | 'large' | 'larger';

function applyAccessibility(rm: boolean, fs: FontSize, hc: boolean) {
  const html = document.documentElement;
  html.classList.toggle('reduce-motion', rm);
  html.classList.remove('font-size-large', 'font-size-larger');
  if (fs !== 'normal') html.classList.add(`font-size-${fs}`);
  html.classList.toggle('high-contrast', hc);
  localStorage.setItem('spellful-reduced-motion', String(rm));
  localStorage.setItem('spellful-font-size', fs);
  localStorage.setItem('spellful-high-contrast', String(hc));
}

export default function AccessibilityPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('spellful-reduced-motion') === 'true' : false
  );
  const [fontSize, setFontSize] = useState<FontSize>(() =>
    typeof window !== 'undefined'
      ? ((localStorage.getItem('spellful-font-size') as FontSize) || 'normal')
      : 'normal'
  );
  const [highContrast, setHighContrast] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('spellful-high-contrast') === 'true' : false
  );

  const [commentGifs, setCommentGifs] = useState(true);
  const [gifSettingError, setGifSettingError] = useState(false);
  useEffect(() => {
    if (!session?.user?.id) return;
    const abort = new AbortController();
    setCommentGifs(localStorage.getItem(COMMENT_GIF_SETTING) !== 'false');
    fetch('/api/account/privacy-settings', { signal: abort.signal }).then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!abort.signal.aborted && typeof data?.settings?.commentGifsEnabled === 'boolean')
          setCommentGifs(data.settings.commentGifsEnabled);
      }).catch(() => {});
    return () => abort.abort();
  }, [session?.user?.id]);

  async function updateCommentGifs(enabled: boolean) {
    const previous = commentGifs;
    setCommentGifs(enabled);
    setGifSettingError(false);
    try {
      const response = await fetch('/api/account/privacy-settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentGifsEnabled: enabled }),
      });
      if (!response.ok) throw Error();
      localStorage.setItem(COMMENT_GIF_SETTING, String(enabled));
    } catch { setCommentGifs(previous); setGifSettingError(true); }
  }

  // Apply on mount
  useEffect(() => {
    applyAccessibility(reducedMotion, fontSize, highContrast);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session?.user) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading…</p></main>;
  }

  return (
    <>
      <Helmet>
        <title>Accessibility — Spellful</title>
        <meta name="description" content="Adjust motion, text size, and contrast settings for your Spellful experience." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="container mx-auto px-4 pt-4 pb-28 max-w-lg">
        <button
          onClick={() => navigate('/account')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ChevronLeft className="w-4 h-4" />
          {pg.backLabel}
        </button>

        <h1 className="font-serif text-2xl font-semibold text-foreground mb-1">{pg.title}</h1>
        <p className="text-sm text-muted-foreground mb-6">{pg.subtitle}</p>

        <div
          className="rounded-2xl border overflow-hidden divide-y"
          style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
        >
          {/* Reduce motion */}
          <div className="flex items-center justify-between px-4 py-4 gap-4">
            <div className="flex-1 min-w-0">
              <Label htmlFor="reduce-motion" className="text-sm font-medium text-foreground cursor-pointer">
                {pg.reduceMotion.label}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pg.reduceMotion.desc}
              </p>
            </div>
            <Switch
              id="reduce-motion"
              checked={reducedMotion}
              onCheckedChange={(v) => {
                setReducedMotion(v);
                applyAccessibility(v, fontSize, highContrast);
              }}
            />
          </div>

          {/* High contrast */}
          <div className="flex items-center justify-between px-4 py-4 gap-4">
            <div className="flex-1 min-w-0">
              <Label htmlFor="high-contrast" className="text-sm font-medium text-foreground cursor-pointer">
                {pg.highContrast.label}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pg.highContrast.desc}
              </p>
            </div>
            <Switch
              id="high-contrast"
              checked={highContrast}
              onCheckedChange={(v) => {
                setHighContrast(v);
                applyAccessibility(reducedMotion, fontSize, v);
              }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <Label htmlFor="comment-gifs">Show the GIF picker in Spark comments</Label>
          <Switch id="comment-gifs" checked={commentGifs} onCheckedChange={enabled => void updateCommentGifs(enabled)} />
          {gifSettingError && <p role="alert">Couldn’t save the GIF setting.</p>}
        </div>

        {/* Text size */}
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
            {pg.textSizeLabel}
          </p>
          <div
            className="rounded-2xl border overflow-hidden divide-y"
            style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
          >
            {pg.fontSizeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setFontSize(opt.value as FontSize);
                  applyAccessibility(reducedMotion, opt.value as FontSize, highContrast);
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/60"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
                {fontSize === opt.value && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(var(--primary))' }}
                  >
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
