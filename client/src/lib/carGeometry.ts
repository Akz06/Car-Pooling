import type { BodyType, CarModel, SeatKind } from '@shared/catalog';

/**
 * Turns manufacturer dimensions into a top-down drawing plan.
 * One unit = 10 mm, nose at y = 0, tail at y = length.
 */

type Profile = {
  /** Half-width (fraction of max) along the length, right side. [t, hw] */
  outline: [number, number][];
  ws0: number; // windshield base (end of hood)
  ws1: number; // windshield top (start of roof)
  rg0: number; // roof end / rear glass start
  rg1: number; // rear glass end
  /** Where the last seat row ends (2-row / 3-row cars). */
  end2: number;
  end3: number;
  /** Where the open cabin ends in cutaway mode. */
  cabinEnd: number;
  tumblehome: number;
};

const SUV_OUTLINE: [number, number][] = [
  [0, 0.72], [0.008, 0.86], [0.03, 0.95], [0.08, 0.99], [0.15, 1], [0.86, 1], [0.94, 0.985], [0.98, 0.94], [0.996, 0.82], [1, 0.7],
];

const PROFILES: Record<BodyType, Profile> = {
  hatchback: {
    outline: [[0, 0.64], [0.01, 0.82], [0.035, 0.93], [0.09, 0.985], [0.18, 1], [0.62, 1], [0.86, 0.99], [0.93, 0.96], [0.975, 0.89], [0.995, 0.74], [1, 0.6]],
    ws0: 0.22, ws1: 0.38, rg0: 0.8, rg1: 0.94, end2: 0.845, end3: 0.95, cabinEnd: 0.93, tumblehome: 0.12,
  },
  sedan: {
    outline: [[0, 0.58], [0.012, 0.8], [0.04, 0.92], [0.1, 0.98], [0.2, 1], [0.62, 1], [0.8, 0.988], [0.9, 0.955], [0.965, 0.89], [0.992, 0.74], [1, 0.56]],
    ws0: 0.27, ws1: 0.41, rg0: 0.7, rg1: 0.83, end2: 0.765, end3: 0.95, cabinEnd: 0.795, tumblehome: 0.13,
  },
  'compact-suv': { outline: SUV_OUTLINE, ws0: 0.24, ws1: 0.36, rg0: 0.86, rg1: 0.955, end2: 0.81, end3: 0.955, cabinEnd: 0.945, tumblehome: 0.11 },
  suv: { outline: SUV_OUTLINE, ws0: 0.25, ws1: 0.37, rg0: 0.875, rg1: 0.96, end2: 0.775, end3: 0.957, cabinEnd: 0.952, tumblehome: 0.1 },
  mpv: {
    outline: [[0, 0.7], [0.01, 0.86], [0.035, 0.95], [0.09, 0.99], [0.16, 1], [0.88, 1], [0.95, 0.985], [0.985, 0.94], [0.997, 0.82], [1, 0.7]],
    ws0: 0.22, ws1: 0.35, rg0: 0.89, rg1: 0.968, end2: 0.8, end3: 0.957, cabinEnd: 0.957, tumblehome: 0.09,
  },
};

export interface SeatGeom {
  id: string;
  row: number;
  kind: SeatKind;
  cx: number;
  top: number;
  w: number;
  d: number;
  /** Side of the car the seat's door is on. */
  side: 'L' | 'R' | 'M';
}

export interface RowGeom {
  index: number;
  kind: SeatKind;
  top: number;
  d: number;
  seats: SeatGeom[];
}

export interface DoorGeom {
  side: 'L' | 'R';
  row: number;
  y0: number;
  y1: number;
}

export interface CarGeometry {
  W: number;
  L: number;
  cx: number;
  profile: Profile;
  band: number;
  hw: (t: number) => number;
  innerHw: (y: number) => number;
  dashTop: number;
  dashBottom: number;
  rows: RowGeom[];
  seats: SeatGeom[];
  doors: DoorGeom[];
  frontAxle: number;
  rearAxle: number;
  tyreW: number;
  tyreL: number;
  consoleW: number;
  bodyPath: string;
  cabinPath: string;
  greenhousePath: string;
  roofPath: string;
  windshieldPath: string;
  /** Lower windshield only — what remains in the roof-off cutaway. */
  windshieldCutPath: string;
  rearGlassPath: string;
}

