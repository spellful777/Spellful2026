/**
 * HelpResourcesAdmin — Admin panel for managing community Help & Resources content.
 * Embedded in /admin/community-admin below the forum management section.
 * Requires admin role (enforced server-side on all API routes).
 */
import type React from 'react';
import { useState, useEffect } from 'react';
import {
  BookOpen, HelpCircle, BookMarked, Shield, Plus, Pencil, Trash2,
  ChevronDown, ChevronUp, Check, X, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

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

interface FaqItem {
  id: number;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
}

interface GlossaryItem {
  id: number;
  term: string;
  category: string;
  definition: string;
  traditionNotes: string | null;
  relatedTerms: string[] | null;
  isPublished: boolean;
}

type AdminTab = 'rules' | 'faq' | 'glossary';

// ── Component ─────────────────────────────────────────────────────────────────
export default function HelpResourcesAdmin() {
  const [activeTab, setActiveTab] = useState<AdminTab>('rules');
  const [rules, setRules] = useState<CommunityRules | null>(null);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [glossaryItems, setGlossaryItems] = useState<GlossaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Rules edit state
  const [editingRules, setEditingRules] = useState(false);
  const [rulesBody, setRulesBody] = useState('');
  const [rulesSummary, setRulesSummary] = useState('');
  const [rulesVersion, setRulesVersion] = useState('');

  // FAQ new entry state
  const [showNewFaq, setShowNewFaq] = useState(false);
  const [newFaqCategory, setNewFaqCategory] = useState('');
  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');
  const [faqSaving, setFaqSaving] = useState(false);

  // Glossary new entry state
  const [showNewGlossary, setShowNewGlossary] = useState(false);
  const [newGlossaryTerm, setNewGlossaryTerm] = useState('');
  const [newGlossaryCategory, setNewGlossaryCategory] = useState('');
  const [newGlossaryDefinition, setNewGlossaryDefinition] = useState('');
  const [glossarySaving, setGlossarySaving] = useState(false);

  useEffect(() => {
    void loadTab(activeTab);
  }, [activeTab]);

  async function loadTab(tab: AdminTab) {
    setLoading(true);
    setMsg('');
    setError('');
    try {
      if (tab === 'rules') {
        const res = await fetch('/api/community/help/rules');
        if (res.ok) {
          const data = await res.json() as { rules: CommunityRules };
          setRules(data.rules);
          setRulesBody(data.rules.body);
          setRulesSummary(data.rules.summary);
          setRulesVersion(data.rules.version);
        }
      } else if (tab === 'faq') {
        const res = await fetch('/api/community/help/faq');
        if (res.ok) {
          const data = await res.json() as { items: FaqItem[] };
          setFaqItems(data.items);
        }
      } else if (tab === 'glossary') {
        const res = await fetch('/api/community/help/glossary');
        if (res.ok) {
          const data = await res.json() as { items: GlossaryItem[] };
          setGlossaryItems(data.items);
        }
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function saveRules() {
    if (!rules) return;
    setMsg('');
    setError('');
    try {
      const res = await fetch('/api/community/help/rules/' + rules.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: rulesBody, summary: rulesSummary, version: rulesVersion, isCurrent: true }),
      });
      if (!res.ok) throw new Error('Save failed');
      setMsg('Community Code saved.');
      setEditingRules(false);
      void loadTab('rules');
    } catch {
      setError('Failed to save Community Code');
    }
  }

  async function toggleFaqPublished(item: FaqItem) {
    const res = await fetch('/api/community/help/faq/' + item.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isPublished: !item.isPublished }),
    });
    if (res.ok) void loadTab('faq');
  }

  async function deleteFaqItem(id: number) {
    if (!confirm('Delete this FAQ entry?')) return;
    const res = await fetch('/api/community/help/faq/' + id, { method: 'DELETE', credentials: 'include' });
    if (res.ok) void loadTab('faq');
  }

  async function createFaqItem() {
    if (!newFaqCategory.trim() || !newFaqQuestion.trim() || !newFaqAnswer.trim()) return;
    setFaqSaving(true);
    try {
      const res = await fetch('/api/community/help/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category: newFaqCategory, question: newFaqQuestion, answer: newFaqAnswer }),
      });
      if (res.ok) {
        setShowNewFaq(false);
        setNewFaqCategory('');
        setNewFaqQuestion('');
        setNewFaqAnswer('');
        void loadTab('faq');
      }
    } finally {
      setFaqSaving(false);
    }
  }

  async function toggleGlossaryPublished(item: GlossaryItem) {
    const res = await fetch('/api/community/help/glossary/' + item.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isPublished: !item.isPublished }),
    });
    if (res.ok) void loadTab('glossary');
  }

  async function deleteGlossaryItem(id: number) {
    if (!confirm('Delete this glossary entry?')) return;
    const res = await fetch('/api/community/help/glossary/' + id, { method: 'DELETE', credentials: 'include' });
    if (res.ok) void loadTab('glossary');
  }

  async function createGlossaryItem() {
    if (!newGlossaryTerm.trim() || !newGlossaryCategory.trim() || !newGlossaryDefinition.trim()) return;
    setGlossarySaving(true);
    try {
      const res = await fetch('/api/community/help/glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ term: newGlossaryTerm, category: newGlossaryCategory, definition: newGlossaryDefinition }),
      });
      if (res.ok) {
        setShowNewGlossary(false);
        setNewGlossaryTerm('');
        setNewGlossaryCategory('');
        setNewGlossaryDefinition('');
        void loadTab('glossary');
      }
    } finally {
      setGlossarySaving(false);
    }
  }

  const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'rules', label: 'Community Code', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'glossary', label: 'Glossary', icon: <BookMarked className="w-4 h-4" /> },
  ];

  return (
    <div className="mt-10 pt-8 border-t border-border">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
            Help & Resources
          </h2>
          <p className="text-sm text-muted-foreground">Manage Community Code, FAQ, and Glossary content</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => loadTab(activeTab)}
          className="ml-auto text-muted-foreground"
          aria-label="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Status messages */}
      {msg && (
        <div className="mb-4 p-3 rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {msg}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map((tab) => (
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

      {/* ── Community Code tab ── */}
      {activeTab === 'rules' && (
        <div>
          {loading ? (
            <div className="h-40 rounded-xl bg-muted animate-pulse" />
          ) : rules ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline">v{rules.version}</Badge>
                <span className="text-xs text-muted-foreground">Effective {rules.effectiveDate}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingRules((v) => !v)}
                  className="ml-auto gap-1.5"
                >
                  {editingRules ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                  {editingRules ? 'Cancel' : 'Edit'}
                </Button>
              </div>

              {editingRules ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Version</label>
                    <Input value={rulesVersion} onChange={(e) => setRulesVersion(e.target.value)} className="max-w-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Summary</label>
                    <textarea
                      value={rulesSummary}
                      onChange={(e) => setRulesSummary(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Body (Markdown)</label>
                    <textarea
                      value={rulesBody}
                      onChange={(e) => setRulesBody(e.target.value)}
                      rows={20}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                    />
                  </div>
                  <Button onClick={saveRules} className="gap-1.5">
                    <Check className="w-4 h-4" />
                    Save Community Code
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card p-5">
                  <p className="text-sm text-muted-foreground mb-3">{rules.summary}</p>
                  <p className="text-xs text-muted-foreground">{rules.body.slice(0, 200)}…</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No Community Code found.</p>
          )}
        </div>
      )}

      {/* ── FAQ tab ── */}
      {activeTab === 'faq' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowNewFaq((v) => !v)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add FAQ Entry
            </Button>
          </div>

          {showNewFaq && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <h3 className="text-sm font-medium text-foreground">New FAQ Entry</h3>
              <Input placeholder="Category (e.g. Getting Started)" value={newFaqCategory} onChange={(e) => setNewFaqCategory(e.target.value)} />
              <Input placeholder="Question" value={newFaqQuestion} onChange={(e) => setNewFaqQuestion(e.target.value)} />
              <textarea
                placeholder="Answer"
                value={newFaqAnswer}
                onChange={(e) => setNewFaqAnswer(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={createFaqItem} disabled={faqSaving}>
                  {faqSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewFaq(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : faqItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No FAQ entries.</p>
          ) : (
            faqItems.map((item) => (
              <FaqAdminRow
                key={item.id}
                item={item}
                onTogglePublished={() => toggleFaqPublished(item)}
                onDelete={() => deleteFaqItem(item.id)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Glossary tab ── */}
      {activeTab === 'glossary' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowNewGlossary((v) => !v)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Glossary Entry
            </Button>
          </div>

          {showNewGlossary && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <h3 className="text-sm font-medium text-foreground">New Glossary Entry</h3>
              <Input placeholder="Term" value={newGlossaryTerm} onChange={(e) => setNewGlossaryTerm(e.target.value)} />
              <Input placeholder="Category (e.g. Divination)" value={newGlossaryCategory} onChange={(e) => setNewGlossaryCategory(e.target.value)} />
              <textarea
                placeholder="Definition"
                value={newGlossaryDefinition}
                onChange={(e) => setNewGlossaryDefinition(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={createGlossaryItem} disabled={glossarySaving}>
                  {glossarySaving ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewGlossary(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : glossaryItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No glossary entries.</p>
          ) : (
            glossaryItems.map((item) => (
              <GlossaryAdminRow
                key={item.id}
                item={item}
                onTogglePublished={() => toggleGlossaryPublished(item)}
                onDelete={() => deleteGlossaryItem(item.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── FAQ admin row ─────────────────────────────────────────────────────────────
function FaqAdminRow({ item, onTogglePublished, onDelete }: {
  item: FaqItem;
  onTogglePublished: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded((v) => !v)} className="flex-1 text-left flex items-center gap-2 min-w-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className="text-sm font-medium text-foreground truncate">{item.question}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">{item.category}</Badge>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onTogglePublished}
            className={['text-xs px-2 py-1 rounded-md border transition-colors', item.isPublished ? 'border-[hsl(var(--success))]/30 text-[hsl(var(--success))] bg-[hsl(var(--success))]/10' : 'border-border text-muted-foreground'].join(' ')}
          >
            {item.isPublished ? 'Published' : 'Hidden'}
          </button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="w-7 h-7 p-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/50">
          <p className="text-sm text-muted-foreground">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

// ── Glossary admin row ────────────────────────────────────────────────────────
function GlossaryAdminRow({ item, onTogglePublished, onDelete }: {
  item: GlossaryItem;
  onTogglePublished: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded((v) => !v)} className="flex-1 text-left flex items-center gap-2 min-w-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className="text-sm font-medium text-foreground">{item.term}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">{item.category}</Badge>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onTogglePublished}
            className={['text-xs px-2 py-1 rounded-md border transition-colors', item.isPublished ? 'border-[hsl(var(--success))]/30 text-[hsl(var(--success))] bg-[hsl(var(--success))]/10' : 'border-border text-muted-foreground'].join(' ')}
          >
            {item.isPublished ? 'Published' : 'Hidden'}
          </button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="w-7 h-7 p-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/50">
          <p className="text-sm text-muted-foreground">{item.definition}</p>
          {item.traditionNotes && (
            <p className="text-xs text-muted-foreground mt-2 italic">{item.traditionNotes}</p>
          )}
        </div>
      )}
    </div>
  );
}
