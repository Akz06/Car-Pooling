/**
 * Splits shared/photos.data.json (the collector's output) into:
 *  - client/public/photos/<model>.json — each car's full gallery, loaded on demand
 *  - shared/seat-shots.json            — only the seat photos, bundled with the app
 */
import fs from 'node:fs';
import type { ModelPhoto } from '../shared/photos.ts';

const all: Record<string, ModelPhoto[]> = JSON.parse(fs.readFileSync(new URL('../shared/photos.data.json', import.meta.url), 'utf8'));
const dir = new URL('../client/public/photos/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const seats: Record<string, ModelPhoto[]> = {};
for (const [id, photos] of Object.entries(all)) {
  fs.writeFileSync(new URL(`${id}.json`, dir), JSON.stringify(photos));
  const shots = photos.filter((p) => p.seatShot).map(({ url, caption, seatShot, category, pins }) => ({ url, caption, seatShot, category, pins }));
  if (shots.length) seats[id] = shots;
}
fs.writeFileSync(new URL('../shared/seat-shots.json', import.meta.url), JSON.stringify(seats, null, 1) + '\n');
console.log(`Wrote ${Object.keys(all).length} galleries and ${Object.values(seats).flat().length} seat photos`);
