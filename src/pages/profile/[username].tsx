/**
 * /profile/:username — legacy route.
 * Permanently redirects to the canonical /u/:username profile URL.
 * Preserves all existing deep links shared before the canonical path was established.
 */
import { Navigate, useParams } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';

export default function ProfileRedirectPage() {
  const { username } = useParams<{ username: string }>();

  if (!username) return <Navigate to="/" replace />;

  const canonical = `https://spellful.com/u/${encodeURIComponent(username)}`;

  return (
    <>
      <Helmet>
        <title>Redirecting… — Spellful</title>
        <meta name="description" content="This profile has moved to a new URL." />
        <meta name="robots" content="noindex" />
        <link rel="canonical" href={canonical} />
      </Helmet>
      {/* Visually hidden — page redirects immediately via Navigate below */}
      <h1 className="sr-only">Redirecting to profile</h1>
      <Navigate to={`/u/${encodeURIComponent(username)}`} replace />
    </>
  );
}
