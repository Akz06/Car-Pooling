import { useId, useMemo, type ReactNode } from 'react';
import type { CarModel, Interior, Paint } from '@shared/catalog';
import { DRIVER_SEAT } from '@shared/catalog';
import type { Gender } from '@shared/types';
import { buildGeometry, type CarGeometry, type SeatGeom } from '../lib/carGeometry';
import { darken, lighten, luminance, mix } from '../lib/color';

export type SeatStatus = 'driver' | 'available' | 'booked' | 'mine' | 'selected' | 'unavailable' | 'empty';
export interface SeatState {
  status: SeatStatus;
  gender?: Gender;
  name?: string;
}

export interface CarViewProps {
  model: CarModel;
  paint: Paint;
  interior: Interior;
  /** cabin = roof lifted off, exterior = roof on. */
  mode?: 'cabin' | 'exterior';
  seats?: Record<string, SeatState>;
  onSeatClick?: (seatId: string) => void;
  onSeatHover?: (seatId: string | null) => void;
  /** Seat whose door should swing open. */
  openDoorFor?: string | null;
  night?: boolean;
  ambient?: string;
  /** lite = cheaper drawing for list thumbnails. */
  detail?: 'full' | 'lite';
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  style?: React.CSSProperties;
  showLabels?: boolean;
}

const GENDER_COLOR: Record<Gender, string> = { M: '#2f7cf6', F: '#ec4899' };
const GENDER_SHIRT: Record<Gender, string> = { M: '#2563eb', F: '#db2777' };

export function CarView(props: CarViewProps) {
  const {
    model, paint, interior, mode = 'cabin', seats = {}, onSeatClick, onSeatHover, openDoorFor,
    night = false, ambient = '#38bdf8', detail = 'full', orientation = 'vertical', className, style, showLabels = false,
  } = props;
  const g = useMemo(() => buildGeometry(model), [model]);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (s: string) => `${uid}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const full = detail === 'full';

  const mx = 26; // margin for mirrors / tyres
  const my = 16;
  const vbW = g.W + mx * 2;
  const vbH = g.L + my * 2;
  const horizontal = orientation === 'horizontal';
  const viewBox = horizontal ? `0 0 ${vbH} ${vbW}` : `0 0 ${vbW} ${vbH}`;
  // Horizontal: nose points right.
  const rootTransform = horizontal ? `translate(${vbH - my},${mx}) rotate(90)` : `translate(${mx},${my})`;
  const counter = horizontal ? -90 : 0;

  const roof = paint.roof ?? paint.hex;
  const openSeat = openDoorFor ? g.seats.find((s) => s.id === openDoorFor) : undefined;
  const openDoor = openSeat && openSeat.side !== 'M'
    ? { side: openSeat.side, row: Math.min(openSeat.row, 2) }
    : openSeat ? { side: 'L' as const, row: Math.min(openSeat.row, 2) } : undefined;

  return (
    <svg
      viewBox={viewBox}
      className={className}
      style={style}
      role="img"
      aria-label={`${model.make} ${model.model} in ${paint.name}, ${interior.name} interior`}
    >
      <Defs id={id} paint={paint} interior={interior} roof={roof} night={night} full={full} ambient={ambient} />
      <g transform={rootTransform}>
        {/* ground shadow */}
        <rect x={-6} y={-4} width={g.W + 12} height={g.L + 8} rx={g.W * 0.32} fill="#000" opacity={night ? 0.55 : 0.38} filter={full ? url('shadow') : undefined} />
        {night && <Lights g={g} url={url} />}
        <Tyres g={g} url={url} />
        <path d={g.bodyPath} fill={url('paint')} stroke={darken(paint.hex, 0.55)} strokeWidth={0.6} />
        {full && paint.finish !== 'solid' && paint.finish !== 'matte' && (
          <path d={g.bodyPath} fill={url('flake')} opacity={paint.finish === 'pearl' ? 0.35 : 0.5} style={{ mixBlendMode: 'overlay' }} />
        )}
        <path d={g.bodyPath} fill={url('sheen')} />
        <BodyDetails g={g} model={model} paint={paint} url={url} full={full} />
        <Cabin
          g={g} model={model} interior={interior} seats={seats} url={url} full={full} night={night} ambient={ambient}
          onSeatClick={onSeatClick} onSeatHover={onSeatHover} counter={counter} showLabels={showLabels}
        />
        <Doors g={g} paint={paint} interior={interior} openDoor={openDoor} url={url} />
        <Mirrors g={g} paint={paint} url={url} />
        {/* windshield stays in cutaway mode, like a real cutaway model */}
        <path d={mode === 'cabin' ? g.windshieldCutPath : g.windshieldPath} fill={url('glass')} opacity={mode === 'cabin' ? 0.35 : 0.95} stroke={darken(paint.hex, 0.4)} strokeWidth={0.6} pointerEvents="none" style={{ transition: 'opacity .6s' }} />
        <path d={mode === 'cabin' ? g.windshieldCutPath : g.windshieldPath} fill={url('reflect')} opacity={mode === 'cabin' ? 0.5 : 0.85} pointerEvents="none" />
        <Greenhouse g={g} model={model} paint={paint} roof={roof} url={url} visible={mode === 'exterior'} full={full} />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function Defs({ id, paint, interior, roof, night, full, ambient }: { id: (s: string) => string; paint: Paint; interior: Interior; roof: string; night: boolean; full: boolean; ambient: string }) {
  const base = paint.hex;
  const matte = paint.finish === 'matte';
  const k = matte ? 0.55 : 1;
  const lum = luminance(base);
  const hi = lighten(base, (lum > 0.7 ? 0.5 : 0.28) * k);
  return (
    <defs>
      <linearGradient id={id('paint')} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor={darken(base, 0.5 * k)} />
        <stop offset="0.07" stopColor={darken(base, 0.18 * k)} />
        <stop offset="0.22" stopColor={base} />
        <stop offset="0.42" stopColor={hi} />
        <stop offset="0.5" stopColor={lighten(base, 0.36 * k)} />
        <stop offset="0.58" stopColor={hi} />
        <stop offset="0.78" stopColor={base} />
        <stop offset="0.93" stopColor={darken(base, 0.18 * k)} />
        <stop offset="1" stopColor={darken(base, 0.5 * k)} />
      </linearGradient>
      <linearGradient id={id('roof')} x1="0" x2="1">
        <stop offset="0" stopColor={darken(roof, 0.35)} />
        <stop offset="0.3" stopColor={lighten(roof, 0.12 * k)} />
        <stop offset="0.5" stopColor={lighten(roof, 0.26 * k)} />
        <stop offset="0.7" stopColor={lighten(roof, 0.12 * k)} />
        <stop offset="1" stopColor={darken(roof, 0.35)} />
      </linearGradient>
      <linearGradient id={id('sheen')} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity={matte ? 0.03 : 0.16} />
        <stop offset="0.25" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.7" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.18" />
      </linearGradient>
      <linearGradient id={id('glass')} x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor={night ? '#05070c' : '#1d2a3a'} />
        <stop offset="0.5" stopColor={night ? '#0a0f18' : '#2c3d52'} />
        <stop offset="1" stopColor={night ? '#040509' : '#121a25'} />
      </linearGradient>
      <linearGradient id={id('reflect')} x1="0" x2="1" y1="0" y2="0.6">
        <stop offset="0.15" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.3" stopColor="#fff" stopOpacity={night ? 0.06 : 0.28} />
        <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.62" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.68" stopColor="#fff" stopOpacity={night ? 0.04 : 0.16} />
        <stop offset="0.74" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={id('tyre')} cx="0.5" cy="0.5" r="0.7">
        <stop offset="0.5" stopColor="#2a2a2c" />
        <stop offset="1" stopColor="#0b0b0c" />
      </radialGradient>
      <linearGradient id={id('seat')} x1="0" x2="1">
        <stop offset="0" stopColor={darken(interior.seat, 0.25)} />
        <stop offset="0.5" stopColor={lighten(interior.seat, 0.08)} />
        <stop offset="1" stopColor={darken(interior.seat, 0.25)} />
      </linearGradient>
      <linearGradient id={id('insert')} x1="0" x2="1">
        <stop offset="0" stopColor={darken(interior.insert, 0.12)} />
        <stop offset="0.5" stopColor={lighten(interior.insert, 0.1)} />
        <stop offset="1" stopColor={darken(interior.insert, 0.12)} />
      </linearGradient>
      <linearGradient id={id('back')} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.32" />
        <stop offset="0.35" stopColor="#000" stopOpacity="0.05" />
        <stop offset="1" stopColor="#000" stopOpacity="0.18" />
      </linearGradient>
      <linearGradient id={id('dash')} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor={darken(interior.dash, 0.4)} />
        <stop offset="0.7" stopColor={lighten(interior.dash, 0.08)} />
        <stop offset="1" stopColor={darken(interior.dash, 0.2)} />
      </linearGradient>
      <linearGradient id={id('screen')} x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor={night ? '#0b1f3a' : '#0d1726'} />
        <stop offset="1" stopColor={night ? '#031021' : '#05090f'} />
      </linearGradient>
      <linearGradient id={id('chrome')} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#f5f7fa" />
        <stop offset="0.5" stopColor="#8b939c" />
        <stop offset="1" stopColor="#dfe3e8" />
      </linearGradient>
      <radialGradient id={id('headGlow')}>
        <stop offset="0" stopColor="#fffbe6" stopOpacity="0.95" />
        <stop offset="0.4" stopColor="#fff3c4" stopOpacity="0.35" />
        <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id('tailGlow')}>
        <stop offset="0" stopColor="#ff2a2a" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ff0000" stopOpacity="0" />
      </radialGradient>
      <pattern id={id('carpet')} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
        <rect width="2.4" height="2.4" fill={interior.carpet} />
        <circle cx="0.6" cy="0.6" r="0.45" fill={lighten(interior.carpet, 0.07)} />
        <circle cx="1.8" cy="1.8" r="0.45" fill={darken(interior.carpet, 0.2)} />
      </pattern>
      <pattern id={id('perf')} width="2.2" height="2.2" patternUnits="userSpaceOnUse">
        <circle cx="1.1" cy="1.1" r="0.32" fill={darken(interior.insert, 0.45)} opacity="0.7" />
      </pattern>
      <pattern id={id('grille')} width="1.6" height="1.6" patternUnits="userSpaceOnUse">
        <circle cx="0.8" cy="0.8" r="0.42" fill="#000" opacity="0.6" />
      </pattern>
      {full && (
        <>
          <filter id={id('shadow')} x="-20%" y="-10%" width="140%" height="120%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id={id('soft')} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          <filter id={id('glow')} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={id('flakeF')}>
            <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="1" seed="7" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -0.55" />
          </filter>
          <pattern id={id('flake')} width="60" height="60" patternUnits="userSpaceOnUse">
            <rect width="60" height="60" filter={`url(#${id('flakeF')})`} />
          </pattern>
        </>
      )}
      {!full && <pattern id={id('flake')} width="1" height="1"><rect width="1" height="1" fill="none" /></pattern>}
      <linearGradient id={id('ambient')} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor={ambient} stopOpacity="0.95" />
        <stop offset="1" stopColor={ambient} stopOpacity="0.5" />
      </linearGradient>
    </defs>
  );
}

