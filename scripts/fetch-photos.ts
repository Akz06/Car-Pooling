/**
 * Collects real photos for every catalog model from CarDekho's model galleries
 * and writes shared/photos.data.json (internal use).
 *
 *   npx tsx scripts/fetch-photos.ts            # all models
 *   npx tsx scripts/fetch-photos.ts hyundai-i20 # one model
 *
 * Captions on CarDekho ("Hyundai i20 Rear Seats", "… Dashboard", "… Front Right Side")
 * decide the category; colour photos are matched to catalog paint names.
 */
import fs from 'node:fs';
import { CATALOG, type CarModel } from '../shared/catalog.ts';
import type { ModelPhoto, PhotoCategory } from '../shared/photos.ts';

const SLUG: Record<string, string> = {
  'maruti-swift': 'maruti/swift', 'hyundai-creta': 'hyundai/creta', 'honda-city': 'honda/city', 'tata-nexon': 'tata/nexon',
  'mahindra-xuv700': 'mahindra/xuv700', 'toyota-innova-crysta': 'toyota/innova-crysta', 'maruti-ertiga': 'maruti/ertiga',
  'kia-carens': 'kia/carens', 'toyota-fortuner': 'toyota/fortuner', 'tesla-model-y': 'tesla/model-y', 'hyundai-verna': 'hyundai/verna',
  'tata-punch': 'tata/punch', 'mahindra-thar': 'mahindra/thar', 'mahindra-scorpio-n': 'mahindra/scorpio-n', 'maruti-brezza': 'maruti/vitara-brezza',
  'maruti-baleno': 'maruti/baleno', 'maruti-dzire': 'maruti/dzire', 'hyundai-venue': 'hyundai/venue', 'hyundai-i20': 'hyundai/i20',
  'kia-seltos': 'kia/seltos', 'kia-sonet': 'kia/sonet', 'toyota-hyryder': 'toyota/urban-cruiser-hyryder', 'mg-hector': 'mg/hector',
  'tata-safari': 'tata/safari', 'tata-harrier': 'tata/harrier', 'maruti-wagonr': 'maruti/wagon-r', 'honda-amaze': 'honda/amaze',
  'mahindra-xuv3xo': 'mahindra/xuv-3xo', 'maruti-fronx': 'maruti/fronx', 'toyota-innova-hycross': 'toyota/innova-hycross',
};

const RULES: [RegExp, PhotoCategory][] = [
  [/third row|3rd row|last row/i, 'third-row'],
  [/rear seat|back seat|second row|2nd row|rear passenger/i, 'rear-seats'],
  [/front seat|driver seat|co-?driver|passenger seat|seats?$/i, 'front-seats'],
  [/steering/i, 'steering'],
  [/dashboard|dash board|cockpit|instrument|infotainment|touchscreen|centre console|center console/i, 'dashboard'],
  [/boot|trunk|cargo|luggage/i, 'boot'],
  [/front|rear|side|quarter|view|exterior|headlight|tail ?light|grille|wheel|alloy/i, 'exterior'],
];

const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', accept: 'text/html' };

async function page(url: string) {
  const r = await fetch(url, { headers: UA, redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

/** All (image url, caption) pairs on a page: <img> tags plus JSON blobs in scripts. */
function images(html: string) {
  const out: { url: string; alt: string }[] = [];
  const tag = /<img\b[^>]*>/gi;
  for (const m of html.matchAll(tag)) {
    const t = m[0];
    const src = /(?:data-src|src)="([^"]+stimg\.cardekho\.com[^"]+)"/i.exec(t)?.[1];
    const alt = /(?:alt|title)="([^"]*)"/i.exec(t)?.[1] ?? '';
    if (src) out.push({ url: src, alt });
  }
  const json = /"(?:url|image|src)"\s*:\s*"(https?:\\?\/\\?\/stimg\.cardekho\.com[^"]+)"[^{}]*?"(?:alt|title|caption|name)"\s*:\s*"([^"]+)"/gi;
  for (const m of html.matchAll(json)) out.push({ url: m[1].replace(/\\\//g, '/'), alt: m[2] });
  // prefer the largest rendition CarDekho serves
  return out.map((o) => ({ ...o, url: o.url.replace(/\/\d+x\d+\//, '/930x620/').split('?')[0] }));
}

const categorise = (alt: string) => RULES.find(([re]) => re.test(alt))?.[1];

async function collect(model: CarModel): Promise<ModelPhoto[]> {
  const slug = SLUG[model.id];
  const base = `https://www.cardekho.com/${slug}`;
  const seen = new Set<string>();
  const photos: ModelPhoto[] = [];
  const add = (p: ModelPhoto) => { if (!seen.has(p.url)) { seen.add(p.url); photos.push(p); } };
  for (const path of ['pictures', 'interior-images', 'exterior-images']) {
    try {
      for (const { url, alt } of images(await page(`${base}/${path}`))) {
        const caption = alt.trim() || `${model.make} ${model.model}`;
        if (!new RegExp(model.model.split(' ')[0], 'i').test(caption)) continue; // skip other cars on the page
        const category = categorise(caption.replace(new RegExp(`^.*?${model.model}`, 'i'), ''));
        if (category) add({ url, category, caption, source: 'CarDekho' });
      }
    } catch (e) {
      console.warn(`  ${model.id}: ${(e as Error).message}`);
    }
  }
  try {
    for (const { url, alt } of images(await page(`${base}/colors`))) {
      const paint = model.paints.find((p) => alt.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]) && alt.toLowerCase().includes(p.name.toLowerCase().split(' ').slice(-1)[0]));
      if (paint) add({ url, category: 'colour', caption: `${model.make} ${model.model} ${paint.name}`, paintId: paint.id, source: 'CarDekho' });
    }
  } catch (e) {
    console.warn(`  ${model.id} colours: ${(e as Error).message}`);
  }
  return photos;
}

const file = new URL('../shared/photos.data.json', import.meta.url);
const data: Record<string, ModelPhoto[]> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const only = process.argv.slice(2);
for (const model of CATALOG.filter((m) => !only.length || only.includes(m.id))) {
  const photos = await collect(model);
  const count = (c: PhotoCategory) => photos.filter((p) => p.category === c).length;
  console.log(`${model.id.padEnd(24)} ${photos.length} photos · ext ${count('exterior')} · dash ${count('dashboard')} · front ${count('front-seats')} · rear ${count('rear-seats')} · 3rd ${count('third-row')} · colours ${count('colour')}`);
  if (photos.length) data[model.id] = photos;
}
fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
