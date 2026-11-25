/**
 * ProfileLinkShareSheet — clean link-only profile sharing for Spellful.
 *
 * Spec: Profile Link Sharing 2.0
 * - No canvas, no QR code, no image generation.
 * - Works for own profile (first-person copy) and others (third-person).
 * - Native share sheet on iOS/Android via @capacitor/share, Web Share API
 *   on desktop, clipboard fallback everywhere.
 * - Canonical URL: https://spellful.com/u/{username}
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, Share2, ExternalLink } from 'lucide-react';
import { shareContent } from '@/lib/share-studio';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileLinkShareSheetProps {
  open: boolean;
  onClose: () => void;
  /** The profile being shared */
  username: string;
  displayName?: string | null;
  bio?: string | null;
  /** true when the viewer is sharing their own profile */
  isOwn?: boolean;
}

// ─── Share option row ─────────────────────────────────────────────────────────

function ShareRow({
  icon,
  label,
  sublabel,
  onClick,
  disabled,
  success,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled?: boolean;
  success?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left"
      style={{
        background: success ? 'hsl(var(--success) / 0.12)' : 'hsl(var(--muted))',
        border: `1px solid ${success ? 'hsl(var(--success) / 0.3)' : 'hsl(var(--border))'}`,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: success ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--card))',
          color: success ? 'hsl(var(--success))' : 'hsl(var(--foreground))',
        }}
      >
        {success ? <Check className="w-4 h-4" /> : icon}
      </span>
      <div className="min-w-0">
        <p
          className="text-sm font-medium leading-tight"
          style={{
            fontFamily: 'var(--font-heading)',
            color: success ? 'hsl(var(--success))' : 'hsl(var(--foreground))',
          }}
        >
          {success ? 'Copied!' : label}
        </p>
        {sublabel && (
          <p
            className="text-xs mt-0.5 truncate"
            style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
          >
            {sublabel}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfileLinkShareSheet({
  open,
  onClose,
  username,
  displayName,
  bio,
  isOwn = false,
}: ProfileLinkShareSheetProps) {
  const [sharing, setSharing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [textCopied, setTextCopied] = useState(false);

  const name = displayName || username;
  const profileUrl = `https://spellful.com/u/${encodeURIComponent(username)}`;

  // First-person vs third-person share copy
  const shareTitle = isOwn
    ? `${name} on Spellful`
    : `${name} (@${username}) on Spellful`;

  const shareText = isOwn
    ? (bio
        ? `${bio}\n\n${profileUrl}`
        : `Join me on Spellful — the home for witches, mystics & magical folk ✨\n\n${profileUrl}`)
    : (bio
        ? `Check out ${name} on Spellful ✨\n\n${bio}\n\n${profileUrl}`
        : `Check out ${name} (@${username}) on Spellful ✨\n\n${profileUrl}`);

  const hasNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleNativeShare = useCallback(async () => {
    setSharing(true);
    try {
      await shareContent({ title: shareTitle, text: shareText, url: profileUrl });
    } finally {
      setSharing(false);
    }
  }, [shareTitle, shareText, profileUrl]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      // ignore
    }
  }, [profileUrl]);

  const handleCopyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setTextCopied(true);
      setTimeout(() => setTextCopied(false), 2500);
    } catch {
      // ignore
    }
  }, [shareText]);

  const handleTwitter = useCallback(() => {
    const tweetText = isOwn
      ? `${bio ? bio + '\n\n' : ''}Join me on Spellful ✨`
      : `Check out ${name} on Spellful ✨`;
    const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
  }, [isOwn, bio, name, profileUrl]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="profile-share-backdrop"
            className="fixed inset-0 z-50"
            style={{ background: 'hsl(var(--background) / 0.75)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Bottom sheet */}
          <motion.div
            key="profile-share-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Share ${isOwn ? 'your' : name + "'s"} profile`}
            className="fixed left-0 right-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 md:w-full md:max-w-md rounded-t-2xl md:rounded-2xl overflow-hidden"
            style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              boxShadow: '0 -8px 40px 0 hsl(var(--background) / 0.5)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 34, mass: 0.9 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: 'hsl(var(--muted-foreground) / 0.4)' }} />
            </div>

            {/* Header */}
            <div
              className="flex items-center justify-between px-5 pt-4 pb-4"
              style={{ borderBottom: '1px solid hsl(var(--border))' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'hsl(var(--accent) / 0.15)', color: 'hsl(var(--accent))' }}
                >
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <p
                    className="text-sm font-semibold leading-tight"
                    style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--foreground))' }}
                  >
                    {isOwn ? 'Share your profile' : `Share ${name}'s profile`}
                  </p>
                  <p
                    className="text-xs mt-0.5 truncate max-w-[200px]"
                    style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
                  >
                    spellful.com/u/{username}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
                aria-label="Close share sheet"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options */}
            <div className="px-5 py-4 flex flex-col gap-2.5">
              {/* Native share — shown when available */}
              {hasNativeShare && (
                <ShareRow
                  icon={<Share2 className="w-4 h-4" />}
                  label="Share via…"
                  sublabel="Opens your device's share sheet"
                  onClick={() => void handleNativeShare()}
                  disabled={sharing}
                />
              )}

              {/* Copy link */}
              <ShareRow
                icon={<Copy className="w-4 h-4" />}
                label="Copy link"
                sublabel={profileUrl}
                onClick={() => void handleCopyLink()}
                success={linkCopied}
              />

              {/* Copy text */}
              <ShareRow
                icon={<Copy className="w-4 h-4" />}
                label={isOwn ? 'Copy invite text' : 'Copy share text'}
                sublabel={shareText.slice(0, 60) + (shareText.length > 60 ? '…' : '')}
                onClick={() => void handleCopyText()}
                success={textCopied}
              />

              {/* Share on X */}
              <ShareRow
                icon={
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                }
                label="Share on X"
                sublabel="Opens X (Twitter) in a new tab"
                onClick={handleTwitter}
              />

              {/* Open profile */}
              <ShareRow
                icon={<ExternalLink className="w-4 h-4" />}
                label={isOwn ? 'View your public profile' : "Open profile"}
                sublabel={profileUrl}
                onClick={() => window.open(profileUrl, '_blank', 'noopener,noreferrer')}
              />
            </div>

            {/* Footer note */}
            <p
              className="text-center text-[11px] pb-5 px-5"
              style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
            >
              {isOwn
                ? 'Share your profile link — no image or QR code is generated.'
                : 'Sharing a link to this public profile.'}
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
