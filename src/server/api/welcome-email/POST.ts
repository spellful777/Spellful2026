/**
 * POST /api/welcome-email
 * Server-side trigger: send the welcome email to the authenticated, verified user.
 * Called from BetterAuth databaseHooks after user creation (OAuth) and from the
 * OTP verification success path. Also safe to call from the signup page as a
 * belt-and-suspenders fallback — idempotent, never sends twice.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { sendWelcomeEmail } from '@/server/lib/welcome-email.js';

export default async function handler(req: Request, res: Response) {
  try {
    const session = await getAuthSession(req);
    if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    // Fire-and-forget — never block the caller
    void sendWelcomeEmail(session.user.id);

    res.json({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({ event: 'welcome_email.api.error', msg: String(error).slice(0, 200) }));
    res.json({ ok: true }); // non-fatal
  }
}
