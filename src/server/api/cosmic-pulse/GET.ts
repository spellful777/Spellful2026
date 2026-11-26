import type { Request, Response } from 'express';
import { calculatePulse, type CosmicPulseData } from '../../lib/cosmic-pulse';

let cached: CosmicPulseData | undefined;
let expires = 0;
export default function handler(_req: Request, res: Response) {
  const now = Date.now();
  if (!cached || now >= expires) {
    cached = calculatePulse(new Date(now));
    expires = now + 60_000;
  }
  res.set('Cache-Control', `public, max-age=${Math.floor((expires - now) / 1000)}`).json(cached);
}
