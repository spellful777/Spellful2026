import { useEffect, useState } from 'react';

export interface SpellfulCircle {
  id: number;
  name: string;
  description: string;
  membership_type: string;
  my_status: string | null;
}

export function useSpellfulCircles() {
  const [circles, setCircles] = useState<SpellfulCircle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/circles', { signal: controller.signal })
      .then(async response => response.ok ? response.json() : { circles: [] })
      .then((data: { circles?: SpellfulCircle[] }) => {
        if (!controller.signal.aborted) setCircles(data.circles ?? []);
      })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  return { circles, loading };
}