export function catmullRom(points: [number, number][], closed = true, k = 1): string {
  const n = points.length;
  const p = (i: number) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * k, p1[1] + ((p2[1] - p0[1]) / 6) * k];
    const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * k, p2[1] - ((p3[1] - p1[1]) / 6) * k];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return closed ? d + 'Z' : d;
}

function interp(table: [number, number][], t: number) {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (t <= table[i][0]) {
      const [t0, v0] = table[i - 1];
      const [t1, v1] = table[i];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return table[table.length - 1][1];
}

/**
 * Symmetric closed shape from a half-width function between y0 and y1,
 * with rounded corners (radius r) and gently curved front/rear edges.
 */
function symmetricShape(cx: number, y0: number, y1: number, half: (y: number) => number, samples: number, bulgeFront: number, bulgeRear: number, r = 6) {
  const f = (n: number) => n.toFixed(2);
  const h0 = half(y0);
  const h1 = half(y1);
  const rf = Math.min(r, h0 * 0.5, (y1 - y0) / 3);
  const rr = Math.min(r, h1 * 0.5, (y1 - y0) / 3);
  const side: [number, number][] = [];
  for (let i = 0; i <= samples; i++) {
    const y = y0 + rf + ((y1 - rr - (y0 + rf)) * i) / samples;
    side.push([half(y), y]);
  }
  let d = `M${f(cx - h0 + rf)},${f(y0)} Q${f(cx)},${f(y0 - 2 * bulgeFront)} ${f(cx + h0 - rf)},${f(y0)}`;
  d += ` Q${f(cx + h0)},${f(y0)} ${f(cx + side[0][0])},${f(side[0][1])}`;
  for (const [h, y] of side.slice(1)) d += ` L${f(cx + h)},${f(y)}`;
  d += ` Q${f(cx + h1)},${f(y1)} ${f(cx + h1 - rr)},${f(y1)}`;
  d += ` Q${f(cx)},${f(y1 + 2 * bulgeRear)} ${f(cx - h1 + rr)},${f(y1)}`;
  d += ` Q${f(cx - h1)},${f(y1)} ${f(cx - side[side.length - 1][0])},${f(side[side.length - 1][1])}`;
  for (const [h, y] of side.slice(0, -1).reverse()) d += ` L${f(cx - h)},${f(y)}`;
  d += ` Q${f(cx - h0)},${f(y0)} ${f(cx - h0 + rf)},${f(y0)}Z`;
  return d;
}

export function buildGeometry(model: CarModel): CarGeometry {
  const W = model.widthMm / 10;
  const L = model.lengthMm / 10;
  const cx = W / 2;
  const profile = PROFILES[model.body];
  const hw = (t: number) => interp(profile.outline, t);
  const band = Math.max(8.5, W * 0.052);
  const innerHw = (y: number) => hw(y / L) * cx - band;

  // Body outline — dense sampling along the side keeps the curve true.
  const ts = profile.outline.map(([t]) => t);
  const right = ts.map((t) => [cx + hw(t) * cx, t * L] as [number, number]);
  const left = right.map(([x, y]) => [2 * cx - x, y] as [number, number]).reverse();
  const bodyPath = catmullRom([[cx, -0.8], ...right, [cx, L + 0.6], ...left], true, 0.9);

  const { ws0, ws1, rg0, rg1 } = profile;
  const dashTop = ws0 * L - 2;
  const dashBottom = (ws0 + 0.085) * L;

  // Cabin opening (roof removed).
  const cabinEnd = profile.cabinEnd * L;
  const cabinPath = symmetricShape(cx, ws0 * L, cabinEnd, (y) => innerHw(y), 16, 4.5, 1.5, 10);

  // Greenhouse = all glass at the beltline. Roof sits on top of it, narrower (tumblehome).
  const beltHw = (y: number) => innerHw(y) + 3;
  const roofHw = (y: number) => hw(y / L) * cx - W * profile.tumblehome;
  const greenhousePath = symmetricShape(cx, ws0 * L, rg1 * L, (y) => {
    // taper glass toward the windshield base and rear glass end
    const t = y / L;
    const taper = t < ws1 ? (ws1 - t) / (ws1 - ws0) : t > rg0 ? (t - rg0) / (rg1 - rg0) : 0;
    return beltHw(y) - taper * W * 0.035;
  }, 16, 5, model.body === 'sedan' ? 3 : 1.5, 12);
  const roofPath = symmetricShape(cx, ws1 * L, rg0 * L, roofHw, 12, 3, 2, 12);
  const windshieldPath = symmetricShape(cx, ws0 * L, ws1 * L + 1, (y) => {
    const t = (y / L - ws0) / (ws1 - ws0);
    return beltHw(y) - 2 - t * (beltHw(y) - roofHw(y) - 2);
  }, 6, 5, 3, 5);
  const windshieldCutPath = symmetricShape(cx, ws0 * L, ws0 * L + 0.045 * L, (y) => {
    const t = (y / L - ws0) / (ws1 - ws0);
    return beltHw(y) - 2 - t * (beltHw(y) - roofHw(y) - 2);
  }, 4, 5, -1.5, 3);
  const rearGlassPath = symmetricShape(cx, rg0 * L - 1, rg1 * L, (y) => {
    const t = (y / L - rg0) / (rg1 - rg0);
    return roofHw(y) + t * (beltHw(y) - roofHw(y) - 6);
  }, 6, -2, model.body === 'sedan' ? 3 : 1, 5);

  // Seats.
  const seatStart = (ws0 + 0.085 + 0.045) * L;
  const seatEnd = (model.rows.length >= 3 ? profile.end3 : profile.end2) * L;
  const depthOf = (i: number, kind: SeatKind) => (i === 0 ? 80 : kind === 'captain' ? 78 : i === 1 ? 74 : 62);
  const depths = model.rows.map((r, i) => depthOf(i, r.kind));
  const total = depths.reduce((a, b) => a + b, 0);
  const gap = model.rows.length > 1 ? Math.max(8, (seatEnd - seatStart - total) / (model.rows.length - 1)) : 0;
  const consoleW = Math.min(24, W * 0.13);

  let cursor = seatStart;
  const rows: RowGeom[] = model.rows.map((r, i) => {
    const top = cursor;
    const d = depths[i];
    cursor += d + gap;
    const iw = 2 * innerHw(top + d / 2);
    let seats: SeatGeom[];
    const mk = (id: string, x: number, w: number): SeatGeom => ({
      id, row: i + 1, kind: r.kind, cx: x, top, w, d, side: id.endsWith('L') ? 'L' : id.endsWith('R') ? 'R' : 'M',
    });
    if (i === 0) {
      const w = Math.min(56, (iw - consoleW - 8) / 2);
      const off = consoleW / 2 + 3 + w / 2;
      seats = [mk(r.seats[0], cx - off, w), mk(r.seats[1], cx + off, w)];
    } else if (r.seats.length === 3) {
      const w = Math.min(52, (iw - 6) / 3);
      seats = r.seats.map((id, k) => mk(id, cx + (k - 1) * w, k === 1 ? w * 0.92 : w));
    } else if (r.kind === 'captain') {
      const w = Math.min(54, (iw - 26) / 2);
      const off = w / 2 + 11;
      seats = [mk(r.seats[0], cx - off, w), mk(r.seats[1], cx + off, w)];
    } else {
      const w = Math.min(52, (iw - 14) / 2);
      const off = w / 2 + 3;
      seats = [mk(r.seats[0], cx - off, w), mk(r.seats[1], cx + off, w)];
    }
    return { index: i + 1, kind: r.kind, top, d, seats };
  });

  // Doors: front door to just behind the front seat, rear door to behind 2nd row.
  const doors: DoorGeom[] = [];
  const frontDoorStart = ws0 * L + 6;
  const bPillar = rows[0].top + rows[0].d * 0.78;
  const rearDoorEnd = rows[1] ? rows[1].top + rows[1].d * (model.body === 'sedan' ? 0.62 : 0.8) : bPillar;
  for (const side of ['L', 'R'] as const) {
    doors.push({ side, row: 1, y0: frontDoorStart, y1: bPillar });
    if (rows[1]) doors.push({ side, row: 2, y0: bPillar + 1.5, y1: rearDoorEnd });
  }

  const overhang = L - model.wheelbaseMm / 10;
  const frontAxle = overhang * 0.46;
  const rearAxle = frontAxle + model.wheelbaseMm / 10;

  return {
    W, L, cx, profile, band, hw, innerHw, dashTop, dashBottom, rows,
    seats: rows.flatMap((r) => r.seats), doors, frontAxle, rearAxle,
    tyreW: model.body === 'suv' ? 24 : model.body === 'hatchback' ? 18.5 : 21,
    tyreL: model.body === 'suv' ? 70 : 62,
    consoleW, bodyPath, cabinPath, greenhousePath, roofPath, windshieldPath, windshieldCutPath, rearGlassPath,
  };
}
