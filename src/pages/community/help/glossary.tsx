/**
 * /community/help/glossary
 * Searchable witchcraft glossary with alphabetical index, category filters,
 * related terms, and tradition variation notes.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookMarked, Search, ChevronDown, ArrowLeft, X, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ── Types ─────────────────────────────────────────────────────────────────────
interface GlossaryItem {
  id: number;
  term: string;
  termNormalized: string;
  category: string;
  definition: string;
  traditionNotes: string | null;
  relatedTerms: string[] | null;
}

interface GlossaryResponse {
  items: GlossaryItem[];
  availableLetters: string[];
  categories: string[];
}

// ── Category colours ──────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  'General Witchcraft': 'bg-primary/10 text-primary border-primary/20',
  'Divination': 'bg-accent/10 text-accent border-accent/20',
  'Moon Magic': 'bg-[hsl(var(--info))]/10 text-[hsl(var(--info))] border-[hsl(var(--info))]/20',
  'Herbs & Plants': 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20',
  'Crystals': 'bg-[hsl(var(--accent-violet))]/10 text-[hsl(var(--accent-violet))] border-[hsl(var(--accent-violet))]/20',
  'Spellwork': 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20',
  'Energy Work': 'bg-[hsl(var(--accent-rose))]/10 text-[hsl(var(--accent-rose))] border-[hsl(var(--accent-rose))]/20',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function GlossaryPage() {
  const [data, setData] = useState<GlossaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeLetter, setActiveLetter] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    void loadGlossary();
  }, []);

  async function loadGlossary(q?: string, letter?: string, category?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q?.trim()) params.set('q', q.trim());
      if (letter) params.set('letter', letter);
      if (category && category !== 'All') params.set('category', category);
      const res = await fetch('/api/community/help/glossary?' + params.toString());
      if (res.ok) setData(await res.json() as GlossaryResponse);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveLetter('');
    void loadGlossary(search, undefined, activeCategory !== 'All' ? activeCategory : undefined);
  }

  function handleLetterClick(letter: string) {
    const next = activeLetter === letter ? '' : letter;
    setActiveLetter(next);
    setSearch('');
    void loadGlossary(undefined, next || undefined, activeCategory !== 'All' ? activeCategory : undefined);
  }

  function handleCategoryChange(cat: string) {
    setActiveCategory(cat);
    void loadGlossary(search, activeLetter || undefined, cat !== 'All' ? cat : undefined);
  }

  function clearFilters() {
    setSearch('');
    setActiveLetter('');
    setActiveCategory('All');
    void loadGlossary();
  }

  function toggleItem(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const availableLetters = new Set(data?.availableLetters ?? []);
  const allCategories = data ? ['All', ...data.categories] : ['All'];
  const items = data?.items ?? [];
  const hasFilters = search || activeLetter || activeCategory !== 'All';

  return (
    <>
      <Helmet>
        <title>Witchcraft Glossary — Spellful Community Help</title>
        <meta name="description" content="A searchable glossary of witchcraft, pagan, and spiritual practice terms. Includes tradition variation notes and related terms." />
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
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <BookMarked className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-2xl md:text-3xl text-foreground">Witchcraft Glossary</h1>
                <p className="text-muted-foreground mt-1">
                  Definitions for common terms across witchcraft, paganism, and spiritual practice.
                  Traditions vary — notes are included where relevant.
                </p>
              </div>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search terms…"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); void loadGlossary(undefined, activeLetter || undefined, activeCategory !== 'All' ? activeCategory : undefined); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
          {/* Alphabetical index */}
          <div className="flex flex-wrap gap-1 mb-4" role="group" aria-label="Filter by letter">
            {allLetters.map((letter) => {
              const available = availableLetters.has(letter);
              return (
                <button
                  key={letter}
                  onClick={() => available && handleLetterClick(letter)}
                  disabled={!available}
                  className={[
                    'w-8 h-8 rounded-lg text-xs font-mono font-medium transition-colors',
                    activeLetter === letter
                      ? 'bg-primary text-primary-foreground'
                      : available
                        ? 'bg-muted text-foreground hover:bg-muted/70'
                        : 'bg-transparent text-muted-foreground/30 cursor-default',
                  ].join(' ')}
                  aria-pressed={activeLetter === letter}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by category">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  activeCategory === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
                ].join(' ')}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results count */}
          {!loading && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? 'term' : 'terms'}
                {hasFilters && ' matching your filters'}
              </p>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs text-primary hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Items */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <BookMarked className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">No terms found.</p>
              {hasFilters && (
                <Button variant="ghost" size="sm" className="mt-3" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const isOpen = expandedIds.has(item.id);
                const catColor = CATEGORY_COLORS[item.category] ?? 'bg-muted text-muted-foreground border-border';
                return (
                  <div key={item.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => toggleItem(item.id)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                      aria-expanded={isOpen}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className="font-heading text-base text-foreground">{item.term}</span>
                        <Badge variant="outline" className={['text-[10px] px-2 py-0.5 border shrink-0', catColor].join(' ')}>
                          {item.category}
                        </Badge>
                      </div>
                      <ChevronDown
                        className={['w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200', isOpen ? 'rotate-180' : ''].join(' ')}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-1 border-t border-border/50 space-y-3">
                            {/* Definition */}
                            <p className="text-sm text-muted-foreground leading-relaxed">{item.definition}</p>

                            {/* Tradition notes */}
                            {item.traditionNotes && (
                              <div className="flex gap-2.5 p-3 rounded-lg bg-muted/50 border border-border">
                                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-medium text-foreground mb-0.5">Tradition variations</p>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{item.traditionNotes}</p>
                                </div>
                              </div>
                            )}

                            {/* Related terms */}
                            {item.relatedTerms && item.relatedTerms.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1.5">Related terms:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.relatedTerms.map((term) => (
                                    <button
                                      key={term}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSearch(term);
                                        setActiveLetter('');
                                        void loadGlossary(term, undefined, undefined);
                                      }}
                                      className="px-2.5 py-1 rounded-full bg-muted border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                                    >
                                      {term}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer links */}
          <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Explore more:</span>
            <Link to="/community/help/getting-started" className="text-primary hover:underline">Getting Started</Link>
            <Link to="/community/help/faq" className="text-primary hover:underline">FAQ</Link>
            <Link to="/community/help/safety" className="text-primary hover:underline">Safety & Privacy</Link>
          </div>
        </div>
      </main>
    </>
  );
}
