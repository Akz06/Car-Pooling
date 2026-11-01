import type { CarModel } from '@shared/catalog';

/**
 * Real, freely-licensed photos of each model from Wikipedia / Wikimedia Commons.
 *
 * Looked up live from the browser through the public MediaWiki API (CORS via
 * origin=*), so nothing is hard-coded that could go stale. Every photo carries
 * its author, licence and file page for attribution. Results are cached in
 * localStorage; if the API is unreachable the app keeps its drawn car.
 */

export interface CarPhoto {
  src: string;
  /** Larger version for the lightbox. */
  full: string;
  page: string;
  artist: string;
  license: string;
  title: string;
}

export interface CarPhotos {
  exterior?: CarPhoto;
  interior?: CarPhoto;
}

const API = 'https://en.wikipedia.org/w/api.php';
const CACHE_KEY = 'seatshare.photos.v1';
const TTL = 7 * 24 * 3600_000;

const SKIP = /\.(svg|gif|webm|ogv|tif)$|logo|emblem|badge|icon|map|chart|crash|ncap|sales|commons-|wiki/i;
const INTERIOR = /interior|dashboard|cockpit|cabin|inside|instrument|seats?\b|steering/i;
const NOT_EXTERIOR = /interior|dashboard|cockpit|cabin|inside|instrument|seat|steering|engine|motor|boot|trunk|wheel|rear|back|heck/i;

type Cache = Record<string, { at: number; photos: CarPhotos }>;
const memory = new Map<string, Promise<CarPhotos>>();

function readCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

async function query(params: Record<string, string>) {
  const url = `${API}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  return res.json();
}

const stripHtml = (html = '') => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim();
};

/** Higher score = better match for this model's generation. */
function score(title: string, prefer: string[], lead: string | undefined) {
  let s = 0;
  for (const k of prefer) if (title.toLowerCase().includes(k.toLowerCase())) s += 3;
  if (lead && title === lead) s += 2;
  if (/front|fl\b|\bf\b|3\/4|three.quarter/i.test(title)) s += 1;
  return s;
}

function pick(files: string[], prefer: string[], lead: string | undefined, interior: boolean) {
  const pool = files.filter((f) => !SKIP.test(f) && (interior ? INTERIOR.test(f) : !NOT_EXTERIOR.test(f)));
  if (!pool.length) return undefined;
  return pool.map((f) => ({ f, s: score(f, prefer, lead) })).sort((a, b) => b.s - a.s)[0].f;
}

async function lookup(model: CarModel): Promise<CarPhotos> {
  const { article, prefer = [] } = model.wiki;
  const page = (await query({
    titles: article, redirects: '1', prop: 'pageimages|images', piprop: 'name', imlimit: 'max',
  })).query?.pages?.[0];
  if (!page || page.missing) return {};
  const lead: string | undefined = page.pageimage ? `File:${page.pageimage.replace(/_/g, ' ')}` : undefined;
  const files: string[] = (page.images ?? []).map((i: { title: string }) => i.title);
  const exterior = pick(lead && !files.includes(lead) ? [lead, ...files] : files, prefer, lead, false) ?? lead;
  const interior = pick(files, prefer, undefined, true);
  const titles = [exterior, interior].filter(Boolean) as string[];
  if (!titles.length) return {};

  const info = await query({ titles: titles.join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '960' });
  const byTitle = new Map<string, CarPhoto>();
  for (const p of info.query?.pages ?? []) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const meta = ii.extmetadata ?? {};
    byTitle.set(p.title, {
      src: ii.thumburl ?? ii.url,
      full: ii.url,
      page: ii.descriptionurl,
      artist: stripHtml(meta.Artist?.value) || 'Unknown author',
      license: stripHtml(meta.LicenseShortName?.value) || 'see file page',
      title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
    });
  }
  // The API normalises titles (underscores → spaces), so match loosely.
  const get = (t?: string) => (t ? byTitle.get(t) ?? byTitle.get(t.replace(/_/g, ' ')) : undefined);
  return { exterior: get(exterior), interior: get(interior) };
}

export function loadCarPhotos(model: CarModel): Promise<CarPhotos> {
  const cached = readCache()[model.id];
  if (cached && Date.now() - cached.at < TTL) return Promise.resolve(cached.photos);
  let p = memory.get(model.id);
  if (!p) {
    p = lookup(model).then((photos) => {
      if (photos.exterior || photos.interior) {
        const all = readCache();
        all[model.id] = { at: Date.now(), photos };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(all)); } catch { /* storage full — fine */ }
      }
      return photos;
    });
    p.catch(() => memory.delete(model.id));
    memory.set(model.id, p);
  }
  return p;
}
