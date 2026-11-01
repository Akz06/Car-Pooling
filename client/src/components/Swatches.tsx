import type { Interior, Paint } from '@shared/catalog';
import { PAINT_SWATCH } from './CarView';

export function PaintSwatches({ paints, value, onChange }: { paints: Paint[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="swatches">
      {paints.map((p) => (
        <button key={p.id} type="button" className={`swatch ${p.id === value ? 'on' : ''}`} onClick={() => onChange(p.id)} title={`${p.name} (${p.finish}${p.roof ? ', dual-tone' : ''})`}>
          <span className="swatch__chip" style={{ background: PAINT_SWATCH(p) }} />
        </button>
      ))}
    </div>
  );
}

export function TrimSwatches({ interiors, value, onChange }: { interiors: Interior[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="trims">
      {interiors.map((i) => (
        <button key={i.id} type="button" className={`trim ${i.id === value ? 'on' : ''}`} onClick={() => onChange(i.id)}>
          <span className="trim__chip" style={{ background: `linear-gradient(90deg, ${i.bolster} 0 22%, ${i.insert} 22% 78%, ${i.bolster} 78%)`, boxShadow: `inset 0 -6px 0 ${i.dash}` }} />
          <span>
            <b>{i.name}</b>
            <small>{i.material.replace('-', ' ')}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
