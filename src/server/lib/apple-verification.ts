import { Environment, SignedDataVerifier, VerificationException, VerificationStatus } from '@apple/app-store-server-library';
import { X509Certificate } from 'node:crypto';
import appleRoot from '../certificates/AppleRootCA-G3.pem?raw';
import { getSecret } from '#airo/secrets';

let verifier: SignedDataVerifier | undefined;

export function appleVerifier() {
  if (verifier) return verifier;
  // Sandbox deployments must have their own entitlement database.
  const mode = process.env.APPLE_STORE_ENVIRONMENT ?? 'Production';
  if (mode !== Environment.PRODUCTION && mode !== Environment.SANDBOX) throw new Error('Invalid Apple store environment');
  const appId = Number(getSecret('APPLE_APP_ID') ?? process.env.APPLE_APP_ID);
  if (mode === Environment.PRODUCTION && (!Number.isSafeInteger(appId) || appId <= 0)) throw new Error('Missing numeric Apple app ID');
  verifier = new SignedDataVerifier([new X509Certificate(appleRoot).raw], true, mode, 'com.spellful.app', appId || undefined);
  return verifier;
}

export function appleVerificationStatus(error: unknown): number {
  return error instanceof VerificationException && error.status !== VerificationStatus.RETRYABLE_VERIFICATION_FAILURE ? 400 : 503;
}
