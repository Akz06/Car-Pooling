/**
 * Catalog of real cars with model-accurate dimensions, seat layouts,
 * factory paint options and interior trims. Everything the renderer needs
 * to draw a convincing top-down cutaway of the actual car.
 *
 * Dimensions are manufacturer figures in millimetres. All cars are
 * right-hand drive (Indian market), so the driver sits in seat "1R".
 */

import { MORE_INDIAN_MODELS } from './catalog-more.ts';

export type BodyType = 'hatchback' | 'sedan' | 'compact-suv' | 'suv' | 'mpv';
export type Finish = 'solid' | 'metallic' | 'pearl' | 'matte';
export type SeatKind = 'bucket' | 'bench' | 'captain';
export type ScreenStyle = 'integrated' | 'floating' | 'panoramic' | 'tesla';
export type Cluster = 'analog' | 'digital' | 'none';
export type Shifter = 'manual' | 'lever' | 'dial' | 'column';
export type Sunroof = 'none' | 'single' | 'panoramic' | 'glass-roof';

export interface Paint {
  id: string;
  name: string;
  hex: string;
  finish: Finish;
  /** Contrast roof colour for dual-tone paints. */
  roof?: string;
}

export interface Interior {
  id: string;
  name: string;
  /** Main seat upholstery. */
  seat: string;
  /** Centre insert of the seat (often perforated / quilted). */
  insert: string;
  /** Side bolsters. */
  bolster: string;
  stitch: string;
  dash: string;
  /** Soft-touch / accent strip on the dash and doors. */
  accent: string;
  carpet: string;
  material: 'fabric' | 'leatherette' | 'leather' | 'vegan-leather';
}

export interface SeatRow {
  kind: SeatKind;
  /** Seat ids, left to right as seen from above with the nose pointing up. */
  seats: string[];
}

/** An alternative factory seating version, e.g. the 5-seater XUV700. */
export interface SeatLayout {
  id: string;
  label: string;
  rows: SeatRow[];
}

export interface CarModel {
  id: string;
  make: string;
  model: string;
  generation: string;
  body: BodyType;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  wheelbaseMm: number;
  engine: string;
  transmission: string;
  fuel: 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid' | 'CNG';
  bootLitres: number;
  rows: SeatRow[];
  /** Label for the default `rows`, e.g. "7-seater (captain seats)". */
  defaultLayoutLabel?: string;
  /** Other seating versions sold in India; `rows` stays the default. */
  layouts?: SeatLayout[];
  screen: ScreenStyle;
  screenInches: number;
  cluster: Cluster;
  shifter: Shifter;
  sunroof: Sunroof;
  roofRails: boolean;
  ambientLight: boolean;
  /** Brand colour used for the badge on the steering boss and UI accents. */
  brandColor: string;
  /** Wikipedia article used to find real, freely-licensed photos; prefer = filename hints for the right generation. */
  wiki: { article: string; prefer?: string[] };
  /** Full-width LED light bars, as on the real car. */
  lightBar?: 'front' | 'rear' | 'both';
  features: string[];
  paints: Paint[];
  interiors: Interior[];
}

const ROW_FRONT: SeatRow = { kind: 'bucket', seats: ['1L', '1R'] };
const ROW_BENCH3 = (row: number): SeatRow => ({ kind: 'bench', seats: [`${row}L`, `${row}M`, `${row}R`] });
const ROW_BENCH2 = (row: number): SeatRow => ({ kind: 'bench', seats: [`${row}L`, `${row}R`] });
const ROW_CAPTAIN = (row: number): SeatRow => ({ kind: 'captain', seats: [`${row}L`, `${row}R`] });

export const DRIVER_SEAT = '1R';