type Url = (s: string) => string;

function Tyres({ g, url }: { g: CarGeometry; url: Url }) {
  const out = 2.2; // tyres peek out under the arches
  const xs = [-out, g.W - g.tyreW + out];
  return (
    <g>
      {[g.frontAxle, g.rearAxle].flatMap((ay) =>
        xs.map((x) => (
          <g key={`${ay}-${x}`}>
            <rect x={x} y={ay - g.tyreL / 2} width={g.tyreW} height={g.tyreL} rx={5} fill={url('tyre')} />
            {/* tread blocks */}
            {Array.from({ length: 9 }, (_, i) => (
              <rect key={i} x={x + (x < 0 ? 0.4 : g.tyreW - 3.4)} y={ay - g.tyreL / 2 + 4 + i * ((g.tyreL - 8) / 9)} width={3} height={3.4} rx={0.6} fill="#3a3a3d" />
            ))}
          </g>
        )),
      )}
    </g>
  );
}

function Lights({ g, url }: { g: CarGeometry; url: Url }) {
  return (
    <g pointerEvents="none">
      {[g.W * 0.2, g.W * 0.8].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={-4} rx={g.W * 0.3} ry={20} fill={url('headGlow')} />
          <ellipse cx={x} cy={g.L + 2} rx={g.W * 0.18} ry={9} fill={url('tailGlow')} />
        </g>
      ))}
    </g>
  );
}

