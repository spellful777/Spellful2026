/**
 * Spellful Moments — Signed unsubscribe / preference tokens
 * Uses jose (already in package.json) with HS256 + BETTER_AUTH_SECRET.
 * Tokens expire in 30 days and carry the userId + purpose.
 */
import { SignJWT, jwtVerify } from 'jose';
import { getSecret } from '#airo/secrets';

function getKey(): Uint8Array {
  const secret = getSecret('BETTER_AUTH_SECRET');
  if (typeof secret !== 'string' || !secret) throw new Error('BETTER_AUTH_SECRET is required');
  return new TextEncoder().encode(secret);
}

export type MomentsTokenPayload = {
  sub: string;   // userId
  purpose: 'unsubscribe' | 'preferences';
};

/** Create a signed token valid for 30 days */
export async function createMomentsToken(userId: string, purpose: MomentsTokenPayload['purpose']): Promise<string> {
  return new SignJWT({ purpose })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getKey());
}

/** Verify and decode a moments token. Returns null if invalid or expired. */
export async function verifyMomentsToken(token: string): Promise<MomentsTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey());
    if (!payload.sub || !payload['purpose']) return null;
    return {
      sub: payload.sub,
      purpose: payload['purpose'] as MomentsTokenPayload['purpose'],
    };
  } catch {
    return null;
  }
}
