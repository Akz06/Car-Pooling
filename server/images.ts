import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';

/**
 * Same-origin image cache for car photos. The browser asks /api/img?u=<url>;
 * the first request downloads from the photo site and stores it on disk, every
 * later one is served locally — fast, and immune to hotlink blocking.
 */
const ALLOWED = new Set(['upload.wikimedia.org', 'stimg.cardekho.com']);
const MAX_BYTES = 8 * 1024 * 1024;

export function imageCache(app: Express, dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  const inflight = new Map<string, Promise<void>>();

  app.get('/api/img', async (req, res) => {
    let url: URL;
    try {
      url = new URL(String(req.query.u ?? ''));
    } catch {
      return res.status(400).json({ error: 'Bad image url' });
    }
    if (url.protocol !== 'https:' || !ALLOWED.has(url.hostname)) return res.status(400).json({ error: 'Image host not allowed' });

    const key = crypto.createHash('sha1').update(url.href).digest('hex');
    const file = path.join(dir, key);
    const meta = `${file}.type`;
    try {
      if (!fs.existsSync(file)) {
        let job = inflight.get(key);
        if (!job) {
          job = (async () => {
            const r = await fetch(url, {
              headers: {
                'user-agent': 'Mozilla/5.0 (SeatShare image cache)',
                ...(url.hostname.endsWith('cardekho.com') ? { referer: 'https://www.cardekho.com/' } : {}),
              },
            });
            const type = r.headers.get('content-type') ?? '';
            if (!r.ok || !type.startsWith('image/')) throw new Error(`upstream ${r.status}`);
            const buf = Buffer.from(await r.arrayBuffer());
            if (buf.length > MAX_BYTES) throw new Error('too large');
            fs.writeFileSync(`${file}.tmp`, buf);
            fs.renameSync(`${file}.tmp`, file);
            fs.writeFileSync(meta, type);
          })().finally(() => inflight.delete(key));
          inflight.set(key, job);
        }
        await job;
      }
      res.setHeader('content-type', fs.existsSync(meta) ? fs.readFileSync(meta, 'utf8') : 'image/jpeg');
      res.setHeader('cache-control', 'public, max-age=2592000, immutable');
      fs.createReadStream(file).pipe(res);
    } catch {
      res.status(502).json({ error: 'Could not fetch image' });
    }
  });
}
