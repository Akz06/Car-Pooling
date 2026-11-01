import * as THREE from 'three';
import type { BodyType, CarModel } from '@shared/catalog';
import { buildGeometry, type CarGeometry } from '../lib/carGeometry';

/**
 * Builds a 3D car from manufacturer dimensions. Coordinates are metres,
 * nose at +X, roof at +Y, the car's right side (driver, RHD) at +Z.
 *
 * The lower body is an extruded side profile (with wheel arches and an open
 * cabin), pinched in plan view to the same outline as the 2D seat map. Doors
 * and rear quarters are separate panels so doors can swing open. The glass
 * house is extruded separately with tumblehome; its upward-facing faces
 * become the painted roof.
 */

interface BodyStyle {
  gc: number; // ground clearance (m)
  wheelR: number;
  tyreW: number;
  hoodFront: number; // fraction of height
  belt: number;
  tail: number;
  deck?: number; // sedan boot lid
  tumble: number;
  roofDrop: number; // roof falls toward the rear (m)
}

const STYLES: Record<BodyType, BodyStyle> = {
  hatchback: { gc: 0.165, wheelR: 0.3, tyreW: 0.19, hoodFront: 0.45, belt: 0.58, tail: 0.6, tumble: 0.2, roofDrop: 0.05 },
  sedan: { gc: 0.165, wheelR: 0.31, tyreW: 0.2, hoodFront: 0.44, belt: 0.57, tail: 0.6, deck: 0.62, tumble: 0.22, roofDrop: 0.08 },
  'compact-suv': { gc: 0.19, wheelR: 0.335, tyreW: 0.215, hoodFront: 0.5, belt: 0.6, tail: 0.62, tumble: 0.18, roofDrop: 0.04 },
  suv: { gc: 0.205, wheelR: 0.36, tyreW: 0.235, hoodFront: 0.52, belt: 0.6, tail: 0.63, tumble: 0.15, roofDrop: 0.03 },
  mpv: { gc: 0.18, wheelR: 0.33, tyreW: 0.215, hoodFront: 0.46, belt: 0.56, tail: 0.6, tumble: 0.13, roofDrop: 0.02 },
};

export interface Seat3D {
  id: string;
  row: number;
  kind: CarGeometry['seats'][number]['kind'];
  side: 'L' | 'R' | 'M';
  /** Front edge of the cushion (x), lateral centre (z). */
  x: number;
  z: number;
  w: number;
  d: number;
  cushionY: number;
  backH: number;
}

export interface Door3D {
  side: 'L' | 'R';
  row: number;
  x0: number; // front (hinge) edge
  x1: number; // rear edge
  z: number;
}

export interface CarBuild {
  L: number;
  W: number;
  H: number;
  style: BodyStyle;
  belt: number;
  roofY: number;
  floorY: number;
  frontAxle: number;
  rearAxle: number;
  dashX0: number;
  dashX1: number;
  cabinX0: number;
  cabinX1: number;
  innerHalf: (x: number) => number;
  halfWidth: (x: number) => number;
  body: THREE.BufferGeometry;
  greenhouse: THREE.BufferGeometry;
  panels: { key: string; geometry: THREE.BufferGeometry; door?: Door3D }[];
  /** Black lower cladding following the sills and wheel arches. */
  cladding: THREE.BufferGeometry[];
  /** Painted pillars: [from, to, thickness] in metres. */
  pillars: { a: THREE.Vector3; b: THREE.Vector3; t: number }[];
  beltHalf: (x: number) => number;
  seats: Seat3D[];
  doors: Door3D[];
  g2d: CarGeometry;
}

const sampleSpline = (pts: [number, number][], n: number) =>
  new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(n).map((v) => [v.x, v.y] as [number, number]);

/** y of the bottom edge: flat sill, lifted over the wheel arches. */
function bottomEdge(x: number, base: number, arches: { x: number; y: number; r: number }[]) {
  let y = base;
  for (const a of arches) {
    const dx = x - a.x;
    if (Math.abs(dx) < a.r) y = Math.max(y, a.y + Math.sqrt(a.r * a.r - dx * dx));
  }
  return y;
}

