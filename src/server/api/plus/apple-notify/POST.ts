import type { Request, Response } from 'express';
import { upsertSubscription } from '@/server/lib/plus-entitlement.js';
import { appleVerifier, appleVerificationStatus } from '@/server/lib/apple-verification';
import { db } from '@/server/db/client.js';
import { user, plusSubscriptions } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';

function mapNotificationTypeToStatus(
  notificationType: string,
  subtype?: string,
): string | undefined {
  switch (notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
      return 'active';
    case 'DID_FAIL_TO_RENEW':
      return subtype === 'GRACE_PERIOD' ? 'grace_period' : 'expired';
    case 'EXPIRED':
      return 'expired';
    case 'REVOKE':
      return 'refunded';
    case 'REFUND':
      return 'refunded';
    case 'GRACE_PERIOD_EXPIRED':
      return 'expired';
    default:
      return undefined;
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    const signedPayload = req.body?.signedPayload;
    if (typeof signedPayload !== 'string') { res.sendStatus(400); return; }
    const verifier = appleVerifier();
    const notification = await verifier.verifyAndDecodeNotification(signedPayload);
    const data = notification.data;
    if (!data?.signedTransactionInfo) { res.sendStatus(200); return; }
    const txn = await verifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
    const status = mapNotificationTypeToStatus(notification.notificationType ?? '', notification.subtype);
    if (!status || txn.productId !== 'com.spellful.plus.monthly' || !txn.originalTransactionId || !txn.expiresDate) {
      res.sendStatus(200); return;
    }
    if (!notification.signedDate) { res.sendStatus(400); return; }
    const renewal = data.signedRenewalInfo ? await verifier.verifyAndDecodeRenewalInfo(data.signedRenewalInfo) : null;
    const environment = String(txn.environment);
    const expiresAt = txn.expiresDate ? new Date(txn.expiresDate) : null;
    const cancelledAt = txn.revocationDate ? new Date(txn.revocationDate) : null;

    // Resolve userId from appAccountToken (UUID we set at purchase time)
    const [existing] = await db.select({ userId: plusSubscriptions.userId }).from(plusSubscriptions)
      .where(eq(plusSubscriptions.appleOriginalTransactionId, txn.originalTransactionId)).limit(1);
    const userId = existing?.userId ?? txn.appAccountToken;
    if (!userId) { res.sendStatus(503); return; }
    const [account] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
    // The purchase endpoint may still be binding the transaction to a user.
    if (!account) { res.sendStatus(503); return; }
    await upsertSubscription({
      userId,
      appleOriginalTransactionId: txn.originalTransactionId,
      appleProductId: txn.productId,
      status,
      environment,
      expiresAt,
      gracePeriodUntil: status === 'grace_period' && renewal?.gracePeriodExpiresDate ? new Date(renewal.gracePeriodExpiresDate) : null,
      cancelledAt,
      signedDate: notification.signedDate,
      rawNotificationPayload: signedPayload.slice(0, 4000),
    });

    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(appleVerificationStatus(error));
  }
}
