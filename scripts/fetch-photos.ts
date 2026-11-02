/**
 * Collects every gallery photo for each catalog model from CarDekho's
 * "pictures" pages and writes shared/photos.data.json (internal use).
 *
 *   npx tsx scripts/fetch-photos.ts              # all models
 *   npx tsx scripts/fetch-photos.ts hyundai-i20  # some models
 *
 * The page embeds the gallery as nested JSON:
 *   {"title":"Interior","value":"interior","list":[{"title":"Seats","value":"seats","list":[{"src":…,"title":…}]}]}
 * We keep CarDekho's own groups (Exterior → Looks / Details / Lights …,
 * Interior → Dashboard / Seats / Boot …, Colours) and pick one photo per seat
 * row for picking seats on the real interior.
 */
import fs from 'node:fs';
import { CATALOG, type CarModel } from '../shared/catalog.ts';
import type { ModelPhoto, PhotoCategory } from '../shared/photos.ts';

const PAGE: Record<string, string> = {
  'maruti-swift': 'maruti/swift', 'hyundai-creta': 'hyundai/creta', 'honda-city': 'honda/city', 'tata-nexon': 'tata/nexon',
  'mahindra-xuv700': 'mahindra/xuv700', 'toyota-innova-crysta': 'toyota/innova-crysta', 'maruti-ertiga': 'Maruti/Maruti_Ertiga',
  'kia-carens': 'kia/carens', 'toyota-fortuner': 'Toyota/Toyota_Fortuner', 'tesla-model-y': 'tesla/model-y', 'hyundai-verna': 'hyundai/verna',
  'tata-punch': 'tata/punch', 'mahindra-thar': 'mahindra/thar', 'mahindra-scorpio-n': 'mahindra/scorpio-n', 'maruti-brezza': 'maruti/brezza',
  'maruti-baleno': 'maruti/baleno', 'maruti-dzire': 'maruti/dzire', 'hyundai-venue': 'hyundai/venue', 'hyundai-i20': 'hyundai/i20',
  'kia-seltos': 'kia/seltos', 'kia-sonet': 'kia/sonet', 'toyota-hyryder': 'toyota/hyryder', 'mg-hector': 'mg/hector',
  'tata-safari': 'Tata/Tata_Safari', 'tata-harrier': 'tata/harrier', 'maruti-wagonr': 'maruti/wagon-r', 'honda-amaze': 'honda/amaze',
  'mahindra-xuv3xo': 'mahindra/xuv-3xo', 'maruti-fronx': 'maruti/fronx', 'toyota-innova-hycross': 'toyota/innova-hycross',
};

const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', accept: 'text/html' };

const unescape = (s: string) => s.replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&');
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);

