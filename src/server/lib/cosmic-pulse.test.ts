import { expect, it } from 'vitest';
import { calculatePulse } from './cosmic-pulse';

it('places the April 2024 total solar eclipse at the known new moon', () => {
  const pulse = calculatePulse(new Date('2024-04-08T12:00:00Z'));
  const event = pulse.events.find(e => e.name.startsWith('total solar eclipse'));
  expect(event?.time).toMatch(/^2024-04-08T18:1/);
  expect(pulse.positions).toHaveLength(10);
  expect(pulse.positions.find(p => p.body === 'Moon')?.sign).toBe('Aries');
  expect(pulse.events.find(e => e.name === 'New moon')?.time).toMatch(/^2024-04-08T18:2/);
});
