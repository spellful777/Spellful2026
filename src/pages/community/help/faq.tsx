/**
 * /community/help/faq
 * Searchable FAQ with category filters and accordion layout.
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import {
  HelpCircle, Search, ChevronDown, ArrowLeft, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FaqItem {
  id: number;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
}

interface FaqResponse {
  categories: string[];
  items: FaqItem[];
  grouped: Record<string, FaqItem[]>;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FaqPage() {
  const [data, setData] = useState<FaqResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadFaq();
  }, []);

  async function loadFaq(q?: string, category?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q?.trim()) params.set('q', q.trim());
      if (category && category !== 'All') params.set('category', category);
      const res = await fetch('/api/community/help/faq?' + params.toString());
      if (res.ok) setData(await res.json() as FaqResponse);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void loadFaq(search, activeCategory !== 'All' ? activeCategory : undefined);
  }

  function handleCategoryChange(cat: string) {
    setActiveCategory(cat);
    void loadFaq(search, cat !== 'All' ? cat : undefined);
  }

  function clearSearch() {
    setSearch('');
    void loadFaq(undefined, activeCategory !== 'All' ? activeCategory : undefined);
  }

  function toggleItem(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allCategories = data ? ['All', ...data.categories] : ['All'];
  const displayItems = data?.items ?? [];

  return (
    <>
      <Helmet>
        <title>FAQ — Spellful Community Help</title>
        <meta name="description" content="Frequently asked questions about the Spellful community, features, privacy, and how to get the most from your practice." />
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
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <HelpCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-2xl md:text-3xl text-foreground">Frequently Asked Questions</h1>
                <p className="text-muted-foreground mt-1">Find answers about Spellful features, community, privacy, and more.</p>
              </div>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions…"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
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

          {/* Results */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : displayItems.length === 0 ? (
            <div className="text-center py-16">
              <HelpCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">No questions found.</p>
              {(search || activeCategory !== 'All') && (
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setSearch(''); setActiveCategory('All'); void loadFaq(); }}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Group by category when showing all */}
              {activeCategory === 'All' && !search ? (
                Object.entries(data?.grouped ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
                  <div key={cat} className="mb-6">
                    <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground mb-2 px-1">{cat}</h2>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <FaqAccordionItem
                          key={item.id}
                          item={item}
                          isOpen={openIds.has(item.id)}
                          onToggle={() => toggleItem(item.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                displayItems.map((item) => (
                  <FaqAccordionItem
                    key={item.id}
                    item={item}
                    isOpen={openIds.has(item.id)}
                    onToggle={() => toggleItem(item.id)}
                  />
                ))
              )}
            </div>
          )}

          {/* Footer links */}
          <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Still have questions?</span>
            <Link to="/community/help/getting-started" className="text-primary hover:underline">Getting Started guide</Link>
            <Link to="/community/help/glossary" className="text-primary hover:underline">Witchcraft Glossary</Link>
            <Link to="/community/help/safety" className="text-primary hover:underline">Safety & Privacy</Link>
          </div>
        </div>
      </main>
    </>
  );
}

// ── Accordion item ────────────────────────────────────────────────────────────
function FaqAccordionItem({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-foreground pr-4">{item.question}</span>
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
            <div className="px-5 pb-5 pt-1 border-t border-border/50">
              <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
