import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE, type Transaction } from '@capgo/native-purchases';
import { purchaseAccountToken } from './purchase-account';

export const PLUS_PRODUCT_ID = 'com.spellful.plus.monthly';

export interface PlusProduct {
  productId: string;
  displayPrice: string;   // e.g. "$4.99" — localized by StoreKit
  displayName: string;
  description: string;
}

export interface PurchaseResult {
  ok: boolean;
  isPlus: boolean;
  status: string | null;
  expiresAt: string | null;
  environment: string;
  error?: string;
}

function failure(error: string): PurchaseResult {
  return { ok: false, isPlus: false, status: null, expiresAt: null, environment: 'unknown', error };
}

export async function fetchPlusProduct(): Promise<PlusProduct | null> {
  if (Capacitor.getPlatform() !== 'ios') return null;
  try {
    const { products } = await NativePurchases.getProducts({ productIdentifiers: [PLUS_PRODUCT_ID], productType: PURCHASE_TYPE.SUBS });
    const product = products.find(p => p.identifier === PLUS_PRODUCT_ID);
    return product?.priceString ? {
      productId: product.identifier, displayPrice: product.priceString,
      displayName: product.title, description: product.description,
    } : null;
  } catch {
    return null;
  }
}

async function deliver(transaction: Transaction): Promise<PurchaseResult> {
  if (!transaction.jwsRepresentation) return failure('NO_SIGNED_TRANSACTION');
  const result = await verifyWithServer(transaction.jwsRepresentation);
  if (result.ok && transaction.needsFinish) {
    await NativePurchases.finishTransaction({ transactionId: transaction.transactionId });
  }
  return result;
}

export async function purchasePlus(userId: string): Promise<PurchaseResult> {
  if (Capacitor.getPlatform() !== 'ios') return failure('NOT_NATIVE');
  try {
    const transaction = await NativePurchases.purchaseProduct({
      productIdentifier: PLUS_PRODUCT_ID, productType: PURCHASE_TYPE.SUBS,
      appAccountToken: await purchaseAccountToken(userId), autoAcknowledgePurchases: false,
    });
    return await deliver(transaction);
  } catch (error) {
    const message = String(error);
    return failure(/cancelled|canceled|SKErrorDomain error 2/i.test(message) ? 'USER_CANCELLED' : message);
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (Capacitor.getPlatform() !== 'ios') return failure('NOT_NATIVE');
  try {
    await NativePurchases.restorePurchases();
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS, onlyCurrentEntitlements: true });
    let result = failure('NO_TRANSACTIONS');
    for (const transaction of purchases) {
      if (transaction.productIdentifier !== PLUS_PRODUCT_ID) continue;
      result = await deliver(transaction);
      if (result.ok && result.isPlus) break;
    }
    return result;
  } catch (error) {
    return failure(String(error));
  }
}

async function verifyWithServer(signedTransaction: string): Promise<PurchaseResult> {
  try {
    const res = await fetch('/api/plus/verify-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ signedTransaction }),
    });
    const data = await res.json() as PurchaseResult & { error?: string };
    if (!res.ok) {
      return { ok: false, isPlus: false, status: null, expiresAt: null, environment: 'unknown', error: data.error ?? 'SERVER_ERROR' };
    }
    return data;
  } catch (e) {
    return { ok: false, isPlus: false, status: null, expiresAt: null, environment: 'unknown', error: String(e) };
  }
}