/** Walk the page in order, tracking the group headers each photo sits under. */
function parseGallery(html: string) {
  const re = /\{"title":"([^"]+)","value":"([^"]+)","list"|\{"src":"(https:[^"]+?\/(?:930x620|1280x720)\/[^"]+)","title":"([^"]+)"(?:,"thumbNail":"([^"]+)")?/g;
  let top = '';
  let section = '';
  const out: { src: string; title: string; thumb?: string; top: string; section: string }[] = [];
  for (const m of html.matchAll(re)) {
    if (m[1]) {
      const [title, value] = [m[1], m[2]];
      if (/^(exterior|interior|colours)$/.test(value) && /^(Exterior|Interior|Colours)$/.test(title)) {
        top = value;
        section = title;
      } else {
        section = title;
      }
      continue;
    }
    out.push({ src: unescape(m[3]), title: m[4], thumb: m[5] ? unescape(m[5]) : undefined, top, section });
  }
  return out;
}

/** Most photos of this car live under one folder (…/Hyundai/i20/11092/…); drop anything else. */
function mainFolder(items: { src: string }[]) {
  const count = new Map<string, number>();
  for (const { src } of items) {
    const m = /images\/car\w*images\/[^/]+\/([^/]+\/[^/]+)\//.exec(src);
    if (m) count.set(m[1], (count.get(m[1]) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function matchPaint(model: CarModel, title: string, file: string) {
  const name = words(title).join(' ');
  const slug = file.replace(/_[0-9a-f]{6}\.\w+$/, '').replace(/-/g, ' ');
  let best: { id: string; score: number } | undefined;
  for (const p of model.paints) {
    const pw = words(p.name).filter((w) => !['pearl', 'metallic', 'mica', 'with', 'dual', 'tone'].includes(w));
    const hits = pw.filter((w) => name.includes(w) || slug.includes(w)).length;
    const score = hits / Math.max(1, pw.length);
    if (score >= 0.5 && (!best || score > best.score)) best = { id: p.id, score };
  }
  return best?.id;
}

async function collect(model: CarModel): Promise<ModelPhoto[]> {
  const res = await fetch(`https://www.cardekho.com/${PAGE[model.id]}/pictures`, { headers: UA, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const all = parseGallery(await res.text());
  const folder = mainFolder(all.filter((p) => p.top !== 'colours'));
  const seen = new Set<string>();
  const photos: ModelPhoto[] = [];
  for (const p of all) {
    const file = p.src.split('/').pop()!.split('?')[0];
    if (seen.has(file) || !p.top) continue;
    if (folder && !p.src.includes(`/${folder}/`)) continue;
    seen.add(file);
    if (p.top === 'colours') {
      const hex = /_([0-9a-f]{6})\.\w+$/i.exec(file)?.[1];
      photos.push({
        url: p.src, thumb: p.thumb, group: 'colour', section: 'Colours', category: 'colour', caption: p.title,
        paintId: matchPaint(model, p.title.replace(/^.*?(?:colou?rs?)\s*/i, ''), file), hex: hex ? `#${hex}` : undefined, source: 'CarDekho',
      });
      continue;
    }
    const group = p.top === 'interior' ? 'interior' : 'exterior';
    const t = p.title.toLowerCase();
    const f = file.toLowerCase();
    let category: PhotoCategory = group === 'exterior' ? 'exterior' : 'dashboard';
    if (group === 'interior') {
      if (/third row|3rd row|last row/.test(t) || /third-row|3rd-row/.test(f)) category = 'third-row';
      else if (/rear seat/.test(t) && !/headrest|pocket|armrest|ac|vent/.test(t)) category = 'rear-seats';
      else if (/steering/.test(t)) category = 'steering';
      else if (/boot|luggage/.test(t)) category = 'boot';
      else if (/front seat|driver seat/.test(t) && !/headrest|pocket|adjust/.test(t)) category = 'front-seats';
    }
    photos.push({ url: p.src, thumb: p.thumb, group, section: p.section, category, caption: p.title, source: 'CarDekho' });
  }
  // Some models keep colours only on their separate colours page; file names carry the name + shade.
  if (!photos.some((p) => p.group === 'colour')) {
    const html = await (await fetch(`https://www.cardekho.com/${PAGE[model.id]}/colors`, { headers: UA, redirect: 'follow' })).text();
    const carFolder = folder?.split('/')[0] + '/' + folder?.split('/')[1];
    for (const m of new Set(html.match(/https:\/\/stimg\.cardekho\.com\/images\/car-images\/930x620\/[^"?\s]+/g) ?? [])) {
      const file = m.split('/').pop()!;
      if (folder && !m.includes(`/${carFolder}/`)) continue;
      const name = file.replace(/_[0-9a-f]{6}\.\w+$/i, '').replace(/-/g, ' ').replace(/\bDARK\b/, '').trim();
      const hex = /_([0-9a-f]{6})\.\w+$/i.exec(file)?.[1];
      photos.push({
        url: m, group: 'colour', section: 'Colours', category: 'colour', caption: `${model.make} ${model.model} ${name}`,
        paintId: matchPaint(model, name, file), hex: hex ? `#${hex}` : undefined, source: 'CarDekho',
      });
    }
  }

  // The full-dashboard shot is taken from the back seat over both front seats — best for picking front seats.
  const dash = photos.find((p) => p.group === 'interior' && /dashboard$/i.test(p.caption));
  if (dash) dash.seatShot = 'front-seats';
  const rear = photos.find((p) => p.category === 'rear-seats');
  if (rear) rear.seatShot = 'rear-seats';
  const third = photos.find((p) => p.category === 'third-row');
  if (third) third.seatShot = 'third-row';
  return photos;
}

const file = new URL('../shared/photos.data.json', import.meta.url);
const data: Record<string, ModelPhoto[]> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const only = process.argv.slice(2);
for (const model of CATALOG.filter((m) => !only.length || only.includes(m.id))) {
  try {
    const photos = await collect(model);
    const n = (pred: (p: ModelPhoto) => boolean) => photos.filter(pred).length;
    const paints = new Set(photos.filter((p) => p.paintId).map((p) => p.paintId)).size;
    console.log(`${model.id.padEnd(24)} ${String(photos.length).padStart(3)} photos · ext ${n((p) => p.group === 'exterior')} · int ${n((p) => p.group === 'interior')} · colours ${n((p) => p.group === 'colour')} (${paints}/${model.paints.length} paints matched) · seat shots ${photos.filter((p) => p.seatShot).map((p) => p.seatShot).join(',') || '—'}`);
    if (photos.length) data[model.id] = photos;
  } catch (e) {
    console.warn(`${model.id.padEnd(24)} failed: ${(e as Error).message}`);
  }
  await new Promise((r) => setTimeout(r, 600)); // be polite
}
fs.writeFileSync(file, JSON.stringify(data) + '\n');
await import('./split-photos.ts');
