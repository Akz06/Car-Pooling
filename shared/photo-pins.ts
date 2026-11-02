/**
 * Hand-placed seat pins for CarDekho seat photos (x, y as fractions of the photo).
 * Most "Rear Seats" shots are taken through a rear door at an angle, so the
 * default straight-on positions don't fit. Checked by eye against each photo:
 * through the RIGHT rear door the nearest seat is 2R; through the LEFT one, 2L.
 */
type Pins = Record<string, [number, number]>;

export const PIN_OVERRIDES: Record<string, Partial<Record<'front-seats' | 'rear-seats' | 'third-row', Pins>>> = {
  'honda-amaze': { 'rear-seats': { '2R': [0.5, 0.8], '2M': [0.62, 0.63], '2L': [0.73, 0.57] } },
  'hyundai-creta': { 'rear-seats': { '2R': [0.55, 0.82], '2M': [0.66, 0.66], '2L': [0.77, 0.6] } },
  'hyundai-venue': { 'rear-seats': { '2R': [0.42, 0.82], '2M': [0.46, 0.7], '2L': [0.5, 0.62] } },
  'hyundai-verna': { 'rear-seats': { '2R': [0.62, 0.84], '2M': [0.63, 0.63], '2L': [0.76, 0.58] } },
  'kia-seltos': { 'rear-seats': { '2R': [0.5, 0.77], '2M': [0.52, 0.6], '2L': [0.58, 0.53] } },
  'kia-sonet': { 'rear-seats': { '2R': [0.55, 0.75], '2M': [0.52, 0.59], '2L': [0.57, 0.5] } },
  'mahindra-xuv3xo': { 'rear-seats': { '2L': [0.6, 0.8], '2M': [0.5, 0.67], '2R': [0.4, 0.6] } },
  'mahindra-xuv700': { 'rear-seats': { '2R': [0.48, 0.82], '2M': [0.55, 0.66], '2L': [0.63, 0.56] } },
  'maruti-baleno': { 'rear-seats': { '2R': [0.58, 0.8], '2M': [0.68, 0.65], '2L': [0.78, 0.56] } },
  'maruti-brezza': { 'rear-seats': { '2L': [0.45, 0.8], '2M': [0.42, 0.62], '2R': [0.34, 0.55] } },
  'maruti-dzire': { 'rear-seats': { '2R': [0.55, 0.84], '2M': [0.65, 0.68], '2L': [0.75, 0.6] } },
  'maruti-ertiga': { 'rear-seats': { '2R': [0.45, 0.82], '2M': [0.55, 0.65], '2L': [0.65, 0.55] } },
  'maruti-fronx': { 'rear-seats': { '2R': [0.6, 0.82], '2M': [0.64, 0.66], '2L': [0.71, 0.56] } },
  'tata-harrier': { 'rear-seats': { '2R': [0.55, 0.82], '2M': [0.62, 0.63], '2L': [0.72, 0.56] } },
  'tata-nexon': { 'rear-seats': { '2R': [0.4, 0.8], '2M': [0.6, 0.66], '2L': [0.8, 0.6] } },
  'tata-punch': { 'rear-seats': { '2R': [0.42, 0.72], '2M': [0.47, 0.58], '2L': [0.55, 0.5] } },
  'tata-safari': { 'rear-seats': { '2R': [0.6, 0.76], '2L': [0.62, 0.53] } },
  'tesla-model-y': { 'rear-seats': { '2R': [0.5, 0.82], '2M': [0.56, 0.66], '2L': [0.63, 0.58] } },
};

/** Seat photos that are too ambiguous to pin reliably — those rows fall back to 3D / seat map. */
export const SKIP_SEAT_SHOTS: Record<string, string[]> = {
  'mahindra-scorpio-n': ['rear-seats'],
  'toyota-innova-hycross': ['rear-seats', 'third-row'],
};
