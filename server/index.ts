import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, nodeCrypto } from './app.ts';
import { Db } from './db.ts';
import { openPgStore } from './pgStore.ts';
import { imageCache } from './images.ts';
import { removeDemoData, seed } from '../shared/seed.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR ?? path.join(root, 'data');

// DATABASE_URL (e.g. Railway Postgres) → data in Postgres; otherwise a JSON file in DATA_DIR.
const pgStore = process.env.DATABASE_URL ? await openPgStore(process.env.DATABASE_URL) : null;
const db = pgStore ?? new Db(process.env.DB_FILE ?? path.join(dataDir, 'db.json'));
console.log(pgStore ? 'Storage: PostgreSQL' : `Storage: JSON file in ${dataDir}`);
// Real deployments start clean. SEED_DEMO=1 brings back the sample community for local testing.
if (process.env.SEED_DEMO === '1') {
  if (seed(db, nodeCrypto)) console.log('Seeded demo data — sign in as priya@demo.in / demo123 (or any *@demo.in)');
} else {
  const removed = removeDemoData(db);
  if (removed) console.log(`Removed ${removed} demo users and their cars, trips and bookings`);
}

const app = createApp(db, (a) => imageCache(a, path.join(dataDir, 'img-cache')));
app.set('trust proxy', 1);

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(root, 'dist');
  app.use(compression());
  // Hashed build files never change → cache for a year; index.html always revalidates.
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '365d' }));
  app.use('/models', express.static(path.join(dist, 'models'), { maxAge: '30d' }));
  app.use('/photos', express.static(path.join(dist, 'photos'), { maxAge: '1d' }));
  app.use(express.static(dist, { maxAge: 0 }));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.setHeader('cache-control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => console.log(`SeatShare on http://localhost:${port}`));

// Finish pending database writes before the platform stops the container.
const shutdown = () => {
  server.close();
  void (pgStore?.close() ?? Promise.resolve()).finally(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
