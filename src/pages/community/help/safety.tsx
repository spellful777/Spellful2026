/**
 * /community/help/safety
 * Safety & Privacy center — reporting, blocking, privacy controls.
 */
import { Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Shield, Flag, EyeOff, Lock, UserX, ArrowLeft, ChevronRight,
} from 'lucide-react';

const SECTIONS = [
  {
    icon: <Flag className="w-5 h-5" />,
    title: 'Reporting Content',
    body: 'Every post, comment, and member profile has a report option in the three-dot menu. Reports are confidential and reviewed by the moderation team. You can report harassment, hate speech, spam, scams, harmful misinformation, inappropriate content, and privacy violations.',
    action: null,
  },
  {
    icon: <UserX className="w-5 h-5" />,
    title: 'Blocking Members',
    body: "Blocking a member prevents them from seeing your content, sending you messages, or interacting with your posts. Visit a member's profile and use the three-dot menu to block them. Blocks are private.",
    action: null,
  },
  {
    icon: <EyeOff className="w-5 h-5" />,
    title: 'Muting Members',
    body: "Muting hides a member's posts from your feed without notifying them. They can still see your content and interact with you. Use muting when you want a quieter experience without the permanence of blocking.",
    action: null,
  },
  {
    icon: <Lock className="w-5 h-5" />,
    title: 'Privacy Controls',
    body: 'Visit Account → My Privacy Sanctuary to control your profile visibility, who can message you, whether you appear in search results, whether your online status is visible, and many other privacy settings.',
    action: { label: 'Open Privacy Sanctuary', href: '/account/privacy' },
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Encrypted Messages',
    body: 'Direct messages on Spellful use end-to-end encryption. Only you and the person you are messaging can read your conversations. Spellful staff cannot read your messages.',
    action: null,
  },
];

export default function SafetyPage() {
  return (
    <>
      <Helmet>
        <title>Safety & Privacy — Spellful Community Help</title>
        <meta name="description" content="Learn how to report content, block members, control your privacy, and stay safe in the Spellful community." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-[hsl(var(--card-deep))]">
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
            <Link
              to="/community"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Community
            </Link>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-2xl md:text-3xl text-foreground">Safety & Privacy</h1>
                <p className="text-muted-foreground mt-1">Tools and controls to keep your experience safe and private.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
          <div className="space-y-4">
            {SECTIONS.map((section, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  {section.icon}
                </div>
                <div className="flex-1">
                  <h2 className="font-heading text-base text-foreground mb-1.5">{section.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
                  {section.action && (
                    <Link
                      to={section.action.href}
                      className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary hover:underline"
                    >
                      {section.action.label}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer links */}
          <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>More help:</span>
            <Link to="/community/help/getting-started" className="text-primary hover:underline">Getting Started</Link>
            <Link to="/community/help/faq" className="text-primary hover:underline">FAQ</Link>
            <Link to="/community/help/glossary" className="text-primary hover:underline">Glossary</Link>
          </div>
        </div>
      </main>
    </>
  );
}