function extrude(shape: THREE.Shape, depth: number, bevel: number, segs = 4) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: segs,
    curveSegments: 24,
  });
  geo.translate(0, 0, -(depth - 2 * bevel) / 2);
  return geo;
}

function shapeFrom(points: [number, number][]) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

export function buildCar(model: CarModel): CarBuild {
  const g2d = buildGeometry(model);
  const st = STYLES[model.body];
  const L = model.lengthMm / 1000;
  const W = model.widthMm / 1000;
  const H = model.heightMm / 1000;
  // Thar / Fortuner-style ladder-frame SUVs sit taller on bigger tyres.
  const tall = model.heightMm > 1800;
  const style: BodyStyle = tall ? { ...st, gc: st.gc + 0.02, wheelR: st.wheelR + 0.025, tyreW: st.tyreW + 0.02 } : st;
  const p = g2d.profile;

  const X = (s: number) => L / 2 - s * L; // fraction from nose → x
  const fromCm = (y: number) => L / 2 - y / 100;
  const zFromCm = (x: number) => (x - g2d.cx) / 100;
  const halfWidth = (x: number) => g2d.hw((L / 2 - x) / L) * (W / 2);
  const band = Math.max(0.085, g2d.band / 100);
  const innerHalf = (x: number) => halfWidth(x) - band;

  const belt = H * style.belt;
  const roofY = H - (model.roofRails ? 0.045 : 0.012);
  const floorY = style.gc + 0.13;
  const hoodFront = H * style.hoodFront;

  const frontAxle = fromCm(g2d.frontAxle);
  const rearAxle = fromCm(g2d.rearAxle);
  const archR = style.wheelR + 0.045;
  const arches = [frontAxle, rearAxle].map((x) => ({ x, y: style.wheelR, r: archR }));

  const dashX0 = X(p.ws0) + 0.02;
  const dashX1 = fromCm(g2d.dashBottom);
  const cabinX0 = X(p.ws0) - 0.04;
  const cabinX1 = X(p.cabinEnd);

  // ---------- lower body side profile (front → top → rear → bottom) ----------
  const deck = style.deck ? H * style.deck : null;
  const top: [number, number][] = [];
  top.push([L / 2, style.gc + 0.13]);
  const isSuv = model.body === 'suv' || model.body === 'compact-suv';
  top.push(...sampleSpline([
    [L / 2 + 0.01, style.gc + 0.3],
    [L / 2 - 0.005, hoodFront - (isSuv ? 0.1 : 0.13)],
    [L / 2 - 0.05, hoodFront - 0.025],
    [L / 2 - 0.17, hoodFront + 0.01],
    [X(p.ws0 * 0.55), hoodFront + (belt - hoodFront) * 0.55],
    [X(p.ws0) + 0.01, belt],
  ], 26));
  // open cabin
  top.push([cabinX0, belt], [cabinX0, floorY], [cabinX1, floorY], [cabinX1, deck ?? belt]);
  if (deck) {
    top.push(...sampleSpline([[cabinX1 - 0.02, deck], [X(p.rg1), deck + 0.015], [-L / 2 + 0.08, deck - 0.01], [-L / 2, deck - 0.09]], 12));
  } else {
    top.push(...sampleSpline([[cabinX1 - 0.01, belt + 0.01], [-L / 2 + 0.02, H * style.tail], [-L / 2, H * style.tail - 0.08]], 8));
  }
  top.push([-L / 2 - 0.004, style.gc + 0.3], [-L / 2 + 0.01, style.gc + 0.12]);
  const bottom: [number, number][] = [];
  for (let i = 0; i <= 120; i++) {
    const x = -L / 2 + 0.03 + ((L - 0.06) * i) / 120;
    bottom.push([x, bottomEdge(x, style.gc, arches)]);
  }
  void bottom;
  const body = loftBody({
    L, gc: style.gc, arches, halfWidth, top,
    cuts: [cabinX0, cabinX1],
    tyreW: style.tyreW,
    shoulder: model.body === 'sedan' || model.body === 'hatchback' ? 0.09 : 0.11,
  });

  // ---------- glass house ----------
  const beltHalf = (x: number) => innerHalf(x) + band * 0.55;
  const rearEnd = deck ? X(p.rg1) : X(p.rg1) - 0.02;
  const ghTop = sampleSpline([
    [X(p.ws0) - 0.02, belt + 0.01],
    [X(p.ws1) + 0.06, roofY - 0.025],
    [X(p.ws1), roofY],
    [(X(p.ws1) + X(p.rg0)) / 2, roofY - style.roofDrop * 0.3],
    [X(p.rg0), roofY - style.roofDrop],
    [X(p.rg0) - 0.05, roofY - style.roofDrop - 0.03],
    [rearEnd, (deck ?? belt) + 0.02],
  ], 40);
  const greenhouseShape = shapeFrom([...ghTop, [X(p.ws0) - 0.02, belt - 0.02] as [number, number]].reverse());
  const ghDepth = 2 * beltHalf(0);
  const greenhouse = extrude(greenhouseShape, ghDepth, 0.035, 3);
  pinch(greenhouse, (x) => beltHalf(x) / beltHalf(0), (y) => 1 - style.tumble * Math.max(0, (y - belt) / (roofY - belt)));
  splitRoofAndGlass(greenhouse);

  // ---------- doors and quarter panels ----------
  const doors: Door3D[] = g2d.doors.map((d) => ({
    side: d.side, row: d.row, x0: fromCm(d.y0), x1: fromCm(d.y1), z: 0,
  }));
  const sideZ = (x: number) => halfWidth(x) - 0.012;
  const panelThickness = 0.05;
  const panels: CarBuild['panels'] = [];
  const panelShape = (xa: number, xb: number) => {
    // xa > xb (front to rear)
    const pts: [number, number][] = [[xa, belt], [xb, belt]];
    for (let i = 0; i <= 40; i++) {
      const x = xb + ((xa - xb) * i) / 40;
      pts.push([x, bottomEdge(x, floorY - 0.06, arches)]);
    }
    return shapeFrom(pts);
  };
  const rearMost = Math.min(...doors.map((d) => d.x1));
  for (const side of ['L', 'R'] as const) {
    const s = side === 'R' ? 1 : -1;
    const sideDoors = doors.filter((d) => d.side === side);
    const segments: { key: string; xa: number; xb: number; door?: Door3D }[] = [
      { key: `${side}-a`, xa: cabinX0 + 0.005, xb: sideDoors[0].x0 + 0.004 },
      ...sideDoors.map((d) => ({ key: `${side}-door${d.row}`, xa: d.x0, xb: d.x1, door: d })),
      { key: `${side}-q`, xa: rearMost - 0.004, xb: cabinX1 - 0.005 },
    ];
    for (const seg of segments) {
      if (seg.xa - seg.xb < 0.02) continue;
      const geo = extrude(panelShape(seg.xa, seg.xb), panelThickness, 0.012, 2);
      const mid = (seg.xa + seg.xb) / 2;
      const z = s * (sideZ(mid) - panelThickness / 2 + 0.006);
      if (seg.door) {
        // Doors are built relative to their hinge so they can rotate about it.
        geo.translate(-seg.door.x0, 0, 0);
        seg.door.z = z;
      } else {
        geo.translate(0, 0, z);
      }
      panels.push({ key: seg.key, geometry: geo, door: seg.door });
    }
  }

  // ---------- cladding (sills + arch flares) ----------
  const cladding: THREE.BufferGeometry[] = [];
  const cladH = isSuv ? 0.1 : 0.05;
  const stripShape = () => {
    const xs: number[] = [];
    for (let i = 0; i <= 120; i++) xs.push(-L / 2 + 0.12 + ((L - 0.24) * i) / 120);
    const lower = xs.map((x) => [x, bottomEdge(x, style.gc - 0.005, arches) - 0.005] as [number, number]);
    const upper = xs.map((x) => [x, bottomEdge(x, style.gc + cladH, arches.map((a) => ({ ...a, r: a.r + cladH }))) - 0.005] as [number, number]).reverse();
    return shapeFrom([...lower, ...upper]);
  };
  for (const s of [-1, 1]) {
    const geo = extrude(stripShape(), 0.03, 0.008, 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + s * (halfWidth(pos.getX(i)) + 0.004));
    geo.computeVertexNormals();
    cladding.push(geo);
  }

  // ---------- pillars ----------
  const roofHalf = (x: number) => beltHalf(x) * (1 - style.tumble);
  const pillars: CarBuild['pillars'] = [];
  for (const s of [-1, 1]) {
    // A-pillar along the windshield edge
    pillars.push({ a: new THREE.Vector3(X(p.ws0) - 0.02, belt + 0.01, s * (beltHalf(X(p.ws0)) - 0.01)), b: new THREE.Vector3(X(p.ws1), roofY - 0.01, s * (roofHalf(X(p.ws1)) + 0.005)), t: 0.045 });
    // C / D pillar
    const cx = deck ? X(p.rg1) + 0.03 : rearEnd + 0.04;
    pillars.push({ a: new THREE.Vector3(cx, (deck ?? belt) + 0.02, s * (beltHalf(cx) - 0.01)), b: new THREE.Vector3(X(p.rg0) + 0.02, roofY - style.roofDrop - 0.01, s * (roofHalf(X(p.rg0)) + 0.005)), t: deck ? 0.07 : 0.08 });
  }

  // ---------- seats ----------
  const seats: Seat3D[] = g2d.seats.map((s) => ({
    id: s.id,
    row: s.row,
    kind: s.kind,
    side: s.side,
    x: fromCm(s.top),
    z: zFromCm(s.cx),
    w: (s.w / 100) * 0.94,
    d: s.d / 100,
    cushionY: floorY + (s.row === 1 ? 0.24 : s.row === 3 ? 0.2 : 0.23),
    backH: s.row === 1 ? 0.62 : s.row === 3 ? 0.5 : 0.56,
  }));

  return {
    L, W, H, style, belt, roofY, floorY, frontAxle, rearAxle, dashX0, dashX1, cabinX0, cabinX1,
    innerHalf, halfWidth, body, greenhouse, panels, cladding, pillars, beltHalf, seats, doors, g2d,
  };
}

