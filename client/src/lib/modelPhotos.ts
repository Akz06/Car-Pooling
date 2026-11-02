import type { CarModel } from '@shared/catalog';
import { useEffect, useState } from 'react';
import { SEAT_CATEGORIES, SEAT_SHOTS, defaultPins, type ModelPhoto, type PhotoCategory } from '@shared/photos';
import type { CarPhotos } from './carPhotos';
import { PIN_OVERRIDES, SKIP_SEAT_SHOTS } from '@shared/photo-pins';

/** With a real server, photos go through its same-origin cache (/api/img); static builds load them directly. */
export function viaCache(url: string) {
  if (import.meta.env.VITE_DEMO) return url;
  try {
    const h = new URL(url).hostname;
    return h === 'upload.wikimedia.org' || h === 'stimg.cardekho.com' ? `/api/img?u=${encodeURIComponent(url)}` : url;
  } catch {
    return url;
  }
}

export interface GalleryPhoto extends ModelPhoto {
  credit?: { text: string; href?: string };
}

const galleries = new Map<string, Promise<ModelPhoto[]>>();

/** A model's full portal gallery, fetched once from /photos/<model>.json. null while loading. */
export function useModelGallery(model: CarModel) {
  const [state, setState] = useState<{ id: string; photos: ModelPhoto[] | null }>({ id: model.id, photos: null });
  useEffect(() => {
    let live = true;
    let p = galleries.get(model.id);
    if (!p) {
      p = fetch(`${import.meta.env.BASE_URL}photos/${model.id}.json`)
        .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : []))
        .catch(() => []);
      galleries.set(model.id, p);
    }
    p.then((photos) => live && setState({ id: model.id, photos }));
    return () => { live = false; };
  }, [model]);
  return state.id === model.id ? state.photos : null;
}

/** Portal photos when we have them, otherwise the live Wikimedia exterior/interior. */
export function galleryPhotos(model: CarModel, wiki: CarPhotos | null, own: ModelPhoto[] | null): GalleryPhoto[] {
  if (own?.length) return own.map((p) => ({ ...p, url: viaCache(p.url), thumb: p.thumb ? viaCache(p.thumb) : undefined, credit: p.source ? { text: `Photo: ${p.source}` } : undefined }));
  const out: GalleryPhoto[] = [];
  const credit = (p: NonNullable<CarPhotos['exterior']>) => ({ text: `📷 ${p.artist} · ${p.license} · Wikimedia Commons`, href: p.page });
  if (wiki?.exterior) out.push({ url: viaCache(wiki.exterior.src), group: 'exterior', section: 'Looks', category: 'exterior', caption: `${model.make} ${model.model} Front Quarter View`, credit: credit(wiki.exterior) });
  if (wiki?.interior) out.push({ url: viaCache(wiki.interior.src), group: 'interior', section: 'Dashboard', category: 'dashboard', caption: `${model.make} ${model.model} Dashboard`, credit: credit(wiki.interior) });
  return out;
}

/** Seat rows shown in each seat photo category. */
export function rowForCategory(model: CarModel, c: PhotoCategory) {
  return c === 'front-seats' ? model.rows[0] : c === 'rear-seats' ? model.rows[1] : c === 'third-row' ? model.rows[2] : undefined;
}

/** Seat photos with resolved pin positions, one per row that the model has. */
export function seatPhotos(model: CarModel) {
  const own = SEAT_SHOTS[model.id] ?? [];
  return SEAT_CATEGORIES.flatMap((c) => {
    const row = rowForCategory(model, c);
    const photo = own.find((p) => p.seatShot === c) ?? own.find((p) => !p.group && p.category === c);
    if (!row || !photo || SKIP_SEAT_SHOTS[model.id]?.includes(c)) return [];
    const shot = c as 'front-seats' | 'rear-seats' | 'third-row';
    const pins: Record<string, [number, number]> = { ...defaultPins(c, row.seats), ...PIN_OVERRIDES[model.id]?.[shot], ...photo.pins };
    // Only pins for seats this layout really has (e.g. a 6-seater has no 2M).
    const valid: Record<string, [number, number]> = Object.fromEntries(Object.entries(pins).filter(([id]) => row.seats.includes(id)));
    return [{ category: c, photo: { ...photo, url: viaCache(photo.url) }, pins: valid }];
  });
}

export const hasSeatPhotos = (model: CarModel) => seatPhotos(model).length > 0;
