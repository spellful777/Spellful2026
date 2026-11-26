import { BlockList } from 'node:net';
import { Resolver } from 'node:dns/promises';
import { request } from 'node:https';
import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import type { Request, Response } from 'express';
import { getAuthSession } from './auth-session.js';

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) blocked.addSubnet(network, prefix, 'ipv4');

function externalUrl(value: unknown, base?: URL) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !/^(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*$/i.test(url.hostname)) return null;
    url.hash = '';
    return url;
  } catch { return null; }
}

type Preview = { title: string; image?: string };
const cache = new Map<string, { expires: number; value: Promise<Preview | null> }>();
let active = 0;

async function fetchPage(url: URL): Promise<string> {
  const resolver = new Resolver({ timeout: 900, tries: 1 });
  const addresses = await resolver.resolve4(url.hostname);
  if (!addresses.length || addresses.some(ip => blocked.check(ip, 'ipv4'))) throw Error();
  // Pin the socket to the validated destination. Preserve the original TLS host.
  return await new Promise((resolve, reject) => {
    const req = request(url, {
      agent: false, family: 4, signal: AbortSignal.timeout(3000),
      lookup: (_host, _options, callback) => callback(null, addresses[0], 4),
      headers: { Accept: 'text/html', 'User-Agent': 'SpellfulLinkPreview/1.0' },
    }, response => {
      // Do not follow redirects or decompress untrusted responses.
      if (response.statusCode !== 200 || !response.headers['content-type']?.startsWith('text/html') ||
          (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
        response.destroy(); reject(Error()); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 192 * 1024) {
          resolve(Buffer.concat(chunks).toString('utf8'));
          response.destroy();
        } else chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      response.on('error', reject);
      response.on('aborted', () => reject(Error()));
    });
    req.on('error', reject);
    req.end();
  });
}

async function readPreview(url: URL): Promise<Preview | null> {
  try {
    const page = parse(await fetchPage(url));
    const html = page.childNodes.find((node): node is DefaultTreeAdapterTypes.Element => 'tagName' in node && node.tagName === 'html');
    const head = html?.childNodes.find((node): node is DefaultTreeAdapterTypes.Element => 'tagName' in node && node.tagName === 'head');
    if (!head) return null;
    const metas = new Map<string, string>();
    let fallback = '';
    for (const node of head.childNodes) {
      if (!('tagName' in node)) continue;
      if (node.tagName === 'title') fallback = node.childNodes.map(child => 'value' in child ? child.value : '').join('');
      if (node.tagName !== 'meta') continue;
      const property = node.attrs.find(attr => attr.name === 'property')?.value;
      const content = node.attrs.find(attr => attr.name === 'content')?.value;
      if (property && content && !metas.has(property)) metas.set(property, content);
    }
    const title = (metas.get('og:title') || fallback).trim().slice(0, 150);
    const image = externalUrl(metas.get('og:image'), url);
    // Only return same-host artwork (already DNS-validated for this preview).
    return title ? { title, ...(image?.hostname === url.hostname ? { image: image.href } : {}) } : null;
  } catch { return null; }
}

export async function commentLinkPreview(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!(await getAuthSession(req))?.user?.id) return res.sendStatus(401);
  const url = externalUrl(req.query.url);
  if (!url) return res.json(null);
  const existing = cache.get(url.href);
  if (existing && existing.expires > Date.now()) return res.json(await existing.value);
  if (active >= 6) return res.json(null);
  active++;
  const value = readPreview(url).finally(() => { active--; });
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(url.href, { expires: Date.now() + 20 * 60_000, value });
  return res.json(await value);
}
