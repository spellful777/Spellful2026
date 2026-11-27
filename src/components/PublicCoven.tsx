import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router';
import { COMMUNITY_FEED } from '@/lib/community-navigation';
import { SPARK_TOPICS, topicPath } from '@/lib/spark-topics';
import { TopicActivity } from '@/pages/explore/topic';

export default function PublicCoven() {
  const featuredTopic = SPARK_TOPICS[0];
  return (
    <main className="home-feed mx-auto max-w-3xl space-y-6 px-4 py-6 pb-24">
      <Helmet><title>Coven | Spellful</title></Helmet>
      <header className="coven-entry space-y-3 rounded-xl border p-5">
        <h1 className="font-heading text-4xl">Coven</h1>
        <p>Explore public Sparks and meet members who share your interests.</p>
        <Link className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-medium text-primary-foreground"
          to={`/login?redirect=${encodeURIComponent(COMMUNITY_FEED)}`}>Sign in to your Coven</Link>
      </header>
      <nav aria-label="Explore Coven topics" className="flex flex-wrap gap-2">
        {SPARK_TOPICS.map(topic => (
          <Link key={topic} to={topicPath(topic)} className="inline-flex min-h-10 items-center rounded-full border border-border px-3 text-sm text-primary">{topic}</Link>
        ))}
      </nav>
      <section className="space-y-3" aria-label={featuredTopic}>
        <h2 className="font-heading text-2xl">{featuredTopic}</h2>
        <TopicActivity topic={featuredTopic} />
      </section>
    </main>
  );
}