function BodyDetails({ g, model, paint, url, full }: { g: CarGeometry; model: CarModel; paint: Paint; url: Url; full: boolean }) {
  const { W, L, cx, profile } = g;
  const ws0 = profile.ws0 * L;
  const dark = darken(paint.hex, 0.45);
  const light = lighten(paint.hex, 0.4);
  const hwAt = (y: number) => g.hw(y / L) * cx;
  const isSuv = model.body === 'suv' || model.body === 'compact-suv';
  const lampY = 2.2;
  const lampHw = hwAt(6);
  const frontBar = model.lightBar === 'front' || model.lightBar === 'both';
  const rearBar = model.lightBar === 'rear' || model.lightBar === 'both';
  const sedanDeck = model.body === 'sedan' ? profile.rg1 * L : null;
  return (
    <g pointerEvents="none">
      {/* front bumper lip & grille edge */}
      <path d={`M${cx - lampHw * 0.82},${1.4} Q${cx},${-1.6} ${cx + lampHw * 0.82},${1.4}`} fill="none" stroke="#0c0c0d" strokeWidth={1.6} opacity={0.75} />
      {/* headlamps */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <path
            d={`M${cx + s * lampHw * 0.42},${lampY + 1.2} Q${cx + s * lampHw * 0.8},${lampY - 0.6} ${cx + s * (lampHw + 1.5)},${lampY + 6.5} L${cx + s * (lampHw - 1)},${lampY + 9} Q${cx + s * lampHw * 0.75},${lampY + 4.6} ${cx + s * lampHw * 0.44},${lampY + 4.2}Z`}
            fill="#dfe8f0" stroke="#59626b" strokeWidth={0.4}
          />
          <path d={`M${cx + s * lampHw * 0.48},${lampY + 2.4} Q${cx + s * lampHw * 0.8},${lampY + 1} ${cx + s * (lampHw - 0.4)},${lampY + 6.6}`} fill="none" stroke="#fff" strokeWidth={0.9} filter={full ? url('glow') : undefined} />
          {/* tail lamps */}
          <path
            d={`M${cx + s * hwAt(L - 4) * 0.5},${L - 1.3} Q${cx + s * hwAt(L - 4) * 0.95},${L - 1.6} ${cx + s * (hwAt(L - 8) + 0.6)},${L - 9} L${cx + s * (hwAt(L - 8) - 1.6)},${L - 8.5} Q${cx + s * hwAt(L - 4) * 0.82},${L - 4.4} ${cx + s * hwAt(L - 4) * 0.5},${L - 3.6}Z`}
            fill="#b3101b" stroke="#4d0509" strokeWidth={0.4}
          />
        </g>
      ))}
      {frontBar && <path d={`M${cx - lampHw * 0.44},${lampY + 2.8} Q${cx},${lampY + 0.6} ${cx + lampHw * 0.44},${lampY + 2.8}`} fill="none" stroke="#f4f8ff" strokeWidth={0.8} filter={full ? url('glow') : undefined} />}
      {rearBar && <path d={`M${cx - hwAt(L - 4) * 0.5},${L - 2.4} Q${cx},${L - 0.6} ${cx + hwAt(L - 4) * 0.5},${L - 2.4}`} fill="none" stroke="#e01622" strokeWidth={1.1} filter={full ? url('glow') : undefined} />}
      {/* hood creases */}
      {[-1, 1].map((s) => (
        <path key={`c${s}`} d={`M${cx + s * W * 0.16},${10} Q${cx + s * W * 0.2},${ws0 * 0.55} ${cx + s * W * 0.22},${ws0 - 3}`} fill="none" stroke={light} strokeWidth={0.7} opacity={0.5} />
      ))}
      {[-1, 1].map((s) => (
        <path key={`d${s}`} d={`M${cx + s * W * 0.165},${10.6} Q${cx + s * W * 0.205},${ws0 * 0.55} ${cx + s * W * 0.225},${ws0 - 3}`} fill="none" stroke={dark} strokeWidth={0.5} opacity={0.35} />
      ))}
      {/* hood shut line */}
      <path d={`M${cx - hwAt(ws0) + 6},${ws0 - 1} Q${cx},${ws0 - 6} ${cx + hwAt(ws0) - 6},${ws0 - 1}`} fill="none" stroke={dark} strokeWidth={0.5} opacity={0.6} />
      {/* brand badge */}
      <ellipse cx={cx} cy={6.5} rx={4} ry={2.2} fill={url('chrome')} stroke={darken(model.brandColor, 0.3)} strokeWidth={0.4} />
      {/* sedan boot lid */}
      {sedanDeck && (
        <path d={`M${cx - hwAt(sedanDeck) + 9},${sedanDeck + 2} Q${cx},${sedanDeck - 1} ${cx + hwAt(sedanDeck) - 9},${sedanDeck + 2} L${cx + hwAt(L - 6) - 8},${L - 5} Q${cx},${L - 2} ${cx - hwAt(L - 6) + 8},${L - 5}Z`} fill="none" stroke={dark} strokeWidth={0.5} opacity={0.6} />
      )}
      {/* SUV black cladding over the arches */}
      {isSuv && [g.frontAxle, g.rearAxle].flatMap((ay) => [-1, 1].map((s) => (
        <path key={`${ay}${s}`} d={`M${cx + s * (hwAt(ay) - 0.3)},${ay - g.tyreL / 2 - 4} Q${cx + s * (hwAt(ay) + 1.6)},${ay} ${cx + s * (hwAt(ay) - 0.3)},${ay + g.tyreL / 2 + 4}`} fill="none" stroke="#18181a" strokeWidth={2.4} strokeLinecap="round" />
      )))}
    </g>
  );
}

function Mirrors({ g, paint, url }: { g: CarGeometry; paint: Paint; url: Url }) {
  const y = g.profile.ws0 * g.L + 9;
  const hw = g.hw(y / g.L) * g.cx;
  return (
    <g pointerEvents="none">
      {[-1, 1].map((s) => {
        const x0 = g.cx + s * (hw - 3);
        const x1 = g.cx + s * (hw + 11);
        return (
          <g key={s}>
            <path d={`M${x0},${y - 3} L${x1},${y - 1.5} Q${x1 + s * 1.5},${y + 2} ${x1},${y + 5} L${x0},${y + 4}Z`} fill={url('paint')} stroke={darken(paint.hex, 0.5)} strokeWidth={0.5} />
            <path d={`M${x0 + s * 6},${y - 2.2} L${x1 - s * 0.5},${y - 1.2}`} stroke="#f59e0b" strokeWidth={0.9} />
          </g>
        );
      })}
    </g>
  );
}

