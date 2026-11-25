import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { upsertSubscription, getEntitlement } from '@/server/lib/plus-entitlement.js';
import { appleVerifier, appleVerificationStatus } from '@/server/lib/apple-verification';
import { db } from '@/server/db/client.js';
import { plusSubscriptions } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { purchaseAccountToken } from '@/lib/purchase-account';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }

  const { signedTransaction } = (req.body ?? {}) as { signedTransaction?: string };
  if (!signedTransaction || typeof signedTransaction !== 'string') {
    res.status(400).json({ error: 'MISSING_TRANSACTION' });
    return;
  }

  try {
    const txn = await appleVerifier().verifyAndDecodeTransaction(signedTransaction);
    if (!txn?.originalTransactionId || !txn?.productId || !txn.expiresDate) {
      res.status(400).json({ error: 'INVALID_TRANSACTION' });
      return;
    }

    // Legacy StoreKit transactions can omit the account token. Restore those
    // only for the Spellful account already bound to the original transaction.
    const [known] = await db.select({ owner: plusSubscriptions.userId }).from(plusSubscriptions)
      .where(eq(plusSubscriptions.appleOriginalTransactionId, txn.originalTransactionId)).limit(1);
    const matches = txn.appAccountToken
      ? txn.appAccountToken.toLowerCase() === await purchaseAccountToken(session.user.id)
      : known?.owner === session.user.id;
    if (!matches || (known && known.owner !== session.user.id)) {
      res.status(403).json({ error: 'ACCOUNT_MISMATCH' });
      return;
    }

    // Only accept our known product ID
    if (txn.productId !== 'com.spellful.plus.monthly') {
      res.status(400).json({ error: 'UNKNOWN_PRODUCT', productId: txn.productId });
      return;
    }

    const environment = txn.environment ?? 'production';
    const expiresAt = txn.expiresDate ? new Date(txn.expiresDate) : null;
    const cancelledAt = txn.revocationDate ? new Date(txn.revocationDate) : null;
    const status = cancelledAt ? 'refunded' : 'active';

    await upsertSubscription({
      userId: session.user.id,
      appleOriginalTransactionId: txn.originalTransactionId,
      appleProductId: txn.productId,
      status,
      environment,
      expiresAt,
      gracePeriodUntil: null,
      cancelledAt,
      rawNotificationPayload: signedTransaction.slice(0, 4000),
    });

    const entitlement = await getEntitlement(session.user.id);
    res.json({
      ok: true,
      isPlus: entitlement.isPlus,
      status: entitlement.status,
      expiresAt: entitlement.expiresAt?.toISOString() ?? null,
      environment,
    });
  } catch (e) {
    res.status(appleVerificationStatus(e)).json({ error: 'PURCHASE_VERIFICATION_FAILED' });
  }
}
