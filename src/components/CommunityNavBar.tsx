import { uploadedMediaUrl } from '@/lib/native-api';
/**
 * CommunityNavBar — compact signed-in header for /community
 * Shown only when the user is authenticated; replaces the large hero for members.
 */
import { useState, useRef, useEffect } from 'react';
import type React from 'react';
import { Link } from 'react-router';
import { Bell, PenLine, HelpCircle, BookOpen, Shield, BookMarked, ChevronDown, Sparkles, Bug, Megaphone, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CommunityStatsInline from '@/components/CommunityStatsInline';
import CommunitySearchBar from '@/components/CommunitySearchBar';

interface Props {
  userName?: string | null;
  userImage?: string | null;
  username?: string | null;
  unread: number;
  search: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
}

const HELP_LINKS = [
  { href: '/community/help/getting-started', label: 'Getting Started', icon: <Sparkles className="w-4 h-4" /> },
  { href: '/community/help/getting-started', label: 'Community Code', icon: <BookOpen className="w-4 h-4" />, hash: '#code' },
  { href: '/community/help/faq', label: 'FAQ', icon: <HelpCircle className="w-4 h-4" /> },
  { href: '/community/help/glossary', label: 'Witchcraft Glossary', icon: <BookMarked className="w-4 h-4" /> },
  { href: '/community/help/safety', label: 'Safety & Privacy', icon: <Shield className="w-4 h-4" /> },
  { href: '/community/help/report-a-bug', label: 'Report a Bug', icon: <Bug className="w-4 h-4" /> },
];

const COMMUNITY_LINKS = [
  { href: '/community/announcements', label: "What's New", icon: <Megaphone className="w-4 h-4" /> },
  { href: '/community/suggestions', label: 'Feature Requests', icon: <Lightbulb className="w-4 h-4" /> },
];

export default function CommunityNavBar({
  userName,
  userImage,
  username,
  unread,
  search,
  onSearchChange,
  onSearchSubmit,
}: Props) {
  const firstNameInitial = (userName ?? '?')[0].toUpperCase();
  const firstName = userName ? userName.split(' ')[0] : null;
  const profileHref = username ? '/u/' + username : '/account';

  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    }
    if (helpOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [helpOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
      {/* Main nav row */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-3">
        {/* Logo — compact */}
        <Link to="/" className="shrink-0 flex items-center" aria-label="Spellful home">
          <img
            src="/airo-assets/images/logo/horizontal"
            alt="Spellful"
            className="block h-auto object-contain"
            style={{ maxHeight: 28, width: 'auto' }}
            loading="eager"
          />
        </Link>

        {/* Heading + optional greeting */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-heading text-base md:text-lg leading-none truncate text-foreground">
            Community
          </span>
          {firstName && (
            <span className="hidden sm:inline text-xs truncate text-muted-foreground">
              · Welcome back, {firstName}
            </span>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Help dropdown */}
          <div ref={helpRef} className="relative">
            <button
              onClick={() => setHelpOpen((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-expanded={helpOpen}
              aria-haspopup="true"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden md:inline">Help</span>
              <ChevronDown className={['w-3 h-3 transition-transform duration-150', helpOpen ? 'rotate-180' : ''].join(' ')} />
            </button>

            {helpOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden"
                role="menu"
              >
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Community</p>
                </div>
                {COMMUNITY_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href}
                    onClick={() => setHelpOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                    role="menuitem"
                  >
                    <span className="text-muted-foreground">{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
                <div className="px-3 py-2 border-t border-b border-border">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Help & Resources</p>
                </div>
                {HELP_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href + (link.hash ?? '')}
                    onClick={() => setHelpOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                    role="menuitem"
                  >
                    <span className="text-muted-foreground">{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* New Post */}
          <Link to="/community/new">
            <Button
              size="sm"
              className="gap-1.5 text-xs font-semibold px-3 py-1.5 h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Post</span>
            </Button>
          </Link>

          {/* Notifications */}
          <Link to="/community/notifications" className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Button>
          </Link>

          {/* Avatar */}
          {userImage ? (
            <Link to={profileHref} aria-label="Your profile">
              <img
                src={uploadedMediaUrl(userImage)}
                alt={userName ?? 'Profile'}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-border hover:ring-primary/60 transition-all"
              />
            </Link>
          ) : (
            <Link
              to={profileHref}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground ring-1 ring-border hover:ring-primary/60 transition-all"
              aria-label="Your profile"
            >
              {firstNameInitial}
            </Link>
          )}
        </div>
      </div>

      {/* Stats + search sub-row */}
      <div className="border-t border-border/50 bg-[hsl(var(--card-deep))]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-2 flex items-center gap-3">
          <CommunityStatsInline />
          <div className="flex-1" />
          <CommunitySearchBar
            value={search}
            onChange={onSearchChange}
            onSubmit={onSearchSubmit}
          />
        </div>
      </div>
    </header>
  );
}