function Greenhouse({ g, model, paint, roof, url, visible, full }: { g: CarGeometry; model: CarModel; paint: Paint; roof: string; url: Url; visible: boolean; full: boolean }) {
  const { L, cx, profile } = g;
  const ws1 = profile.ws1 * L;
  const rg0 = profile.rg0 * L;
  const roofHw = (y: number) => g.hw(y / L) * cx - g.W * profile.tumblehome;
  const sunroof = model.sunroof;
  const glassRoof = sunroof === 'glass-roof';
  return (
    <g
      pointerEvents="none"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate(0px,0px) scale(1)' : 'translate(0px,-30px) scale(1.04)',
        transformOrigin: `${cx}px ${L / 2}px`,
        transition: 'opacity .7s ease, transform .9s cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <path d={g.greenhousePath} fill={url('glass')} opacity={0.93} />
      <path d={g.greenhousePath} fill={url('reflect')} />
      <path d={g.rearGlassPath} fill={url('glass')} stroke={darken(roof, 0.4)} strokeWidth={0.5} />
      {glassRoof ? (
        <>
          <path d={g.roofPath} fill={url('glass')} stroke={darken(paint.hex, 0.4)} strokeWidth={1.4} />
          <path d={g.roofPath} fill={url('reflect')} />
          <line x1={cx - roofHw(ws1 + 70)} x2={cx + roofHw(ws1 + 70)} y1={ws1 + 70} y2={ws1 + 70} stroke="#0b0d10" strokeWidth={2.4} />
        </>
      ) : (
        <>
          <path d={g.roofPath} fill={url('roof')} stroke={darken(roof, 0.45)} strokeWidth={0.6} />
          {full && <path d={g.roofPath} fill={url('flake')} opacity={0.35} style={{ mixBlendMode: 'overlay' }} />}
          {sunroof !== 'none' && (
            <g>
              <rect
                x={cx - roofHw(ws1 + 20) + 9}
                y={ws1 + 8}
                width={2 * (roofHw(ws1 + 20) - 9)}
                height={sunroof === 'panoramic' ? (rg0 - ws1) * 0.72 : 46}
                rx={5}
                fill={url('glass')}
                stroke="#0a0b0d"
                strokeWidth={1.4}
              />
              {sunroof === 'panoramic' && (
                <line x1={cx - roofHw(ws1 + 20) + 9} x2={cx + roofHw(ws1 + 20) - 9} y1={ws1 + 8 + (rg0 - ws1) * 0.36} y2={ws1 + 8 + (rg0 - ws1) * 0.36} stroke="#0a0b0d" strokeWidth={1.6} />
              )}
              <rect x={cx - roofHw(ws1 + 20) + 11} y={ws1 + 10} width={2 * (roofHw(ws1 + 20) - 11)} height={14} rx={3} fill="#fff" opacity={0.08} />
            </g>
          )}
          {/* shark-fin antenna */}
          <path d={`M${cx},${rg0 - 22} q-2.4,8 0,13 q2.4,-5 0,-13`} fill={darken(roof, 0.3)} stroke="#000" strokeWidth={0.3} />
        </>
      )}
      {model.roofRails && [-1, 1].map((s) => (
        <g key={s}>
          <path d={`M${cx + s * (roofHw(ws1 + 12) - 3)},${ws1 + 12} L${cx + s * (roofHw(rg0 - 8) - 3)},${rg0 - 8}`} stroke="#121214" strokeWidth={4} strokeLinecap="round" />
          <path d={`M${cx + s * (roofHw(ws1 + 12) - 3)},${ws1 + 12} L${cx + s * (roofHw(rg0 - 8) - 3)},${rg0 - 8}`} stroke={url('chrome')} strokeWidth={1.4} strokeLinecap="round" opacity={0.85} />
        </g>
      ))}
      {/* wipers */}
      {[-1, 1].map((s) => (
        <path key={s} d={`M${cx + s * 4 - 22},${profile.ws0 * L + 6} L${cx + s * 4 + 18},${profile.ws0 * L + 2.5}`} stroke="#0b0b0c" strokeWidth={1.1} strokeLinecap="round" />
      ))}
    </g>
  );
}

