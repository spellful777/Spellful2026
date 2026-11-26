/**
 * /community/help/getting-started
 * Tabbed page: Getting Started guide + versioned Community Code with acknowledgment.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import {
  BookOpen, Shield, CheckCircle, ChevronRight, ArrowLeft,
  Sparkles, Users, Lock, Heart, AlertTriangle, Globe, Leaf, Zap, Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/lib/auth/auth-client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CommunityRules {
  id: number;
  version: string;
  title: string;
  effectiveDate: string;
  summary: string;
  body: string;
  isCurrent: boolean;
}

// ── Rule section icons ────────────────────────────────────────────────────────
const RULE_ICONS: Record<number, React.ReactNode> = {
  1: <Globe className="w-5 h-5" />,
  2: <Sparkles className="w-5 h-5" />,
  3: <Heart className="w-5 h-5" />,
  4: <Shield className="w-5 h-5" />,
  5: <Lock className="w-5 h-5" />,
  6: <BookOpen className="w-5 h-5" />,
  7: <AlertTriangle className="w-5 h-5" />,
  8: <Leaf className="w-5 h-5" />,
  9: <Zap className="w-5 h-5" />,
  10: <Ban className="w-5 h-5" />,
};

// ── Getting Started guide content ─────────────────────────────────────────────
const GUIDE_SECTIONS = [
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Welcome to the Community',
    body: 'The Spellful Community is a space for witches, pagans, and spiritual practitioners of all paths and experience levels. Whether you are just beginning your practice or have been walking this path for decades, you belong here.',
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: 'Set Up Your Profile',
    body: 'Visit Account → Profile Studio to add your display name, bio, witch path, and profile photo. Choose a cover image and avatar frame that reflects your practice. Your profile is your home in the community.',
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    title: 'Explore the Feed',
    body: 'The community feed shows discussions, questions, and posts from practitioners across Spellful. Use the filter tabs — Feed, Latest, Popular, Unanswered, and Following — to find content that interests you. The Discover view shows posts from the whole community.',
  },
  {
    icon: <Heart className="w-6 h-6" />,
    title: 'Build Your Coven',
    body: 'My Coven is your personal circle within Spellful. Follow other practitioners, invite trusted members to your coven, and share posts with your coven only. Building connections makes the community richer for everyone.',
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'Start a Discussion',
    body: 'Use the New Post button to share a thought, ask a question, or start a discussion. Choose the right category for your post, add relevant tags, and be as specific as you can. The community is here to help.',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Stay Safe',
    body: 'Read the Community Code before posting. Use the report function if you see content that violates our rules. Block or mute members who make you uncomfortable. Your safety and wellbeing matter here.',
  },
  {
    icon: <Lock className="w-6 h-6" />,
    title: 'Control Your Privacy',
    body: 'Visit Account → My Privacy Sanctuary to control who can see your profile, who can message you, and whether you appear in search results. Your privacy settings are yours to manage.',
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: 'Explore Spellful',
    body: 'Beyond the community, Spellful offers tarot readings, moon calendars, astrology charts, a spell library, herb and crystal guides, rune readings, numerology, and your personal Grimoire. Everything is connected.',
  },
];

// ── Parse markdown-style body into rule sections ──────────────────────────────
function parseRuleSections(body: string) {
  const sections: { number: number; title: string; content: string }[] = [];
  const parts = body.split(/^## /m).filter(Boolean);
  for (const part of parts) {
    const firstLine = part.split('\n')[0];
    const match = firstLine.match(/^(\d+)\. (.+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      const title = match[2];
      const content = part.slice(firstLine.length).trim();
      sections.push({ number: num, title, content });
    }
  }
  return sections;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GettingStartedPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'guide' | 'code'>('guide');
  const [rules, setRules] = useState<CommunityRules | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/community/help/rules');
        if (res.ok) {
          const data = await res.json() as { rules: CommunityRules; acknowledged: boolean };
          setRules(data.rules);
          setAcknowledged(data.acknowledged);
        }
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    }
    void load();
  }, []);

  async function handleAcknowledge() {
    if (!session?.user?.id || acknowledging) return;
    setAcknowledging(true);
    try {
      const res = await fetch('/api/community/help/rules/acknowledge', { method: 'POST' });
      if (res.ok) setAcknowledged(true);
    } catch { /* non-fatal */ }
    finally { setAcknowledging(false); }
  }

  const ruleSections = rules ? parseRuleSections(rules.body) : [];

  return (
    <>
      <Helmet>
        <title>Getting Started & Community Code — Spellful Community</title>
        <meta name="description" content="Learn how to get started in the Spellful community and read the Community Code that keeps our space welcoming for all practitioners." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-[hsl(var(--card-deep))]">
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
            <Link
              to="/community"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Community
            </Link>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-2xl md:text-3xl text-foreground">Help & Getting Started</h1>
                <p className="text-muted-foreground mt-1">Everything you need to find your way in the Spellful community.</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-6 border-b border-border">
              {([
                { id: 'guide' as const, label: 'Getting Started', icon: <Sparkles className="w-4 h-4" /> },
                { id: 'code' as const, label: 'Community Code', icon: <Shield className="w-4 h-4" /> },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          {/* ── Getting Started tab ── */}
          {activeTab === 'guide' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                {GUIDE_SECTIONS.map((section, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="rounded-xl border border-border bg-card p-5 flex gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                      {section.icon}
                    </div>
                    <div>
                      <h2 className="font-heading text-base text-foreground mb-1">{section.title}</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Quick links */}
              <div className="mt-8 rounded-xl border border-border bg-card p-6">
                <h2 className="font-heading text-lg text-foreground mb-4">Explore More Resources</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { label: 'Community FAQ', href: '/community/help/faq', desc: 'Answers to common questions' },
                    { label: 'Witchcraft Glossary', href: '/community/help/glossary', desc: 'Terms and definitions' },
                    { label: 'Safety & Privacy', href: '/community/help/safety', desc: 'Reporting and privacy tools' },
                    { label: 'Community Code', action: () => setActiveTab('code'), desc: 'Our community rules' },
                  ].map((link, i) => (
                    <div key={i}>
                      {link.href ? (
                        <Link
                          to={link.href}
                          className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors group"
                        >
                          <div>
                            <div className="text-sm font-medium text-foreground">{link.label}</div>
                            <div className="text-xs text-muted-foreground">{link.desc}</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Link>
                      ) : (
                        <button
                          onClick={link.action}
                          className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors group text-left"
                        >
                          <div>
                            <div className="text-sm font-medium text-foreground">{link.label}</div>
                            <div className="text-xs text-muted-foreground">{link.desc}</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Community Code tab ── */}
          {activeTab === 'code' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : rules ? (
                <>
                  {/* Version badge + summary */}
                  <div className="rounded-xl border border-border bg-card p-6 mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="outline" className="text-xs">Version {rules.version}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Effective {new Date(rules.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{rules.summary}</p>
                  </div>

                  {/* Acknowledgment banner */}
                  {session?.user?.id && !acknowledged && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Please read and acknowledge the Community Code</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Acknowledging confirms you have read and agree to follow these rules.</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleAcknowledge}
                        disabled={acknowledging}
                        className="shrink-0"
                      >
                        {acknowledging ? 'Saving…' : 'I have read and agree'}
                      </Button>
                    </div>
                  )}

                  {acknowledged && (
                    <div className="rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 p-4 mb-6 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-[hsl(var(--success))] shrink-0" />
                      <p className="text-sm text-foreground">You have acknowledged the Community Code v{rules.version}.</p>
                    </div>
                  )}

                  {/* Rule sections */}
                  <div className="space-y-3">
                    {ruleSections.map((section) => (
                      <div
                        key={section.number}
                        className="rounded-xl border border-border bg-card p-5 flex gap-4"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                          {RULE_ICONS[section.number] ?? <Shield className="w-5 h-5" />}
                        </div>
                        <div>
                          <h2 className="font-heading text-base text-foreground mb-1.5">
                            {section.number}. {section.title}
                          </h2>
                          <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer note */}
                  <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Violations of this Code may result in content removal, temporary suspension, or permanent removal from the community depending on severity.
                      Moderators apply these rules with context and good judgement.
                      If you believe a moderation decision was made in error, you may submit an appeal.
                    </p>
                  </div>

                  {/* Sign-in prompt for guests */}
                  {!session?.user?.id && (
                    <div className="mt-6 rounded-xl border border-border bg-card p-5 text-center">
                      <p className="text-sm text-muted-foreground mb-3">Sign in to acknowledge the Community Code and join the discussion.</p>
                      <Link to="/login?redirect=/community/help/getting-started">
                        <Button size="sm">Sign in to Spellful</Button>
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>Community Code unavailable. Please try again later.</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </>
  );
}
