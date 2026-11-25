/**
 * /unsubscribe — One-click unsubscribe from all Spellful marketing emails.
 * Reads ?token= from URL, calls POST /api/unsubscribe, shows confirmation.
 * No login required.
 */
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { unsubscribe } from 'virtual:content';

type State = 'loading' | 'success' | 'error' | 'invalid';

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.ok ? setState('success') : setState('error'))
      .catch(() => setState('error'));
  }, [token]);

  return (
    <>
      <Helmet>
        <title>Unsubscribe — Spellful</title>
        <meta name="description" content="Unsubscribe from Spellful marketing emails." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="min-h-screen flex items-center justify-center px-4"
            style={{ background: 'hsl(var(--background))' }}>
        <div className="w-full max-w-md text-center space-y-6 py-16">
          {/* Logo */}
          <img src="/airo-assets/images/logo/email" alt="Spellful"
               className="h-10 w-auto mx-auto" />

          {state === 'loading' && (
            <>
              <Loader2 className="w-10 h-10 mx-auto animate-spin" style={{ color: 'hsl(var(--primary))' }} />
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                Processing your request...
              </p>
            </>
          )}

          {state === 'success' && (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: 'hsl(var(--success))' }} />
              <h1 className="text-2xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
                {unsubscribe.title}
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                {unsubscribe.subtitle}
              </p>
              <div className="flex flex-col gap-3 pt-2">
                <Link to="/email-preferences" className="text-sm underline"
                      style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}>
                  {unsubscribe.manageLink}
                </Link>
                <Link to="/">
                  <Button variant="outline" className="w-full">{unsubscribe.returnLink}</Button>
                </Link>
              </div>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle className="w-12 h-12 mx-auto" style={{ color: 'hsl(var(--destructive))' }} />
              <h1 className="text-2xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
                {unsubscribe.errorTitle}
              </h1>
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                {unsubscribe.errorBody}
              </p>
            </>
          )}

          {state === 'invalid' && (
            <>
              <Mail className="w-12 h-12 mx-auto" style={{ color: 'hsl(var(--muted-foreground))' }} />
              <h1 className="text-2xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
                {unsubscribe.invalidTitle}
              </h1>
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                {unsubscribe.invalidBody}
              </p>
              <Link to="/account">
                <Button variant="outline" className="w-full">{unsubscribe.signInLink}</Button>
              </Link>
            </>
          )}
        </div>
      </main>
    </>
  );
}
