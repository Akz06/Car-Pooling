import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { Db } from './db.ts';
import { seed } from './seed.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new Db(process.env.DB_FILE ?? path.join(root, 'data', 'db.json'));
seed(db);

const app = createApp(db);

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(root, 'dist');
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`Car-Pooling API on http://localhost:${port}`));
