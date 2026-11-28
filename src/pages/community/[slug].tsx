import SparkCard from '@/components/SparkCard';
import { JoinForum } from '@/components/ForumDirectory';
import { COMMUNITY_GROUPS } from '@/lib/community-navigation';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import {
  ArrowLeft, PenLine,
  Sparkles,
} from 'lucide-react';
import { useSession } from '@/lib/auth/auth-client';
import { community_category } from 'virtual:content';
import { useCommunityCategories, useCommunityPosts, type PostFilter } from '@/hooks/useCommunity';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const FILTERS: { value: PostFilter; label: string }[] = [
  { value: 'active', label: 'Active' }, { value: 'chronological', label: 'New' },
];

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { session } = useSession();
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<PostFilter>('active');
  const [page, setPage] = useState(1);

  const { categories, loading: catsLoading } = useCommunityCategories();
  const category = categories.find((c) => c.slug === slug);
  const { posts, total, pages, loading: postsLoading, error, reload } = useCommunityPosts(filter, slug, page, undefined, true, 'forum');

  const handleFilter = (f: PostFilter) => { setFilter(f); setPage(1); };

  const title = category ? `${category.name} — Spellful Community` : 'Category — Spellful Community';

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={category?.description ?? 'Browse community discussions.'} />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="min-h-screen">
        {/* Header */}
        <section className="border-b border-border bg-[hsl(var(--card-deep))]">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <Link to={COMMUNITY_GROUPS} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft className="w-3.5 h-3.5" /> Forums
            </Link>

            {catsLoading ? (
              <Skeleton className="h-10 w-64" />
            ) : category ? (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' as const }}
              >
                <h1 className="font-heading text-2xl md:text-3xl text-foreground mb-1">{category.name}</h1>
                <p className="text-sm text-muted-foreground">{category.description}</p>
                <JoinForum viewer={session?.user.id} forum={{...category, joined: joined[category.slug] ?? category.joined}} changed={v => setJoined(s => ({...s,[category.slug]:v}))} />
                <p className="text-xs text-muted-foreground mt-1">{total} discussion{total !== 1 ? 's' : ''}</p>
              </motion.div>
            ) : (
              <h1 className="font-heading text-2xl text-foreground">Category not found</h1>
            )}
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-1">
              {FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleFilter(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Link to={'/community/new?kind=spark&forum=' + encodeURIComponent(slug ?? '')}>
              <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <PenLine className="w-3.5 h-3.5" /> Post
              </Button>
            </Link>
          </div>

          <Link className="text-sm text-primary underline" to={'/community/new?category=' + (category?.id ?? '')}>Start a long-form discussion</Link>
          {/* Post list */}
          {postsLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : error ? <button onClick={reload}>Couldn’t load discussions. Retry</button> : posts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{community_category.emptyText}</p>
              <Link to={'/community/new?category=' + category?.id}>
                <Button size="sm" variant="outline" className="gap-2 mt-4">
                  <PenLine className="w-3.5 h-3.5" /> {community_category.startFirstLabel}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {posts.map((post) => <SparkCard compact key={post.id} post={post} canInteract={!!session} />)}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
