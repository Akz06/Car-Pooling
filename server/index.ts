import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, nodeCrypto } from './app.ts';
import { Db } from './db.ts';
import { imageCache } from './images.ts';
import { seed } from '../shared/seed.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// DATA_DIR points at a persistent disk in production (e.g. /var/data on Render).
const dataDir = process.env.DATA_DIR ?? path.join(root, 'data');
const db = new Db(process.env.DB_FILE ?? path.join(dataDir, 'db.json'));
if (seed(db, nodeCrypto)) console.log('Seeded demo data — sign in as priya@demo.in / demo123 (or any *@demo.in)');

const app = createApp(db, (a) => imageCache(a, path.join(dataDir, 'img-cache')));
app.set('trust proxy', 1);

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(root, 'dist');
  app.use(compression());
  // Hashed build files never change → cache for a year; index.html always revalidates.
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '365d' }));
  app.use('/models', express.static(path.join(dist, 'models'), { maxAge: '30d' }));
  app.use(express.static(dist, { maxAge: 0 }));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.setHeader('cache-control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`SeatShare on http://localhost:${port}`));
