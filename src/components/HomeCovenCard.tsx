import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { COMMUNITY_FEED } from '@/lib/community-navigation';

export default function HomeCovenCard({ description = 'Catch up with your circle.' }: { description?: string }) {
  return (
    <section
      aria-labelledby="home-coven-heading"
      className="coven-entry relative isolate overflow-hidden rounded-xl border shadow-md shadow-black/30"
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 motion-reduce:hidden"
        style={{ background: 'linear-gradient(112deg, transparent 34%, hsl(var(--coven-lilac) / 0.15) 50%, transparent 66%)' }}
        initial={{ x: '-110%' }}
        whileInView={{ x: '110%' }}
        viewport={{ once: true, amount: 0.55 }}
        transition={{ duration: 3.6, delay: 0.35, ease: 'easeInOut' }}
      />
      <Link
        to={COMMUNITY_FEED}
        className="group flex min-h-14 items-center justify-between gap-3 px-3.5 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <div className="min-w-0">
          <h2 id="home-coven-heading" className="font-heading text-xl font-bold leading-tight text-white group-hover:underline group-hover:underline-offset-4">
            My Coven
          </h2>
          <p className="mt-0.5 text-sm leading-snug text-white/75">{description}</p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
      </Link>
    </section>
  );
}
