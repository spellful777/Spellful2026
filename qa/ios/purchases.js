async function runSpellfulCheck() {
  // Use StoreKit's Xcode test session. Never send its local receipts to live services.
  const pid = 'com.spellful.plus.monthly';
  const plugin = window.Capacitor.Plugins.NativePurchases;
  if (!plugin) throw Error('Native purchase plugin missing');
  const catalog = await plugin.getProducts({ productIdentifiers: [pid], productType: 'subs' });
  if (!catalog.products.some(p => p.identifier === pid && p.priceString)) throw Error('Localized product missing');
  const token = crypto.randomUUID();
  const transaction = await plugin.purchaseProduct({productIdentifier: pid, appAccountToken: token, productType: 'subs', autoAcknowledgePurchases: false});
  if (!transaction.transactionId || !transaction.jwsRepresentation) throw Error('Purchase did not return a signed transaction');
  await plugin.finishTransaction({transactionId: transaction.transactionId});
  await plugin.restorePurchases();
  const restored = await plugin.getPurchases({productType: 'subs', onlyCurrentEntitlements: true});
  if (!restored.purchases.some(p => p.productIdentifier === pid && p.appAccountToken?.toLowerCase() === token.toLowerCase() && p.jwsRepresentation)) throw Error('Restored entitlement missing');
  return 'passed';
}
