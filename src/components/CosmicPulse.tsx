import { useEffect, useState } from 'react';
import type { CosmicPulseData } from '@/server/lib/cosmic-pulse';

export default function CosmicPulse() {
  const [pulse, setPulse] = useState<CosmicPulseData | null>(null);
  const [failed, setFailed] = useState(false);
  const [zone, setZone] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch('/api/cosmic-pulse', { signal: controller.signal });
        if (!response.ok) throw new Error();
        const data: CosmicPulseData = await response.json();
        if (!controller.signal.aborted) { setPulse(data); setFailed(false); }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 60_000);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  const format = (time: string) => new Intl.DateTimeFormat(undefined, {
    timeZone: zone || undefined, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(time));
  const moon = pulse?.positions.find(p => p.body === 'Moon');
  return <details className="rounded-xl border border-border bg-card p-4 mb-4">
    <summary className="cursor-pointer font-semibold">Cosmic Pulse {moon && <span className="font-normal text-muted-foreground"> · Moon in {moon.sign}</span>}</summary>
    {failed && <p role="status">Current sky data is unavailable.</p>}
    {!pulse && !failed && <p>Calculating the sky…</p>}
    {pulse && <div className="mt-4 space-y-3 text-sm">
      <label>Display time zone <select value={zone} onChange={e => setZone(e.target.value)} className="rounded border bg-background p-1">
        <option value="">Device time zone</option><option>UTC</option>
        {(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []).filter(z => z !== 'UTC').map(z => <option key={z}>{z}</option>)}
      </select></label>
      <p>Calculated {format(pulse.calculatedAt)} with Astronomy Engine. Positions are geocentric. Signs use the tropical zodiac.</p>
      <ul className="grid grid-cols-2 gap-1">{pulse.positions.map(p => <li key={p.body}>{p.body} · {p.sign} {(p.longitude % 30).toFixed(1)}°</li>)}</ul>
      <p>Lunar phase angle {pulse.phaseAngle.toFixed(1)}°</p>
      <h3 className="font-semibold">Upcoming lunar phases and eclipses</h3>
      <ul>{pulse.events.map(e => <li key={e.time}>{e.name} · <time dateTime={e.time}>{format(e.time)}</time></li>)}</ul>
    </div>}
  </details>;
}
