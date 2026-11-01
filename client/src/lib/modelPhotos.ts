import type { CarModel } from '@shared/catalog';
import { MODEL_PHOTOS, SEAT_CATEGORIES, defaultPins, type ModelPhoto, type PhotoCategory } from '@shared/photos';
import type { CarPhotos } from './carPhotos';

export interface GalleryPhoto extends ModelPhoto {
  credit?: { text: string; href?: string };
}

/** Portal photos when we have them, otherwise the live Wikimedia exterior/interior. */
export function galleryPhotos(model: CarModel, wiki: CarPhotos | null): GalleryPhoto[] {
  const own = MODEL_PHOTOS[model.id];
  if (own?.length) return own.map((p) => ({ ...p, credit: p.source ? { text: `Photo: ${p.source}` } : undefined }));
  const out: GalleryPhoto[] = [];
  const credit = (p: NonNullable<CarPhotos['exterior']>) => ({ text: `📷 ${p.artist} · ${p.license} · Wikimedia Commons`, href: p.page });
  if (wiki?.exterior) out.push({ url: wiki.exterior.src, category: 'exterior', caption: `${model.make} ${model.model} Front Quarter View`, credit: credit(wiki.exterior) });
  if (wiki?.interior) out.push({ url: wiki.interior.src, category: 'dashboard', caption: `${model.make} ${model.model} Dashboard`, credit: credit(wiki.interior) });
  return out;
}

/** Seat rows shown in each seat photo category. */
export function rowForCategory(model: CarModel, c: PhotoCategory) {
  return c === 'front-seats' ? model.rows[0] : c === 'rear-seats' ? model.rows[1] : c === 'third-row' ? model.rows[2] : undefined;
}

/** Seat photos with resolved pin positions, one per row that the model has. */
export function seatPhotos(model: CarModel) {
  const own = MODEL_PHOTOS[model.id] ?? [];
  return SEAT_CATEGORIES.flatMap((c) => {
    const row = rowForCategory(model, c);
    const photo = own.find((p) => p.category === c);
    if (!row || !photo) return [];
    return [{ category: c, photo, pins: { ...defaultPins(c, row.seats), ...photo.pins } }];
  });
}

export const hasSeatPhotos = (model: CarModel) => seatPhotos(model).length > 0;
