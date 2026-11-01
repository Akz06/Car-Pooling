import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { CarView, type CarViewProps } from './CarView';
import type { CameraPreset } from '../three/Scene3D';

// three.js is big: only load it when a 3D stage is actually shown.
const Scene3D = lazy(() => import('../three/Scene3D'));

function useNarrow(query = '(max-width: 640px)') {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return narrow;
}

const webglOk = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
})();

/** If WebGL fails at runtime, fall back to the 2D seat map instead of a blank stage. */
class GlBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const AMBIENT = ['#38bdf8', '#a855f7', '#f59e0b', '#ef4444', '#22c55e'];
const PRESETS: [CameraPreset, string][] = [['front', 'Front'], ['side', 'Side'], ['rear', 'Rear'], ['top', 'Top']];

type StageProps = Omit<CarViewProps, 'mode' | 'night' | 'ambient'> & {
  initialMode?: 'cabin' | 'exterior';
  /** Start on the exterior, then lift the roof to reveal the seats. */
  reveal?: boolean;
  plate?: string;
  children?: ReactNode;
  toolbarExtra?: ReactNode;
};

/**
 * The car stage: a 3D showroom (default) or the to-scale 2D seat map, with
 * configurator controls — roof on/off, day/night, camera angles, ambient light.
 */
export function CarStage({
  orientation: preferred = 'horizontal', initialMode = 'cabin', reveal = false, plate, children, toolbarExtra, ...view
}: StageProps) {
  const narrow = useNarrow();
  const orientation = narrow ? 'vertical' : preferred;
  const [kind, setKind] = useState<'3d' | 'map'>(webglOk ? '3d' : 'map');
  const [mode, setMode] = useState<'cabin' | 'exterior'>(reveal ? 'exterior' : initialMode);
  const [preset, setPreset] = useState<CameraPreset>(reveal || initialMode === 'exterior' ? 'front' : 'top');
  const [night, setNight] = useState(false);
  const [tilt, setTilt] = useState(false);
  const [ambient, setAmbient] = useState(AMBIENT[0]);

  useEffect(() => {
    if (!reveal) return;
    const t = setTimeout(() => { setMode('cabin'); setPreset('top'); }, 2200);
    return () => clearTimeout(t);
  }, [reveal]);

  const setRoof = (m: 'cabin' | 'exterior') => {
    setMode(m);
    setPreset(m === 'cabin' ? 'top' : 'front');
  };

  const map = (
    <div className="stage__floor">
      <div className="stage__bay" />
      <div className="stage__car">
        <CarView {...view} orientation={orientation} mode={mode} night={night} ambient={ambient} className="stage__svg" />
      </div>
    </div>
  );

  return (
    <div className={`stage ${night ? 'stage--night' : ''} ${tilt && kind === 'map' ? 'stage--tilt' : ''} stage--${orientation} stage--${kind}`}>
      <div className="stage__toolbar">
        {webglOk && (
          <div className="seg">
            <button className={kind === '3d' ? 'on' : ''} onClick={() => setKind('3d')}>3D</button>
            <button className={kind === 'map' ? 'on' : ''} onClick={() => setKind('map')}>Seat map</button>
          </div>
        )}
        <div className="seg">
          <button className={mode === 'cabin' ? 'on' : ''} onClick={() => setRoof('cabin')}>Cabin</button>
          <button className={mode === 'exterior' ? 'on' : ''} onClick={() => setRoof('exterior')}>Exterior</button>
        </div>
        <div className="seg">
          <button className={!night ? 'on' : ''} onClick={() => setNight(false)} title="Daylight">☀︎</button>
          <button className={night ? 'on' : ''} onClick={() => setNight(true)} title="Night — headlamps & ambient lighting">☾</button>
        </div>
        {kind === 'map' && <button className={`chip ${tilt ? 'chip--on' : ''}`} onClick={() => setTilt((t) => !t)}>Tilt</button>}
        {kind === 'map' && night && view.model.ambientLight && (
          <div className="ambient-picker" title="Ambient lighting">
            {AMBIENT.map((c) => (
              <button key={c} style={{ background: c }} className={c === ambient ? 'on' : ''} onClick={() => setAmbient(c)} aria-label={`Ambient ${c}`} />
            ))}
          </div>
        )}
        {toolbarExtra}
      </div>
      {kind === '3d' ? (
        <div className="stage__3d">
          <GlBoundary fallback={map}>
            <Suspense fallback={<div className="stage__loading">Opening the showroom…</div>}>
              <Scene3D
                model={view.model} paint={view.paint} interior={view.interior} plate={plate}
                seats={view.seats ?? {}} onSeatClick={view.onSeatClick} onSeatHover={view.onSeatHover}
                openDoorFor={view.openDoorFor} cabin={mode === 'cabin'} night={night} preset={preset}
              />
            </Suspense>
          </GlBoundary>
          <div className="stage__cams">
            {PRESETS.map(([p, label]) => (
              <button key={p} className={preset === p ? 'on' : ''} onClick={() => setPreset(p)}>{label}</button>
            ))}
          </div>
          <span className="stage__hint">{narrow ? 'Drag to orbit · pinch to zoom' : 'Drag to orbit · scroll to zoom'}</span>
        </div>
      ) : map}
      {children}
    </div>
  );
}