export const CATALOG: CarModel[] = [
  {
    id: 'maruti-swift',
    make: 'Maruti Suzuki',
    model: 'Swift',
    generation: '4th gen (2024)',
    body: 'hatchback',
    lengthMm: 3860,
    widthMm: 1735,
    heightMm: 1520,
    wheelbaseMm: 2450,
    engine: '1.2L Z12E 3-cyl',
    transmission: '5-speed MT / AMT',
    fuel: 'Petrol',
    bootLitres: 265,
    rows: [ROW_FRONT, ROW_BENCH3(2)],
    screen: 'floating',
    screenInches: 9,
    cluster: 'analog',
    shifter: 'manual',
    sunroof: 'none',
    roofRails: false,
    ambientLight: false,
    brandColor: '#1d4ed8',
    wiki: { article: 'Suzuki Swift', prefer: ['2024', '2023', 'fourth', '4th'] },
    features: ['9" SmartPlay Pro+', '6 airbags', 'Auto climate control', 'Rear AC vents'],
    paints: [
      { id: 'luster-blue', name: 'Luster Blue', hex: '#1f5fa8', finish: 'metallic' },
      { id: 'novel-orange', name: 'Novel Orange', hex: '#d9541e', finish: 'metallic' },
      { id: 'sizzling-red', name: 'Sizzling Red', hex: '#b3121b', finish: 'solid', roof: '#121316' },
      { id: 'pearl-arctic-white', name: 'Pearl Arctic White', hex: '#eef0f1', finish: 'pearl' },
      { id: 'splendid-silver', name: 'Splendid Silver', hex: '#a9adb1', finish: 'metallic' },
      { id: 'magma-grey', name: 'Magma Grey', hex: '#55585c', finish: 'metallic' },
      { id: 'bluish-black', name: 'Bluish Black', hex: '#15181f', finish: 'pearl' },
    ],
    interiors: [
      { id: 'black-silver', name: 'Black with Silver accents', seat: '#2a2b2e', insert: '#3a3c40', bolster: '#1d1e20', stitch: '#7d8187', dash: '#1b1c1e', accent: '#a8adb3', carpet: '#1a1a1b', material: 'fabric' },
      { id: 'black-greige', name: 'Black & Greige (ZXi+)', seat: '#2b2b2c', insert: '#8e877c', bolster: '#202021', stitch: '#b9b2a6', dash: '#1d1d1e', accent: '#8e877c', carpet: '#1b1b1c', material: 'fabric' },
    ],
  },
  {
    id: 'hyundai-creta',
    make: 'Hyundai',
    model: 'Creta',
    generation: '2nd gen facelift (2024)',
    body: 'compact-suv',
    lengthMm: 4330,
    widthMm: 1790,
    heightMm: 1635,
    wheelbaseMm: 2610,
    engine: '1.5L Turbo GDi / 1.5L CRDi',
    transmission: '7-speed DCT / 6-speed AT',
    fuel: 'Petrol',
    bootLitres: 433,
    rows: [ROW_FRONT, ROW_BENCH3(2)],
    screen: 'panoramic',
    screenInches: 10.25,
    cluster: 'digital',
    shifter: 'lever',
    sunroof: 'panoramic',
    roofRails: true,
    ambientLight: true,
    brandColor: '#0b3d91',
    wiki: { article: 'Hyundai Creta', prefer: ['2024', '2025', 'SU2', 'facelift'] },
    lightBar: 'both',
    features: ['Panoramic sunroof', 'Dual 10.25" curved displays', 'Level 2 ADAS', 'Ventilated front seats', 'Bose 8-speaker audio'],
    paints: [
      { id: 'atlas-white', name: 'Atlas White', hex: '#f2f3f3', finish: 'solid', roof: '#101114' },
      { id: 'abyss-black', name: 'Abyss Black', hex: '#0e0f12', finish: 'pearl' },
      { id: 'fiery-red', name: 'Fiery Red', hex: '#a3141c', finish: 'pearl' },
      { id: 'ranger-khaki', name: 'Ranger Khaki', hex: '#76704f', finish: 'metallic' },
      { id: 'robust-emerald', name: 'Robust Emerald Pearl', hex: '#14423a', finish: 'pearl' },
      { id: 'titan-grey-matte', name: 'Titan Grey Matte', hex: '#5d6064', finish: 'matte' },
      { id: 'starry-night', name: 'Starry Night', hex: '#1b2238', finish: 'metallic' },
    ],
    interiors: [
      { id: 'black-greige', name: 'Black & Greige dual-tone', seat: '#2a2a2b', insert: '#9d968b', bolster: '#1f1f20', stitch: '#c2bbaf', dash: '#1a1a1b', accent: '#9d968b', carpet: '#1d1c1c', material: 'leatherette' },
      { id: 'all-black-n', name: 'All Black (N Line red stitch)', seat: '#18191b', insert: '#262729', bolster: '#121314', stitch: '#d0182b', dash: '#141516', accent: '#d0182b', carpet: '#141414', material: 'leatherette' },
    ],
  },
  {
    id: 'honda-city',
    make: 'Honda',
    model: 'City',
    generation: '5th gen (2023)',
    body: 'sedan',
    lengthMm: 4583,
    widthMm: 1748,
    heightMm: 1489,
    wheelbaseMm: 2600,
    engine: '1.5L i-VTEC / e:HEV',
    transmission: '6-speed MT / CVT',
    fuel: 'Petrol',
    bootLitres: 506,
    rows: [ROW_FRONT, ROW_BENCH3(2)],
    screen: 'integrated',
    screenInches: 8,
    cluster: 'analog',
    shifter: 'lever',
    sunroof: 'single',
    roofRails: false,
    ambientLight: false,
    brandColor: '#c8102e',
    wiki: { article: 'Honda City', prefer: ['2020', '2021', '2022', '2023', '2024', 'GN', 'fifth'] },
    features: ['Single-pane sunroof', 'Honda SENSING ADAS', 'LaneWatch camera', '506 L boot'],
    paints: [
      { id: 'platinum-white', name: 'Platinum White Pearl', hex: '#ecebe6', finish: 'pearl' },
      { id: 'lunar-silver', name: 'Lunar Silver Metallic', hex: '#b2b5b8', finish: 'metallic' },
      { id: 'golden-brown', name: 'Golden Brown Metallic', hex: '#6d5236', finish: 'metallic' },
      { id: 'meteoroid-grey', name: 'Meteoroid Grey Metallic', hex: '#4b4e52', finish: 'metallic' },
      { id: 'radiant-red', name: 'Radiant Red Metallic', hex: '#8e0f17', finish: 'metallic' },
      { id: 'obsidian-blue', name: 'Obsidian Blue Pearl', hex: '#16213a', finish: 'pearl' },
    ],
    interiors: [
      { id: 'black-beige', name: 'Black & Beige', seat: '#c8b796', insert: '#d6c8aa', bolster: '#b5a281', stitch: '#8c7a5c', dash: '#1d1c1b', accent: '#c8b796', carpet: '#2a2622', material: 'leatherette' },
      { id: 'black', name: 'All Black', seat: '#222325', insert: '#2e3033', bolster: '#1a1b1c', stitch: '#5f6266', dash: '#1a1a1b', accent: '#6b6f74', carpet: '#191919', material: 'fabric' },
    ],
  },
  {
    id: 'tata-nexon',
    make: 'Tata',
    model: 'Nexon',
    generation: 'Facelift (2023)',
    body: 'compact-suv',
    lengthMm: 3995,
    widthMm: 1804,
    heightMm: 1620,
    wheelbaseMm: 2498,
    engine: '1.2L Turbo Revotron / 1.5L Revotorq',
    transmission: '6-speed MT / 7-speed DCA',
    fuel: 'Petrol',
    bootLitres: 382,
    rows: [ROW_FRONT, ROW_BENCH3(2)],
    screen: 'floating',
    screenInches: 10.25,
    cluster: 'digital',
    shifter: 'lever',
    sunroof: 'single',
    roofRails: true,
    ambientLight: true,
    brandColor: '#1a3b8b',
    wiki: { article: 'Tata Nexon', prefer: ['2023', '2024', '2025', 'facelift'] },
    lightBar: 'rear',
    features: ['5-star Bharat NCAP', '10.25" Harman infotainment', 'Ventilated seats', '360° camera'],
    paints: [
      { id: 'creative-ocean', name: 'Creative Ocean', hex: '#1f6f8b', finish: 'metallic', roof: '#141416' },
      { id: 'fearless-purple', name: 'Fearless Purple', hex: '#4d2a6b', finish: 'metallic', roof: '#141416' },
      { id: 'flame-red', name: 'Flame Red', hex: '#b11a1f', finish: 'solid', roof: '#141416' },
      { id: 'pure-grey', name: 'Pure Grey', hex: '#6f7378', finish: 'metallic' },
      { id: 'calgary-white', name: 'Calgary White', hex: '#f0f1ef', finish: 'solid' },
      { id: 'daytona-grey', name: 'Daytona Grey', hex: '#3c3f44', finish: 'metallic' },
    ],
    interiors: [
      { id: 'mocha', name: 'Mocha & Black', seat: '#5b4232', insert: '#73563f', bolster: '#3d2c22', stitch: '#b89a7c', dash: '#1d1b1a', accent: '#73563f', carpet: '#1f1d1b', material: 'leatherette' },
      { id: 'purple-theme', name: 'Fearless Purple theme', seat: '#2a2430', insert: '#4b3962', bolster: '#1f1a24', stitch: '#9b7fc4', dash: '#1b191d', accent: '#6e52a0', carpet: '#1b191d', material: 'leatherette' },
    ],
  },
  {
    id: 'mahindra-xuv700',
    make: 'Mahindra',
    model: 'XUV700',
    generation: 'AX7 L (2024)',
    body: 'suv',
    lengthMm: 4695,
    widthMm: 1890,
    heightMm: 1755,
    wheelbaseMm: 2750,
    engine: '2.0L mStallion turbo / 2.2L mHawk',
    transmission: '6-speed AT',
    fuel: 'Diesel',
    bootLitres: 240,
    rows: [ROW_FRONT, ROW_BENCH3(2), ROW_BENCH2(3)],
    defaultLayoutLabel: '7-seater',
    layouts: [{ id: '5', label: '5-seater', rows: [ROW_FRONT, ROW_BENCH3(2)] }, { id: '6c', label: '6-seater (captain seats)', rows: [ROW_FRONT, ROW_CAPTAIN(2), ROW_BENCH2(3)] }],
    screen: 'panoramic',
    screenInches: 10.25,
    cluster: 'digital',
    shifter: 'lever',
    sunroof: 'panoramic',
    roofRails: true,
    ambientLight: true,
    brandColor: '#b40019',
    wiki: { article: 'Mahindra XUV700', prefer: ['XUV700'] },
    lightBar: 'rear',
    features: ['Skyroof (panoramic)', 'Dual 10.25" HD screens', 'Sony 3D sound (12 speakers)', 'ADAS', 'Flush door handles'],
    paints: [
      { id: 'everest-white', name: 'Everest White', hex: '#f1f1ee', finish: 'solid' },
      { id: 'midnight-black', name: 'Midnight Black', hex: '#0d0e10', finish: 'metallic' },
      { id: 'dazzling-silver', name: 'Dazzling Silver', hex: '#b6b9bc', finish: 'metallic' },
      { id: 'red-rage', name: 'Red Rage', hex: '#8f1018', finish: 'metallic' },
      { id: 'electric-blue', name: 'Electric Blue', hex: '#1c4f9c', finish: 'metallic' },
      { id: 'deep-forest', name: 'Deep Forest', hex: '#1f3a2c', finish: 'metallic' },
      { id: 'burnt-sienna', name: 'Burnt Sienna', hex: '#7c3a20', finish: 'metallic' },
    ],
    interiors: [
      { id: 'black-ivory', name: 'Black & Ivory', seat: '#e3dccd', insert: '#ece6da', bolster: '#d3cab7', stitch: '#8a7f6a', dash: '#1b1b1c', accent: '#c7bfae', carpet: '#232120', material: 'leatherette' },
      { id: 'all-black', name: 'Ebony Black', seat: '#1d1e20', insert: '#2a2b2e', bolster: '#151617', stitch: '#77695a', dash: '#161718', accent: '#8a7b63', carpet: '#151515', material: 'leatherette' },
    ],
  },
  {
    id: 'toyota-innova-crysta',
    make: 'Toyota',
    model: 'Innova Crysta',
    generation: '2.4 ZX 7-seater',
    body: 'mpv',
    lengthMm: 4735,
    widthMm: 1830,
    heightMm: 1795,
    wheelbaseMm: 2750,
    engine: '2.4L 2GD-FTV diesel',
    transmission: '5-speed MT',
    fuel: 'Diesel',
    bootLitres: 300,
    rows: [ROW_FRONT, ROW_CAPTAIN(2), ROW_BENCH3(3)],
    defaultLayoutLabel: '7-seater (captain seats)',
    layouts: [{ id: '8', label: '8-seater', rows: [ROW_FRONT, ROW_BENCH3(2), ROW_BENCH3(3)] }],
    screen: 'integrated',
    screenInches: 8,
    cluster: 'analog',
    shifter: 'manual',
    sunroof: 'none',
    roofRails: false,
    ambientLight: true,
    brandColor: '#d71920',
    wiki: { article: 'Toyota Innova', prefer: ['Crysta', 'AN140'] },
    features: ['2nd-row captain seats', 'Roof-mounted rear AC', 'Ambient roof lighting', '7 airbags'],
    paints: [
      { id: 'super-white', name: 'Super White', hex: '#f4f4f1', finish: 'solid' },
      { id: 'silver-metallic', name: 'Silver Metallic', hex: '#b4b7ba', finish: 'metallic' },
      { id: 'attitude-black', name: 'Attitude Black Mica', hex: '#101114', finish: 'pearl' },
      { id: 'avant-garde-bronze', name: 'Avant-Garde Bronze', hex: '#6b5644', finish: 'metallic' },
      { id: 'platinum-white-pearl', name: 'Platinum White Pearl', hex: '#ecebe4', finish: 'pearl' },
    ],
    interiors: [
      { id: 'camel-tan', name: 'Camel Tan', seat: '#9a6a43', insert: '#a97a52', bolster: '#7d5433', stitch: '#e0c3a0', dash: '#2a221c', accent: '#b58b62', carpet: '#2b241f', material: 'leather' },
      { id: 'black', name: 'Black', seat: '#1f2022', insert: '#2b2c2f', bolster: '#171819', stitch: '#5d5f63', dash: '#191a1b', accent: '#8b7a5c', carpet: '#171717', material: 'leatherette' },
    ],
  },
  {
    id: 'maruti-ertiga',
    make: 'Maruti Suzuki',
    model: 'Ertiga',
    generation: '2nd gen (2022)',
    body: 'mpv',
    lengthMm: 4395,
    widthMm: 1735,
    heightMm: 1690,
    wheelbaseMm: 2740,
    engine: '1.5L K15C Smart Hybrid',
    transmission: '5-speed MT / 6-speed AT',
    fuel: 'CNG',
    bootLitres: 209,
    rows: [ROW_FRONT, ROW_BENCH3(2), ROW_BENCH2(3)],
    screen: 'floating',
    screenInches: 7,
    cluster: 'analog',
    shifter: 'manual',
    sunroof: 'none',
    roofRails: false,
    ambientLight: false,
    brandColor: '#1d4ed8',
    wiki: { article: 'Suzuki Ertiga', prefer: ['2018', '2019', '2020', '2021', '2022', '2023', 'second'] },
    features: ['Factory S-CNG', 'Roof-mounted rear AC', '60:40 split 2nd row', 'Reclining 3rd row'],
    paints: [
      { id: 'pearl-arctic-white', name: 'Pearl Arctic White', hex: '#eff0f0', finish: 'pearl' },
      { id: 'splendid-silver', name: 'Splendid Silver', hex: '#aeb1b4', finish: 'metallic' },
      { id: 'magma-grey', name: 'Magma Grey', hex: '#57595d', finish: 'metallic' },
      { id: 'auburn-red', name: 'Auburn Red', hex: '#7c1a1f', finish: 'metallic' },
      { id: 'dignity-brown', name: 'Pearl Metallic Dignity Brown', hex: '#5a4636', finish: 'pearl' },
      { id: 'oxford-blue', name: 'Pearl Metallic Oxford Blue', hex: '#1d2942', finish: 'pearl' },
    ],
    interiors: [
      { id: 'beige-black', name: 'Dual-tone Beige & Black', seat: '#cbbd9f', insert: '#d8ccb2', bolster: '#b6a685', stitch: '#8f8064', dash: '#2a2723', accent: '#a99a7b', carpet: '#2a2622', material: 'fabric' },
    ],
  },
  {
    id: 'kia-carens',
    make: 'Kia',
    model: 'Carens',
    generation: 'Luxury Plus 6-seater',
    body: 'mpv',
    lengthMm: 4540,
    widthMm: 1800,
    heightMm: 1708,
    wheelbaseMm: 2780,
    engine: '1.5L Turbo GDi',
    transmission: '7-speed DCT',
    fuel: 'Petrol',
    bootLitres: 216,
    rows: [ROW_FRONT, ROW_CAPTAIN(2), ROW_BENCH2(3)],
    defaultLayoutLabel: '6-seater (captain seats)',
    layouts: [{ id: '7', label: '7-seater', rows: [ROW_FRONT, ROW_BENCH3(2), ROW_BENCH2(3)] }],
    screen: 'integrated',
    screenInches: 10.25,
    cluster: 'digital',
    shifter: 'lever',
    sunroof: 'single',
    roofRails: true,
    ambientLight: true,
    brandColor: '#05141f',
    wiki: { article: 'Kia Carens', prefer: ['2022', '2023', '2024', '2025', 'KY'] },
    lightBar: 'both',
    features: ['2nd-row captain seats', 'One-touch electric tumble', 'Bose 8-speaker audio', '64-colour ambient lighting'],
    paints: [
      { id: 'imperial-blue', name: 'Imperial Blue', hex: '#1b2a4d', finish: 'metallic' },
      { id: 'sparkling-silver', name: 'Sparkling Silver', hex: '#b7babd', finish: 'metallic' },
      { id: 'gravity-grey', name: 'Gravity Grey', hex: '#4a4d51', finish: 'metallic' },
      { id: 'aurora-black', name: 'Aurora Black Pearl', hex: '#0f1013', finish: 'pearl' },
      { id: 'glacier-white', name: 'Glacier White Pearl', hex: '#eeeeea', finish: 'pearl' },
      { id: 'intense-red', name: 'Intense Red', hex: '#a3121d', finish: 'solid' },
      { id: 'pewter-olive', name: 'Pewter Olive', hex: '#5b5d4b', finish: 'metallic' },
    ],
    interiors: [
      { id: 'indigo-beige', name: 'Indigo & Beige', seat: '#2a3350', insert: '#d1c4a8', bolster: '#202842', stitch: '#d1c4a8', dash: '#1b1d24', accent: '#3a4670', carpet: '#1d1e24', material: 'leatherette' },
      { id: 'black', name: 'Black', seat: '#1e1f21', insert: '#2b2c2f', bolster: '#161718', stitch: '#6d7076', dash: '#18191a', accent: '#6d7076', carpet: '#171717', material: 'leatherette' },
    ],
  },
  {
    id: 'toyota-fortuner',
    make: 'Toyota',
    model: 'Fortuner',
    generation: 'Legender 4x4 (2024)',
    body: 'suv',
    lengthMm: 4795,
    widthMm: 1855,
    heightMm: 1857,
    wheelbaseMm: 2745,
    engine: '2.8L 1GD-FTV diesel',
    transmission: '6-speed AT, 4WD',
    fuel: 'Diesel',
    bootLitres: 296,
    rows: [ROW_FRONT, ROW_BENCH3(2), ROW_BENCH2(3)],
    screen: 'floating',
    screenInches: 8,
    cluster: 'analog',
    shifter: 'lever',
    sunroof: 'none',
    roofRails: true,
    ambientLight: true,
    brandColor: '#d71920',
    wiki: { article: 'Toyota Fortuner', prefer: ['Legender', 'AN160', '2021', '2022', '2023', '2024'] },
    features: ['Ladder-frame 4x4', 'Kick-sensor power tailgate', 'Wireless charger', 'JBL 11-speaker audio'],
    paints: [
      { id: 'attitude-black', name: 'Attitude Black', hex: '#0f1012', finish: 'pearl' },
      { id: 'platinum-white', name: 'Platinum White Pearl', hex: '#ecebe5', finish: 'pearl', roof: '#0f1012' },
      { id: 'phantom-brown', name: 'Phantom Brown', hex: '#4a3a30', finish: 'metallic' },
      { id: 'silver-metallic', name: 'Silver Metallic', hex: '#b5b8bb', finish: 'metallic' },
      { id: 'avant-garde-bronze', name: 'Avant Garde Bronze', hex: '#6a5543', finish: 'metallic' },
      { id: 'super-white', name: 'Super White', hex: '#f5f5f2', finish: 'solid' },
    ],
    interiors: [
      { id: 'black-maroon', name: 'Black & Maroon (Legender)', seat: '#1d1d1f', insert: '#5a1a22', bolster: '#151516', stitch: '#a4343f', dash: '#151516', accent: '#5a1a22', carpet: '#151515', material: 'leather' },
      { id: 'chamois', name: 'Chamois', seat: '#b59a74', insert: '#c4ab86', bolster: '#9b815d', stitch: '#6e5a40', dash: '#221e1a', accent: '#b59a74', carpet: '#26221d', material: 'leather' },
    ],
  },
  {
    id: 'tesla-model-y',
    make: 'Tesla',
    model: 'Model Y',
    generation: 'Long Range RWD (2025)',
    body: 'suv',
    lengthMm: 4797,
    widthMm: 1920,
    heightMm: 1624,
    wheelbaseMm: 2890,
    engine: 'Single rear motor',
    transmission: 'Single-speed',
    fuel: 'Electric',
    bootLitres: 822,
    rows: [ROW_FRONT, ROW_BENCH3(2)],
    screen: 'tesla',
    screenInches: 15.4,
    cluster: 'none',
    shifter: 'column',
    sunroof: 'glass-roof',
    roofRails: false,
    ambientLight: true,
    brandColor: '#cc0000',
    wiki: { article: 'Tesla Model Y', prefer: ['2025', 'Juniper'] },
    features: ['All-glass roof', '15.4" centre touchscreen', '8" rear screen', 'Ventilated front seats', '622 km WLTP range'],
    paints: [
      { id: 'pearl-white', name: 'Pearl White', hex: '#f2f2ef', finish: 'pearl' },
      { id: 'diamond-black', name: 'Diamond Black', hex: '#0c0d0f', finish: 'metallic' },
      { id: 'stealth-grey', name: 'Stealth Grey', hex: '#4c4f53', finish: 'metallic' },
      { id: 'quicksilver', name: 'Quicksilver', hex: '#9fa3a7', finish: 'metallic' },
      { id: 'ultra-red', name: 'Ultra Red', hex: '#a50f1d', finish: 'metallic' },
      { id: 'glacier-blue', name: 'Glacier Blue', hex: '#6e8fae', finish: 'metallic' },
    ],
    interiors: [
      { id: 'all-black', name: 'All Black', seat: '#1b1c1e', insert: '#232427', bolster: '#141516', stitch: '#3c3e42', dash: '#131415', accent: '#6c6f73', carpet: '#121212', material: 'vegan-leather' },
      { id: 'black-white', name: 'Black & White', seat: '#ececea', insert: '#f4f4f2', bolster: '#dededa', stitch: '#bdbdb8', dash: '#141516', accent: '#d9d9d5', carpet: '#151515', material: 'vegan-leather' },
    ],
  },
  {
    id: 'hyundai-verna',
    make: 'Hyundai',
    model: 'Verna',
    generation: '6th gen (2023)',
    body: 'sedan',
    lengthMm: 4535,
    widthMm: 1765,
    heightMm: 1475,
    wheelbaseMm: 2670,
    engine: '1.5L Turbo GDi',
    transmission: '7-speed DCT',
    fuel: 'Petrol',
    bootLitres: 528,
    rows: [ROW_FRONT, ROW_BENCH3(2)],
    screen: 'panoramic',
    screenInches: 10.25,
    cluster: 'digital',
    shifter: 'lever',
    sunroof: 'single',
    roofRails: false,
    ambientLight: true,
    brandColor: '#0b3d91',
    wiki: { article: 'Hyundai Verna', prefer: ['2023', '2024', 'Verna', 'BN7'] },
    lightBar: 'both',
    features: ['Dual 10.25" panoramic display', 'Heated & ventilated seats', 'Level 2 ADAS', 'Switchable climate/media panel'],
    paints: [
      { id: 'fiery-red', name: 'Fiery Red', hex: '#a3141c', finish: 'pearl', roof: '#0e0f12' },
      { id: 'tellurian-brown', name: 'Tellurian Brown', hex: '#5e4a3a', finish: 'pearl' },
      { id: 'starry-night', name: 'Starry Night', hex: '#1b2238', finish: 'metallic' },
      { id: 'typhoon-silver', name: 'Typhoon Silver', hex: '#b0b3b6', finish: 'metallic' },
      { id: 'atlas-white', name: 'Atlas White', hex: '#f2f3f3', finish: 'solid' },
      { id: 'abyss-black', name: 'Abyss Black', hex: '#0e0f12', finish: 'pearl' },
    ],
    interiors: [
      { id: 'black-beige', name: 'Black & Beige', seat: '#cdbf9f', insert: '#ddd1b6', bolster: '#b9aa88', stitch: '#8c7e62', dash: '#1b1b1c', accent: '#cdbf9f', carpet: '#24221f', material: 'leatherette' },
      { id: 'black-red', name: 'Black with Red (Turbo)', seat: '#1a1b1d', insert: '#262729', bolster: '#131415', stitch: '#d0182b', dash: '#141516', accent: '#d0182b', carpet: '#141414', material: 'leatherette' },
    ],
  },
  ...MORE_INDIAN_MODELS,
];

