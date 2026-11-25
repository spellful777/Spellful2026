/**
 * POST /api/welcome-message — RETIRED
 *
 * The automated welcome DM system has been replaced by a transactional
 * welcome EMAIL sent via the Airo email gateway (POST /api/welcome-email).
 * This endpoint is kept to avoid 404s from any cached clients but returns
 * 410 Gone so callers know to stop using it.
 */
import type { Request, Response } from 'express';

export default function handler(_req: Request, res: Response) {
  res.status(410).json({
    error: 'Gone',
    message: 'The welcome DM system has been retired. Welcome emails are now sent automatically on signup.',
  });
}
