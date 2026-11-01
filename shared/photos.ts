/**
 * Real photos per model, grouped like a car-portal gallery.
 * Filled in by scripts/fetch-photos (CarDekho model galleries); empty until then,
 * in which case the app falls back to Wikimedia photos and the 3D car.
 *
 * Seat pins are positions (0–1 of width/height) of each seat in a seat photo,
 * so riders can pick a seat on the real interior.
 */

import data from './photos.data.json';

export type PhotoCategory =
  | 'exterior' | 'dashboard' | 'steering' | 'front-seats' | 'rear-seats' | 'third-row' | 'boot' | 'colour';

export const CATEGORY_LABEL: Record<PhotoCategory, string> = {
  exterior: 'Looks',
  dashboard: 'Dashboard',
  steering: 'Steering Wheel',
  'front-seats': 'Front Seats',
  'rear-seats': 'Rear Seats',
  'third-row': 'Third Row',
  boot: 'Boot',
  colour: 'Colours',
};

export const INTERIOR_CATEGORIES: PhotoCategory[] = ['dashboard', 'steering', 'front-seats', 'rear-seats', 'third-row', 'boot'];
export const SEAT_CATEGORIES: PhotoCategory[] = ['front-seats', 'rear-seats', 'third-row'];

export interface ModelPhoto {
  url: string;
  category: PhotoCategory;
  caption: string;
  /** For colour photos: which catalog paint this is. */
  paintId?: string;
  /** Override default seat pin positions for this photo: seatId → [x, y]. */
  pins?: Record<string, [number, number]>;
  source?: string;
}

/**
 * Default pin positions for typical portal shots (right-hand-drive cars):
 * - front-seats: taken from the back seat looking forward → driver (1R) on the right.
 * - rear-seats / third-row: taken from the front looking back → car's left seats appear on the right.
 */
export function defaultPins(category: PhotoCategory, seats: string[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  if (category === 'front-seats') {
    for (const s of seats) out[s] = s.endsWith('R') ? [0.68, 0.8] : [0.32, 0.8];
    return out;
  }
  // looking backwards: L ↔ R are mirrored
  const n = seats.length;
  seats.forEach((s, i) => {
    const xs = n === 3 ? [0.7, 0.5, 0.3] : [0.66, 0.34];
    out[s] = [xs[i] ?? 0.5, category === 'third-row' ? 0.66 : 0.62];
  });
  return out;
}

export const MODEL_PHOTOS: Record<string, ModelPhoto[]> = data as Record<string, ModelPhoto[]>;
