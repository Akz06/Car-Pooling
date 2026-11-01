import { useEffect, useState, type ReactNode } from 'react';
import { CarView, type CarViewProps } from './CarView';

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

const AMBIENT = ['#38bdf8', '#a855f7', '#f59e0b', '#ef4444', '#22c55e'];

/**
 * A parking-bay "stage" around the car with the controls a real configurator
 * has: lift the roof, switch day/night, tilt into 3D, pick ambient lighting.
 */
export function CarStage({
  orientation: preferred = 'horizontal', initialMode = 'cabin', children, toolbarExtra, ...view
}: Omit<CarViewProps, 'mode' | 'night' | 'ambient'> & { initialMode?: 'cabin' | 'exterior'; children?: ReactNode; toolbarExtra?: ReactNode }) {
  // On phones a nose-up car gives much bigger seat targets.
  const orientation = useNarrow() ? 'vertical' : preferred;
  const [mode, setMode] = useState<'cabin' | 'exterior'>(initialMode);
  const [night, setNight] = useState(false);
  const [tilt, setTilt] = useState(false);
  const [ambient, setAmbient] = useState(AMBIENT[0]);
  return (
    <div className={`stage ${night ? 'stage--night' : ''} ${tilt ? 'stage--tilt' : ''} stage--${orientation}`}>
      <div className="stage__toolbar">
        <div className="seg">
          <button className={mode === 'cabin' ? 'on' : ''} onClick={() => setMode('cabin')}>Cabin</button>
          <button className={mode === 'exterior' ? 'on' : ''} onClick={() => setMode('exterior')}>Exterior</button>
        </div>
        <div className="seg">
          <button className={!night ? 'on' : ''} onClick={() => setNight(false)} title="Daylight">☀︎</button>
          <button className={night ? 'on' : ''} onClick={() => setNight(true)} title="Night — headlamps & ambient lighting">☾</button>
        </div>
        <button className={`chip ${tilt ? 'chip--on' : ''}`} onClick={() => setTilt((t) => !t)}>3D</button>
        {night && view.model.ambientLight && (
          <div className="ambient-picker" title="Ambient lighting">
            {AMBIENT.map((c) => (
              <button key={c} style={{ background: c }} className={c === ambient ? 'on' : ''} onClick={() => setAmbient(c)} aria-label={`Ambient ${c}`} />
            ))}
          </div>
        )}
        {toolbarExtra}
      </div>
      <div className="stage__floor">
        <div className="stage__bay" />
        <div className="stage__car">
          <CarView {...view} orientation={orientation} mode={mode} night={night} ambient={ambient} className="stage__svg" />
        </div>
      </div>
      {children}
    </div>
  );
}
