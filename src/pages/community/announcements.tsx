/**
 * /community/announcements
 * Official Spellful announcements, What's New, changelog, and events.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import {
  Megaphone, Sparkles, ScrollText, Calendar, Pin, RefreshCw, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { community_announcements as content } from 'virtual:content';

interface Announcement {
  id: number;
  type: string;
  title: string;
  body: string;
  isPinned: boolean;
  publishedAt: string;
  authorName: string | null;
  authorUsername: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  announcement: { label: 'Announcement', color: 'hsl(var(--primary))', icon: <Megaphone className="w-3.5 h-3.5" /> },
  'whats-new': { label: "What's New", color: 'hsl(var(--secondary))', icon: <Sparkles className="w-3.5 h-3.5" /> },
  changelog: { label: 'Changelog', color: 'hsl(var(--accent))', icon: <ScrollText className="w-3.5 h-3.5" /> },
  event: { label: 'Event', color: 'hsl(var(--info))', icon: <Calendar className="w-3.5 h-3.5" /> },
};

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/community/announcements');
      if (res.ok) {
        const data = await res.json() as { announcements: Announcement[] };
        setAnnouncements(data.announcements);
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter ? announcements.filter(a => a.type === filter) : announcements;

  const FILTERS = [
    { value: '', label: content.filterAll },
    { value: 'announcement', label: content.filterAnnouncement },
    { value: 'whats-new', label: content.filterWhatsNew },
    { value: 'changelog', label: content.filterChangelog },
    { value: 'event', label: content.filterEvent },
  ];

  return (
    <>
      <Helmet>
        <title>{content.meta.title}</title>
        <meta name="description" content={content.meta.description} />
      </Helmet>

      <main className="min-h-screen py-8 px-4 max-w-3xl mx-auto">
        <Link to="/community" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Community
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
              {content.heading}
            </h1>
            <p className="text-sm text-muted-foreground">{content.subheading}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={load} className="ml-auto text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-6">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                filter === f.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Megaphone className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-foreground mb-1">{content.emptyHeading}</p>
            <p className="text-sm text-muted-foreground">{content.emptyBody}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => {
              const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG['announcement'];
              const isExpanded = expanded === item.id;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                  style={item.isPinned ? { borderColor: 'hsl(var(--primary) / 0.4)' } : {}}
                >
                  <button
                    onClick={() => setExpanded(isExpanded ? null : item.id)}
                    className="w-full text-left p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {item.isPinned && <Pin className="w-3.5 h-3.5 text-primary shrink-0" />}
                          <span className="text-sm font-semibold text-foreground">{item.title}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1" style={{ color: cfg.color }}>
                            {cfg.icon}
                            {cfg.label}
                          </span>
                          <span>·</span>
                          <span>{formatDate(item.publishedAt)}</span>
                          {item.authorName && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-primary" />
                                <span className="text-primary font-medium">{content.staffBadge}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border/50 pt-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{item.body}</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
