// Executed inside the shipped app's WKWebView by the hosted XCTest bundle.
if (window.Capacitor.getPlatform() !== 'ios') throw Error('iOS bridge missing');
async function request(path, method = 'GET', body) {
  const response = await fetch('/api' + path, {
    method, credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw Error(method + ' ' + path.split('?')[0] + ' returned ' + response.status);
  return response.json();
}
async function login(account) {
  await request('/auth/sign-in/email', 'POST', account);
  const session = await request('/auth/get-session');
  if (session?.user?.email !== account.email || !session.user.emailVerified) throw Error('Session mismatch');
  return session.user.id;
}
const first = await login(accounts[0]);
const ent = await request('/plus/entitlement');
if (ent.isPlus !== false) throw Error('Unexpected initial entitlement');
await request('/auth/sign-out', 'POST', {});
const second = await login(accounts[1]);
if (first === second) throw Error('Test users must differ');
const { id } = await request('/conversations', 'POST', { recipientId: first });
const thread = '/conversations/' + id;
const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const plain = 'Spellful iOS simulator delivery';
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM',iv},key,new TextEncoder().encode(plain));
const sent = await request(thread + '/messages', 'POST', { ciphertext: encode(ciphertext), iv: encode(iv), idempotencyKey: crypto.randomUUID() });
await request('/auth/sign-out','POST',{});
await login(accounts[0]);
const messages = await request(thread + '/messages');
const got = messages.messages.find(m => m.id === sent.id);
if (!got) throw Error('Recipient did not receive message');
const decrypted = await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(got.iv)},key,decode(got.ciphertext));
if (new TextDecoder().decode(decrypted) !== plain) throw Error('Received text differs');
await request(thread + '/state','PATCH',{isPinned:true});
const list = await request('/conversations');
if (!list.conversations.find(c=>c.id===id)?.isPinned) throw Error('Pin was not persisted');
await request(thread,'DELETE');
if ((await request('/conversations')).conversations.some(c=>c.id===id)) throw Error('Conversation still visible');
return 'passed';
