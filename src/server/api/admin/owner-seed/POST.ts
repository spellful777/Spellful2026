/**
 * POST /api/admin/owner-seed — RETIRED
 *
 * This endpoint has been permanently disabled as a P0 security measure.
 * It previously accepted BETTER_AUTH_SECRET as a role-provisioning credential,
 * which reused the application authentication secret for privilege escalation.
 *
 * Owner provisioning must now be performed via a direct, audited database
 * operation by the platform operator — never through a publicly reachable URL.
 *
 * Returns 410 Gone unconditionally.
 */
import type { Request, Response } from 'express';

export default function handler(_req: Request, res: Response): void {
  res.status(410).json({
    error: 'Gone',
    message: 'This endpoint has been permanently retired for security reasons.',
  });
}