function Doors({ g, paint, interior, openDoor, url }: { g: CarGeometry; paint: Paint; interior: Interior; openDoor?: { side: 'L' | 'R'; row: number }; url: Url }) {
  return (
    <g>
      {g.doors.map((d) => {
        const s = d.side === 'L' ? -1 : 1;
        const yMid = (d.y0 + d.y1) / 2;
        const outer = g.hw(yMid / g.L) * g.cx;
        const xOut = g.cx + s * (outer + 0.3);
        const xIn = g.cx + s * (g.innerHw(yMid) + 0.5);
        const isOpen = openDoor && openDoor.side === d.side && openDoor.row === d.row;
        const x = Math.min(xOut, xIn);
        const w = Math.abs(xOut - xIn);
        return (
          <g key={`${d.side}${d.row}`}>
            {/* opening revealed beneath the door */}
            <rect x={x} y={d.y0} width={w} height={d.y1 - d.y0} fill="#0d0d0e" opacity={isOpen ? 1 : 0} style={{ transition: 'opacity .3s' }} />
            <g
              style={{
                transform: `rotate(${isOpen ? -s * 58 : 0}deg)`,
                transformOrigin: `${xOut}px ${d.y0}px`,
                transition: 'transform .6s cubic-bezier(.3,1.25,.4,1)',
              }}
            >
              <rect x={x} y={d.y0} width={w} height={d.y1 - d.y0} fill={url('paint')} opacity={isOpen ? 1 : 0} style={{ transition: 'opacity .2s' }} />
              {/* inner door card visible when swung open */}
              <rect x={d.side === 'L' ? xIn - 3.5 : xIn} y={d.y0 + 2} width={3.5} height={d.y1 - d.y0 - 4} fill={interior.dash} opacity={isOpen ? 1 : 0} style={{ transition: 'opacity .2s' }} />
              {/* shut lines + handle */}
              <line x1={xOut} x2={xIn} y1={d.y0} y2={d.y0} stroke={darken(paint.hex, 0.6)} strokeWidth={0.6} />
              <line x1={xOut} x2={xIn} y1={d.y1} y2={d.y1} stroke={darken(paint.hex, 0.6)} strokeWidth={0.6} />
              <rect x={xOut - s * 2.2 - 0.9} y={d.y1 - 20} width={1.8} height={9} rx={0.9} fill={url('chrome')} opacity={0.9} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------ cabin ------------------------------ */

interface CabinProps {
  g: CarGeometry;
  model: CarModel;
  interior: Interior;
  seats: Record<string, SeatState>;
  url: Url;
  full: boolean;
  night: boolean;
  ambient: string;
  counter: number;
  showLabels: boolean;
  onSeatClick?: (id: string) => void;
  onSeatHover?: (id: string | null) => void;
}

function Cabin(p: CabinProps) {
  const { g, model, interior, url, full, night, ambient } = p;
  const { cx, L, profile } = g;
  const front = g.rows[0];
  const lastRow = g.rows[g.rows.length - 1];
  const cabinEnd = profile.cabinEnd * L;
  const driver = front.seats.find((s) => s.id === DRIVER_SEAT)!;
  const showAmbient = night && model.ambientLight;
  const consoleEnd = front.top + front.d * 0.95;

  return (
    <g>
      <path d={g.cabinPath} fill={url('carpet')} stroke="#050505" strokeWidth={0.8} />
      {/* door cards along each side */}
      {[-1, 1].map((s) => (
        <DoorCards key={s} g={g} side={s} interior={interior} url={url} full={full} ambient={showAmbient ? ambient : null} />
      ))}
      {/* floor mats */}
      {g.seats.filter((s) => s.row === 1 || s.side !== 'M').map((s) => (
        <rect key={s.id} x={s.cx - s.w * 0.4} y={s.top - (s.row === 1 ? 30 : 20)} width={s.w * 0.8} height={s.row === 1 ? 30 : 20} rx={3} fill={darken(interior.carpet, 0.12)} stroke={lighten(interior.carpet, 0.14)} strokeWidth={0.4} opacity={0.9} />
      ))}
      {/* boot area behind last row */}
      {cabinEnd - (lastRow.top + lastRow.d) > 14 && (
        <g>
          <rect x={cx - g.innerHw(cabinEnd - 10) + 4} y={lastRow.top + lastRow.d + 4} width={2 * g.innerHw(cabinEnd - 10) - 8} height={cabinEnd - (lastRow.top + lastRow.d) - 7} rx={4}
            fill={model.body === 'sedan' ? darken(interior.dash, 0.1) : url('carpet')} stroke={lighten(interior.carpet, 0.12)} strokeWidth={0.6} />
          {model.body !== 'sedan' && (
            <rect x={cx - g.innerHw(cabinEnd - 10) + 8} y={lastRow.top + lastRow.d + 8} width={2 * g.innerHw(cabinEnd - 10) - 16} height={Math.max(4, cabinEnd - (lastRow.top + lastRow.d) - 15)} rx={3} fill="none" stroke={lighten(interior.carpet, 0.08)} strokeWidth={0.5} strokeDasharray="2 1.5" />
          )}
          {model.body === 'sedan' && full && [-1, 1].map((s) => (
            <circle key={s} cx={cx + s * g.W * 0.25} cy={(lastRow.top + lastRow.d + cabinEnd) / 2} r={5} fill={url('grille')} stroke="#000" strokeWidth={0.4} />
          ))}
          {model.body !== 'sedan' && [-1, 1].map((s) => (
            <circle key={s} cx={cx + s * (g.innerHw(cabinEnd) - 9)} cy={cabinEnd - 8} r={1.2} fill={url('chrome')} />
          ))}
        </g>
      )}
      <Dashboard g={g} model={model} interior={interior} url={url} full={full} night={night} ambient={showAmbient ? ambient : null} driver={driver} />
      {/* centre console */}
      <Console g={g} model={model} interior={interior} url={url} y0={g.dashBottom - 4} y1={consoleEnd} full={full} />
      {/* steering wheel (RHD) */}
      <SteeringWheel cx={driver.cx} y={front.top - 13} model={model} url={url} />
      {/* rear AC vents on console back / roof AC for MPVs */}
      {g.rows.map((row) => (
        <SeatRowView key={row.index} row={row} {...p} />
      ))}
    </g>
  );
}

function DoorCards({ g, side, interior, url, full, ambient }: { g: CarGeometry; side: number; interior: Interior; url: Url; full: boolean; ambient: string | null }) {
  const { cx } = g;
  return (
    <g>
      {g.doors.filter((d) => (d.side === 'L' ? -1 : 1) === side).map((d) => {
        const yMid = (d.y0 + d.y1) / 2;
        const xi = cx + side * g.innerHw(yMid);
        const t = 4.2;
        const x = side < 0 ? xi : xi - t;
        const armY = d.y0 + (d.y1 - d.y0) * 0.45;
        return (
          <g key={d.row}>
            <rect x={x} y={d.y0 + 3} width={t} height={d.y1 - d.y0 - 6} rx={1.5} fill={interior.dash} />
            <rect x={side < 0 ? xi + 0.4 : xi - t + 1.4} y={d.y0 + 6} width={2.2} height={d.y1 - d.y0 - 12} rx={1} fill={interior.accent} opacity={0.8} />
            {/* armrest with window switches */}
            <rect x={side < 0 ? xi + 1 : xi - t - 3} y={armY} width={t + 2} height={(d.y1 - d.y0) * 0.36} rx={2} fill={url('seat')} stroke={darken(interior.seat, 0.4)} strokeWidth={0.3} />
            {full && [0, 1].map((k) => (
              <rect key={k} x={side < 0 ? xi + 2 : xi - t - 1.6} y={armY + 3 + k * 4} width={2.6} height={2.6} rx={0.6} fill="#111" stroke="#555" strokeWidth={0.2} />
            ))}
            {/* speaker */}
            {full && <circle cx={side < 0 ? xi + 2.5 : xi - 2.5} cy={d.y0 + 9} r={3.4} fill={url('grille')} stroke="#000" strokeWidth={0.4} />}
            {/* door pull */}
            <rect x={side < 0 ? xi + 0.6 : xi - 1.8} y={d.y0 + 16} width={1.2} height={6} rx={0.6} fill={url('chrome')} />
            {ambient && (
              <line x1={side < 0 ? xi + 3.9 : xi - 3.9} x2={side < 0 ? xi + 3.9 : xi - 3.9} y1={d.y0 + 5} y2={d.y1 - 5} stroke={ambient} strokeWidth={0.9} filter={full ? url('glow') : undefined} />
            )}
          </g>
        );
      })}
    </g>
  );
}

function Dashboard({ g, model, interior, url, full, night, ambient, driver }: { g: CarGeometry; model: CarModel; interior: Interior; url: Url; full: boolean; night: boolean; ambient: string | null; driver: SeatGeom }) {
  const { cx } = g;
  const y0 = g.dashTop;
  const y1 = g.dashBottom;
  const hw0 = g.innerHw(y0 + 4) + 1;
  const hw1 = g.innerHw(y1);
  const d = `M${cx - hw0},${y0 + 6} Q${cx},${y0 - 6} ${cx + hw0},${y0 + 6} L${cx + hw1},${y1 - 2} Q${cx + hw1 * 0.55},${y1 + 3} ${cx + g.consoleW / 2 + 2},${y1 + 1} L${cx - g.consoleW / 2 - 2},${y1 + 1} Q${cx - hw1 * 0.55},${y1 + 3} ${cx - hw1},${y1 - 2}Z`;
  const screenGlow = night ? 0.95 : 0.85;
  const vent = (x: number, y: number, w: number, h: number, key: string) => (
    <g key={key}>
      <rect x={x - w / 2} y={y} width={w} height={h} rx={1.2} fill="#0b0b0c" stroke={url('chrome')} strokeWidth={0.35} />
      {full && Array.from({ length: 3 }, (_, i) => (
        <line key={i} x1={x - w / 2 + 1} x2={x + w / 2 - 1} y1={y + ((i + 1) * h) / 4} y2={y + ((i + 1) * h) / 4} stroke="#3c3c40" strokeWidth={0.35} />
      ))}
    </g>
  );

  const screenY = y1 - 14;
  let screen: ReactNode;
  const screenUI = (x: number, y: number, w: number, h: number) => (
    <g opacity={screenGlow}>
      <rect x={x} y={y} width={w} height={h} rx={1.4} fill={url('screen')} stroke="#2b2f36" strokeWidth={0.5} />
      {full && (
        <>
          <path d={`M${x + w * 0.1},${y + h * 0.8} C${x + w * 0.3},${y + h * 0.2} ${x + w * 0.55},${y + h * 0.9} ${x + w * 0.88},${y + h * 0.25}`} fill="none" stroke="#22c55e" strokeWidth={0.7} />
          <circle cx={x + w * 0.88} cy={y + h * 0.25} r={0.9} fill="#22c55e" />
          <rect x={x + 1} y={y + 1} width={w * 0.22} height={h - 2} rx={0.8} fill="#1e293b" opacity={0.8} />
        </>
      )}
    </g>
  );
  switch (model.screen) {
    case 'floating':
      screen = (
        <g>
          <rect x={cx - 17} y={screenY - 3} width={34} height={7} rx={1.5} fill="#000" opacity={0.45} filter={full ? url('soft') : undefined} />
          {screenUI(cx - 16, screenY - 8, 32, 9)}
        </g>
      );
      break;
    case 'integrated':
      screen = screenUI(cx - 13, screenY - 3, 26, 8);
      break;
    case 'panoramic':
      // one glass panel spanning cluster + infotainment
      screen = (
        <g>
          {screenUI(cx - 12, screenY - 5, driver.cx - cx + 30, 8.4)}
          <line x1={(cx + driver.cx) / 2 + 2} x2={(cx + driver.cx) / 2 + 2} y1={screenY - 5} y2={screenY + 3.4} stroke="#000" strokeWidth={0.4} />
        </g>
      );
      break;
    case 'tesla':
      screen = (
        <g>
          <rect x={cx - 22} y={screenY + 2} width={44} height={6} rx={2} fill="#000" opacity={0.5} filter={full ? url('soft') : undefined} />
          {screenUI(cx - 22, screenY - 3, 44, 11)}
        </g>
      );
      break;
  }

  return (
    <g pointerEvents="none">
      <path d={d} fill={url('dash')} stroke="#000" strokeWidth={0.5} />
      {/* soft-touch accent strip */}
      <path d={`M${cx - hw1 + 2},${y1 - 6} Q${cx},${y1 - 2} ${cx + hw1 - 2},${y1 - 6}`} fill="none" stroke={interior.accent} strokeWidth={model.screen === 'tesla' ? 0.8 : 1.8} opacity={0.85} />
      {ambient && <path d={`M${cx - hw1 + 2},${y1 - 7.4} Q${cx},${y1 - 3.4} ${cx + hw1 - 2},${y1 - 7.4}`} fill="none" stroke={ambient} strokeWidth={0.8} filter={full ? url('glow') : undefined} />}
      {/* defroster grille near the glass */}
      {full && <rect x={cx - hw0 * 0.6} y={y0 + 4} width={hw0 * 1.2} height={2.4} rx={1} fill={url('grille')} opacity={0.6} />}
      {/* vents */}
      {model.screen === 'tesla'
        ? <line x1={cx - hw1 + 4} x2={cx + hw1 - 4} y1={y1 - 9} y2={y1 - 9} stroke="#000" strokeWidth={1.2} />
        : [vent(cx - hw1 + 9, y1 - 11, 10, 6, 'vl'), vent(cx + hw1 - 9, y1 - 11, 10, 6, 'vr'), vent(cx - 7, y1 - 5.5, 9, 4.6, 'vc1'), vent(cx + 7, y1 - 5.5, 9, 4.6, 'vc2')]}
      {/* instrument cluster in front of the driver */}
      {model.cluster === 'analog' && (
        <g>
          <path d={`M${driver.cx - 15},${y1 - 2} Q${driver.cx},${y1 - 16} ${driver.cx + 15},${y1 - 2}Z`} fill={darken(interior.dash, 0.45)} />
          {[-6, 6].map((o) => (
            <g key={o}>
              <circle cx={driver.cx + o} cy={y1 - 5.5} r={4.4} fill="#0a0a0b" stroke={url('chrome')} strokeWidth={0.5} />
              <line x1={driver.cx + o} y1={y1 - 5.5} x2={driver.cx + o + 2.6} y2={y1 - 8} stroke="#f97316" strokeWidth={0.5} />
            </g>
          ))}
        </g>
      )}
      {model.cluster === 'digital' && model.screen !== 'panoramic' && (
        <g opacity={screenGlow}>
          <path d={`M${driver.cx - 15},${y1 - 2} Q${driver.cx},${y1 - 15} ${driver.cx + 15},${y1 - 2}Z`} fill={darken(interior.dash, 0.45)} />
          <rect x={driver.cx - 11} y={y1 - 8.6} width={22} height={5.6} rx={1} fill={url('screen')} stroke="#334155" strokeWidth={0.3} />
          {full && <path d={`M${driver.cx - 8},${y1 - 4} a3.2,3.2 0 0 1 6.4,0`} fill="none" stroke="#38bdf8" strokeWidth={0.5} />}
        </g>
      )}
      {screen}
      {/* glovebox on the passenger side */}
      <path d={`M${cx - hw1 + 14},${y1 - 2.5} L${cx - g.consoleW / 2 - 6},${y1 - 1.5}`} stroke="#000" strokeWidth={0.5} opacity={0.6} />
    </g>
  );
}

function Console({ g, model, interior, url, y0, y1, full }: { g: CarGeometry; model: CarModel; interior: Interior; url: Url; y0: number; y1: number; full: boolean }) {
  const { cx, consoleW: w } = g;
  const armY = y1 - 26;
  return (
    <g pointerEvents="none">
      <rect x={cx - w / 2} y={y0} width={w} height={y1 - y0} rx={4} fill={darken(interior.dash, 0.15)} stroke="#000" strokeWidth={0.4} />
      <rect x={cx - w / 2 + 2} y={y0 + 3} width={w - 4} height={armY - y0 - 6} rx={2.5} fill={darken(interior.dash, 0.35)} />
      {/* shifter */}
      {model.shifter === 'manual' && (
        <g>
          <rect x={cx - 4} y={y0 + 10} width={8} height={9} rx={2.5} fill="#0e0e0f" stroke="#333" strokeWidth={0.3} />
          <circle cx={cx} cy={y0 + 14.5} r={3.1} fill={url('chrome')} />
          {/* handbrake */}
          <rect x={cx - 1.6} y={armY - 18} width={3.2} height={14} rx={1.6} fill="#111" stroke={url('chrome')} strokeWidth={0.4} />
        </g>
      )}
      {model.shifter === 'lever' && (
        <g>
          <rect x={cx - 4.5} y={y0 + 9} width={9} height={13} rx={2} fill="#0e0e0f" stroke={url('chrome')} strokeWidth={0.4} />
          <rect x={cx - 2} y={y0 + 11} width={4} height={8} rx={2} fill={interior.seat} stroke="#000" strokeWidth={0.3} />
          <circle cx={cx + 5.5} cy={armY - 8} r={1.4} fill="#111" stroke="#666" strokeWidth={0.3} />
        </g>
      )}
      {model.shifter === 'dial' && <circle cx={cx} cy={y0 + 15} r={4.2} fill={url('chrome')} stroke="#000" strokeWidth={0.4} />}
      {model.shifter === 'column' && [0, 1].map((k) => (
        <rect key={k} x={cx - w / 2 + 3} y={y0 + 6 + k * 13} width={w - 6} height={11} rx={1.5} fill="#0c0c0d" stroke="#2b2b2e" strokeWidth={0.4} />
      ))}
      {/* cupholders */}
      {[-1, 1].map((s) => (
        <circle key={s} cx={cx + s * w * 0.22} cy={armY - (model.shifter === 'manual' ? 27 : 12)} r={w * 0.16} fill="#050505" stroke={full ? url('chrome') : '#444'} strokeWidth={0.4} />
      ))}
      {/* armrest */}
      <rect x={cx - w / 2 + 0.6} y={armY} width={w - 1.2} height={24} rx={4} fill={url('seat')} stroke={darken(interior.seat, 0.4)} strokeWidth={0.4} />
      {full && <rect x={cx - w / 2 + 2.4} y={armY + 1.8} width={w - 4.8} height={20.4} rx={3} fill="none" stroke={interior.stitch} strokeWidth={0.3} strokeDasharray="1 0.8" />}
      {/* rear AC vents at the back of the console */}
      <rect x={cx - 5} y={y1 - 1.2} width={10} height={2.8} rx={0.8} fill="#0b0b0c" stroke="#444" strokeWidth={0.3} />
    </g>
  );
}

function SteeringWheel({ cx, y, model, url }: { cx: number; y: number; model: CarModel; url: Url }) {
  return (
    <g pointerEvents="none">
      <rect x={cx - 2.5} y={y - 9} width={5} height={8} fill="#0a0a0b" />
      <ellipse cx={cx} cy={y} rx={19} ry={8} fill="none" stroke="#0e0e0f" strokeWidth={3.6} />
      <ellipse cx={cx} cy={y - 0.7} rx={19} ry={7.6} fill="none" stroke="#34343a" strokeWidth={0.9} />
      <path d={`M${cx - 17},${y + 1} L${cx - 6},${y + 1.2} M${cx + 17},${y + 1} L${cx + 6},${y + 1.2} M${cx},${y + 3} L${cx},${y + 6}`} stroke="#141416" strokeWidth={2.4} />
      <ellipse cx={cx} cy={y + 1.2} rx={7} ry={3.8} fill="#141416" stroke="#2a2a2e" strokeWidth={0.4} />
      <ellipse cx={cx} cy={y + 1.2} rx={2.8} ry={1.5} fill={url('chrome')} stroke={model.brandColor} strokeWidth={0.5} />
    </g>
  );
}

function SeatRowView(p: CabinProps & { row: CarGeometry['rows'][number] }) {
  const { row, interior, url, full } = p;
  const bench = row.kind === 'bench';
  const left = row.seats[0];
  const right = row.seats[row.seats.length - 1];
  return (
    <g>
      {bench && (
        // continuous bench base under the individual cushions
        <rect x={left.cx - left.w / 2 - 1} y={row.top + 2} width={right.cx + right.w / 2 - (left.cx - left.w / 2) + 2} height={row.d - 2} rx={7} fill={darken(interior.seat, 0.45)} />
      )}
      {row.seats.map((s) => (
        <Seat key={s.id} seat={s} interior={interior} url={url} full={full} state={p.seats[s.id]} counter={p.counter} showLabels={p.showLabels}
          onClick={p.onSeatClick} onHover={p.onSeatHover} />
      ))}
    </g>
  );
}

function Seat({ seat, interior, url, full, state, counter, showLabels, onClick, onHover }: {
  seat: SeatGeom; interior: Interior; url: Url; full: boolean; state?: SeatState; counter: number; showLabels: boolean;
  onClick?: (id: string) => void; onHover?: (id: string | null) => void;
}) {
  const { cx, top, w, d, kind } = seat;
  const status = state?.status ?? 'empty';
  const clickable = !!onClick && status !== 'driver' && status !== 'booked';
  const cushionH = d * 0.56;
  const backTop = top + d * 0.5;
  const backH = d * 0.4;
  const headW = seat.side === 'M' ? w * 0.42 : w * 0.52;
  const bol = kind === 'bench' ? w * 0.1 : w * 0.17;
  const stitch = interior.stitch;
  const perforated = interior.material !== 'fabric';
  const tint = status === 'booked' || status === 'mine' || status === 'driver'
    ? (state?.gender ? GENDER_COLOR[state.gender] : null) : null;
  const ring = status === 'available' ? '#22c55e' : status === 'selected' ? '#f59e0b' : status === 'mine' ? '#facc15' : null;
  const occupied = status === 'booked' || status === 'mine' || status === 'driver';

  return (
    <g
      className={`seat seat--${status}${clickable ? ' seat--clickable' : ''}`}
      onClick={clickable ? () => onClick!(seat.id) : undefined}
      onMouseEnter={onHover ? () => onHover(seat.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      data-seat={seat.id}
    >
      {/* hit area & status ring */}
      <rect x={cx - w / 2 - 2} y={top - 2} width={w + 4} height={d + 4} rx={9} fill="transparent" />
      {ring && (
        <rect x={cx - w / 2 - 2} y={top - 2} width={w + 4} height={d + 4} rx={9} fill={ring} fillOpacity={0.12} stroke={ring} strokeWidth={1.4}
          className={status === 'available' ? 'pulse-ring' : undefined} filter={full ? url('glow') : undefined} />
      )}
      {/* shadow */}
      <rect x={cx - w / 2 + 1} y={top + 2} width={w} height={d} rx={8} fill="#000" opacity={0.35} filter={full ? url('soft') : undefined} />
      {/* cushion */}
      <rect x={cx - w / 2} y={top} width={w} height={cushionH} rx={kind === 'bench' ? 5 : 8} fill={url('seat')} stroke={darken(interior.seat, 0.45)} strokeWidth={0.4} />
      <rect x={cx - w / 2 + bol} y={top + 3} width={w - 2 * bol} height={cushionH - 6} rx={3.5} fill={url('insert')} />
      {full && perforated && <rect x={cx - w / 2 + bol + 1.5} y={top + 5} width={w - 2 * bol - 3} height={cushionH - 10} rx={2.5} fill={url('perf')} />}
      {full && !perforated && Array.from({ length: 4 }, (_, i) => (
        <line key={i} x1={cx - w / 2 + bol + 1} x2={cx + w / 2 - bol - 1} y1={top + 6 + i * ((cushionH - 10) / 3)} y2={top + 6 + i * ((cushionH - 10) / 3)} stroke={darken(interior.insert, 0.25)} strokeWidth={0.4} />
      ))}
      {full && (
        <rect x={cx - w / 2 + bol} y={top + 3} width={w - 2 * bol} height={cushionH - 6} rx={3.5} fill="none" stroke={stitch} strokeWidth={0.35} strokeDasharray="1 0.9" />
      )}
      {/* backrest (angled, so a touch darker) */}
      <rect x={cx - w / 2 - (kind === 'bench' ? 0 : 0.8)} y={backTop} width={w + (kind === 'bench' ? 0 : 1.6)} height={backH} rx={kind === 'bench' ? 4 : 7} fill={url('seat')} stroke={darken(interior.seat, 0.45)} strokeWidth={0.4} />
      <rect x={cx - w / 2 + bol} y={backTop + 2} width={w - 2 * bol} height={backH - 4} rx={3} fill={url('insert')} />
      <rect x={cx - w / 2} y={backTop} width={w} height={backH} rx={6} fill={url('back')} />
      {full && <rect x={cx - w / 2 + bol} y={backTop + 2} width={w - 2 * bol} height={backH - 4} rx={3} fill="none" stroke={stitch} strokeWidth={0.35} strokeDasharray="1 0.9" />}
      {/* captain-seat armrests */}
      {kind === 'captain' && [-1, 1].map((s) => (
        <rect key={s} x={cx + s * (w / 2 + 1.2) - 2.6} y={top + d * 0.3} width={5.2} height={d * 0.42} rx={2.4} fill={darken(interior.seat, 0.2)} stroke="#000" strokeWidth={0.3} />
      ))}
      {/* headrest */}
      <rect x={cx - headW / 2} y={top + d * 0.84} width={headW} height={d * 0.15} rx={4} fill={url('seat')} stroke={darken(interior.seat, 0.5)} strokeWidth={0.4} />
      {full && [-1, 1].map((s) => <rect key={s} x={cx + s * headW * 0.25 - 0.7} y={top + d * 0.8} width={1.4} height={3} fill="#9ca3af" />)}

      {/* tint overlay showing who sits here */}
      {tint && <rect x={cx - w / 2} y={top} width={w} height={d} rx={8} fill={tint} opacity={0.2} />}
      {status === 'unavailable' && (
        <g opacity={0.85}>
          <rect x={cx - w / 2} y={top} width={w} height={d} rx={8} fill="#0f172a" opacity={0.45} />
          <path d={`M${cx - 5},${top + d * 0.3 - 5} l10,10 M${cx + 5},${top + d * 0.3 - 5} l-10,10`} stroke="#e2e8f0" strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
        </g>
      )}
      {occupied && state?.gender && <Occupant seat={seat} gender={state.gender} full={full} />}
      {(occupied || status === 'available' || status === 'selected') && (
        <SeatBadge seat={seat} state={state!} counter={counter} />
      )}
      {showLabels && !occupied && (
        <text x={cx} y={top + d * 0.3} textAnchor="middle" fontSize={6} fill="#fff" opacity={0.7} transform={counter ? `rotate(${counter} ${cx} ${top + d * 0.3})` : undefined} style={{ fontFamily: 'system-ui', fontWeight: 600 }}>
          {seat.id}
        </text>
      )}
    </g>
  );
}

/** A top-down person: head, hair, shoulders, arms and thighs. */
function Occupant({ seat, gender, full }: { seat: SeatGeom; gender: Gender; full: boolean }) {
  const { cx, top, w, d } = seat;
  const shirt = GENDER_SHIRT[gender];
  const skin = '#c68b5e';
  const hair = gender === 'F' ? '#2b1a12' : '#1b130e';
  const headY = top + d * 0.76;
  const r = Math.min(w * 0.17, 8.5);
  return (
    <g pointerEvents="none">
      {/* thighs / knees on the cushion */}
      {[-1, 1].map((s) => (
        <rect key={s} x={cx + s * w * 0.14 - w * 0.12} y={top + d * 0.06} width={w * 0.24} height={d * 0.5} rx={w * 0.11} fill={darken(shirt, 0.55)} />
      ))}
      {/* arms */}
      {[-1, 1].map((s) => (
        <path key={`a${s}`} d={`M${cx + s * w * 0.36},${top + d * 0.62} Q${cx + s * w * 0.42},${top + d * 0.4} ${cx + s * w * 0.3},${top + d * 0.22}`} stroke={shirt} strokeWidth={w * 0.13} strokeLinecap="round" fill="none" />
      ))}
      {[-1, 1].map((s) => <circle key={`h${s}`} cx={cx + s * w * 0.29} cy={top + d * 0.2} r={w * 0.07} fill={skin} />)}
      {/* shoulders / torso */}
      <ellipse cx={cx} cy={top + d * 0.66} rx={w * 0.42} ry={d * 0.13} fill={shirt} />
      {full && <ellipse cx={cx} cy={top + d * 0.63} rx={w * 0.3} ry={d * 0.06} fill="#fff" opacity={0.12} />}
      {/* long hair falls over the shoulders */}
      {gender === 'F' && <ellipse cx={cx} cy={headY + r * 0.75} rx={r * 1.1} ry={r * 1.15} fill={hair} />}
      <circle cx={cx} cy={headY} r={r} fill={skin} />
      <path d={gender === 'F'
        ? `M${cx - r},${headY} a${r},${r} 0 0 1 ${2 * r},0 q0,${r * 0.9} -${r * 0.15},${r}  L${cx - r * 0.85},${headY + r} q-${r * 0.15},-${r * 0.1} -${r * 0.15},-${r}Z`
        : `M${cx - r * 0.98},${headY + r * 0.15} a${r},${r} 0 0 1 ${1.96 * r},0 q-${r * 0.2},${r * 0.75} -${r * 0.98},${r * 0.85} q-${r * 0.78},-${r * 0.1} -${r * 0.98},-${r * 0.85}Z`}
        fill={hair}
      />
    </g>
  );
}

function SeatBadge({ seat, state, counter }: { seat: SeatGeom; state: SeatState; counter: number }) {
  const { cx, top, d } = seat;
  const y = top + d * 0.3;
  const r = 7.2;
  let fill = '#22c55e';
  let label = '+';
  if (state.status === 'selected') { fill = '#f59e0b'; label = '✓'; }
  if (state.gender && (state.status === 'booked' || state.status === 'mine' || state.status === 'driver')) {
    fill = GENDER_COLOR[state.gender];
    label = state.gender === 'M' ? '♂' : '♀';
  }
  return (
    <g pointerEvents="none" transform={counter ? `rotate(${counter} ${cx} ${y})` : undefined} className="seat-badge">
      <circle cx={cx} cy={y} r={r + 1.2} fill="#fff" opacity={0.95} />
      <circle cx={cx} cy={y} r={r} fill={fill} />
      <text x={cx} y={y + 3} textAnchor="middle" fontSize={state.gender ? 9.5 : 10} fontWeight={800} fill="#fff" style={{ fontFamily: 'system-ui, sans-serif' }}>
        {label}
      </text>
      {state.status === 'driver' && (
        <g>
          <rect x={cx - 11} y={y + r + 1.5} width={22} height={7} rx={3.5} fill="#0f172a" />
          <text x={cx} y={y + r + 6.6} textAnchor="middle" fontSize={4.6} fontWeight={700} fill="#fff" style={{ fontFamily: 'system-ui', letterSpacing: 0.3 }}>DRIVER</text>
        </g>
      )}
      {state.status === 'mine' && (
        <g>
          <rect x={cx - 8} y={y + r + 1.5} width={16} height={7} rx={3.5} fill="#facc15" />
          <text x={cx} y={y + r + 6.6} textAnchor="middle" fontSize={4.6} fontWeight={800} fill="#111" style={{ fontFamily: 'system-ui' }}>YOU</text>
        </g>
      )}
    </g>
  );
}

export const PAINT_SWATCH = (p: Paint) =>
  p.roof
    ? `linear-gradient(135deg, ${lighten(p.hex, 0.25)} 0%, ${p.hex} 55%, ${p.roof} 56%, ${p.roof} 100%)`
    : `radial-gradient(circle at 30% 30%, ${lighten(p.hex, p.finish === 'matte' ? 0.12 : 0.35)} 0%, ${p.hex} 55%, ${mix(p.hex, '#000', 0.4)} 100%)`;