/**
 * Smooth lower body: rounded cross-sections lofted along the length, so the
 * clear-coat paint reflects cleanly. `top` is the side-profile top line
 * (front → rear); `cuts` are x positions where the top drops vertically
 * (the open cabin).
 */
function loftBody(o: {
  L: number; gc: number; arches: { x: number; y: number; r: number }[]; halfWidth: (x: number) => number;
  top: [number, number][]; cuts: number[]; shoulder: number; tyreW: number;
}) {
  const { L, gc, arches, halfWidth, shoulder } = o;
  // Top line as a function of x (drop the near-vertical nose/tail faces).
  const line = o.top.filter(([x]) => x < L / 2 - 0.015 && x > -L / 2 + 0.015);
  const topAt = (x: number, side: 1 | -1) => {
    // side: which way to resolve vertical steps (+1 = front side value)
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, y0] = line[i];
      const [x1, y1] = line[i + 1];
      if (x0 === x1) {
        if (Math.abs(x - x0) < 1e-6) return side > 0 ? y0 : y1;
        continue;
      }
      if ((x <= x0 && x >= x1) || (x >= x0 && x <= x1)) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return x > 0 ? line[0][1] : line[line.length - 1][1];
  };
  const xs: { x: number; side: 1 | -1 }[] = [];
  const N = 160;
  for (let i = 0; i <= N; i++) {
    // denser near the ends for round noses
    const u = i / N;
    const t = 0.5 - 0.5 * Math.cos(Math.PI * u);
    xs.push({ x: L / 2 - t * L, side: 1 });
  }
  for (const c of o.cuts) xs.push({ x: c + 0.0005, side: 1 }, { x: c - 0.0005, side: -1 });
  xs.sort((a, b) => b.x - a.x);

  const ring = (x: number, side: 1 | -1) => {
    const endDist = Math.min(L / 2 - x, x + L / 2);
    const round = endDist < 0.09 ? Math.sqrt(Math.max(0, 1 - ((0.09 - endDist) / 0.09) ** 2)) : 1; // rounded nose/tail
    const lift = endDist < 0.32 ? (0.32 - endDist) * 0.42 : 0; // bumpers tuck under
    // Inside the open cabin the floor stays flat; the slab narrows past the wheels instead
    // (the door / quarter panels carry the arch cut-outs on the outside).
    const inCabin = x < Math.max(...o.cuts) && x > Math.min(...o.cuts);
    const overWheel = arches.some((a) => Math.abs(x - a.x) < a.r);
    const bottom = inCabin ? gc + lift : bottomEdge(x, gc + lift, arches);
    const topY = Math.max(bottom + 0.06, topAt(Math.min(L / 2 - 0.016, Math.max(-L / 2 + 0.016, x)), side) - (1 - round) * 0.05);
    const hw = Math.max(0.05, halfWidth(x) * (0.9 + 0.1 * round) - (inCabin && overWheel ? o.tyreW + 0.07 : 0));
    const h = topY - bottom;
    const rT = Math.min(shoulder, h * 0.5, hw * 0.5);
    const rB = Math.min(0.035, h * 0.25);
    const pts: [number, number][] = [];
    const arc = (cz: number, cy: number, r: number, a0: number, a1: number, n: number) => {
      for (let k = 0; k <= n; k++) {
        const a = a0 + ((a1 - a0) * k) / n;
        pts.push([cz + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    };
    pts.push([0, topY + 0.008]);
    arc(hw - rT, topY - rT, rT, Math.PI / 2, 0, 8);
    arc(hw - rB, bottom + rB, rB, 0, -Math.PI / 2, 4);
    pts.push([0, bottom]);
    arc(-(hw - rB), bottom + rB, rB, -Math.PI / 2, -Math.PI, 4);
    arc(-(hw - rT), topY - rT, rT, Math.PI, Math.PI / 2, 8);
    return pts;
  };

  const rings = xs.map(({ x, side }) => ({ x, pts: ring(x, side) }));
  const M = rings[0].pts.length;
  const positions: number[] = [];
  const index: number[] = [];
  for (const r of rings) for (const [z, y] of r.pts) positions.push(r.x, y, z);
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * M + j, b2 = i * M + ((j + 1) % M), c = (i + 1) * M + ((j + 1) % M), d = (i + 1) * M + j;
      index.push(a, d, b2, b2, d, c);
    }
  }
  // end caps
  for (const [ri, flip] of [[0, true], [rings.length - 1, false]] as const) {
    const r = rings[ri];
    const cy = r.pts.reduce((sum, p) => sum + p[1], 0) / M;
    const centre = positions.length / 3;
    positions.push(r.x, cy, 0);
    for (let j = 0; j < M; j++) {
      const a = ri * M + j, b2 = ri * M + ((j + 1) % M);
      if (flip) index.push(centre, a, b2); else index.push(centre, b2, a);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Narrow the extruded slab in plan view (and with height for tumblehome). */
function pinch(geo: THREE.BufferGeometry, byX: (x: number) => number, byY: (y: number) => number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, pos.getZ(i) * byX(x) * byY(y));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/**
 * Material groups for the glass house: 0 = glass, 1 = painted roof.
 * Upward-facing triangles of the extruded outline are roof; everything
 * else (windshield, rear glass, side windows) is glass.
 */
function splitRoofAndGlass(geo: THREE.BufferGeometry) {
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  if (nonIndexed !== geo) geo.copy(nonIndexed);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const tris = pos.count / 3;
  const kinds: number[] = [];
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    kinds.push(n.y > 0.9 ? 1 : 0);
  }
  // Re-order triangles so each material is one contiguous group.
  const order = [...kinds.keys()].sort((i, j) => kinds[i] - kinds[j]);
  const attrs = Object.keys(geo.attributes);
  for (const name of attrs) {
    const attr = geo.attributes[name] as THREE.BufferAttribute;
    const size = attr.itemSize;
    const src = attr.array as Float32Array;
    const dst = new Float32Array(src.length);
    order.forEach((t, k) => dst.set(src.subarray(t * 3 * size, (t + 1) * 3 * size), k * 3 * size));
    geo.setAttribute(name, new THREE.BufferAttribute(dst, size));
  }
  const glassTris = kinds.filter((k) => k === 0).length;
  geo.clearGroups();
  geo.addGroup(0, glassTris * 3, 0);
  geo.addGroup(glassTris * 3, (tris - glassTris) * 3, 1);
}