export function getModel(id: string): CarModel | undefined {
  return CATALOG.find((m) => m.id === id);
}

/** Every seating version of a model, default first. */
export function seatingOptions(model: CarModel): SeatLayout[] {
  const n = model.rows.reduce((a, r) => a + r.seats.length, 0);
  return [{ id: 'default', label: model.defaultLayoutLabel ?? `${n}-seater`, rows: model.rows }, ...(model.layouts ?? [])];
}

const layoutCache = new Map<string, CarModel>();
/** The model with a given seating version applied (same object for the same pair, so renders stay cheap). */
export function withLayout(model: CarModel, layoutId?: string): CarModel {
  const layout = model.layouts?.find((l) => l.id === layoutId);
  if (!layout) return model;
  const key = `${model.id}:${layout.id}`;
  let m = layoutCache.get(key);
  if (!m) layoutCache.set(key, (m = { ...model, rows: layout.rows }));
  return m;
}

/** The model a registered car really has, including its seating version. */
export function modelForCar(car: { modelId: string; layoutId?: string }): CarModel | undefined {
  const model = getModel(car.modelId);
  return model && withLayout(model, car.layoutId);
}

/** "2+3+2", with "(captain)" when a row has captain seats. */
export function rowsSummary(rows: SeatRow[]) {
  return rows.map((r) => r.seats.length).join('+') + (rows.some((r) => r.kind === 'captain') ? ' (captain)' : '');
}

export function allSeats(model: CarModel): string[] {
  return model.rows.flatMap((r) => r.seats);
}

export function seatLabel(seatId: string): string {
  const row = Number(seatId[0]);
  const pos = seatId.slice(1);
  if (seatId === DRIVER_SEAT) return 'Driver';
  if (seatId === '1L') return 'Front passenger';
  const rowName = row === 2 ? '2nd row' : row === 3 ? '3rd row' : `Row ${row}`;
  const posName = pos === 'L' ? 'left window' : pos === 'R' ? 'right window' : 'middle';
  return `${rowName}, ${posName}`;
}

export const MAKES = Array.from(new Set(CATALOG.map((m) => m.make)));
