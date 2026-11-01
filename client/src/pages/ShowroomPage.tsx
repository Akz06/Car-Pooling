import { useState } from 'react';
import { CATALOG, MAKES, allSeats } from '@shared/catalog';
import { CarStage } from '../components/CarStage';
import { CarView } from '../components/CarView';
import { PaintSwatches, TrimSwatches } from '../components/Swatches';

export function ShowroomPage() {
  const [modelId, setModelId] = useState(CATALOG[0].id);
  const model = CATALOG.find((m) => m.id === modelId)!;
  const [paintId, setPaintId] = useState(model.paints[0].id);
  const [trimId, setTrimId] = useState(model.interiors[0].id);
  const paint = model.paints.find((p) => p.id === paintId) ?? model.paints[0];
  const interior = model.interiors.find((i) => i.id === trimId) ?? model.interiors[0];

  const pick = (id: string) => {
    const m = CATALOG.find((x) => x.id === id)!;
    setModelId(id);
    setPaintId(m.paints[0].id);
    setTrimId(m.interiors[0].id);
  };

  return (
    <div className="showroom">
      <div className="page-head">
        <div>
          <p className="eyebrow">Showroom</p>
          <h1>Every car drawn to scale</h1>
          <p className="muted">Real dimensions, factory paints, actual seat layouts and interior trims. This is exactly what riders see when they pick a seat.</p>
        </div>
      </div>
      <div className="model-rail">
        {MAKES.map((make) => (
          <div key={make} className="model-rail__group">
            <span className="model-rail__make">{make}</span>
            {CATALOG.filter((m) => m.make === make).map((m) => (
              <button key={m.id} className={`model-pill ${m.id === modelId ? 'on' : ''}`} onClick={() => pick(m.id)}>
                <CarView model={m} paint={m.paints[0]} interior={m.interiors[0]} mode="exterior" detail="lite" orientation="horizontal" className="model-pill__svg" />
                <span>{m.model}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="showroom__body">
        <CarStage model={model} paint={paint} interior={interior} showLabels />
        <aside className="panel spec">
          <h2>{model.make} {model.model}</h2>
          <p className="muted">{model.generation}</p>
          <h4>Paint — {paint.name}</h4>
          <PaintSwatches paints={model.paints} value={paint.id} onChange={setPaintId} />
          <h4>Interior</h4>
          <TrimSwatches interiors={model.interiors} value={interior.id} onChange={setTrimId} />
          <dl className="specs">
            <dt>Seats</dt><dd>{allSeats(model).length} · {model.rows.map((r) => r.seats.length).join('+')}{model.rows.some((r) => r.kind === 'captain') ? ' (captain)' : ''}</dd>
            <dt>Length × width</dt><dd>{model.lengthMm} × {model.widthMm} mm</dd>
            <dt>Wheelbase</dt><dd>{model.wheelbaseMm} mm</dd>
            <dt>Engine</dt><dd>{model.engine}</dd>
            <dt>Gearbox</dt><dd>{model.transmission}</dd>
            <dt>Fuel</dt><dd>{model.fuel}</dd>
            <dt>Boot</dt><dd>{model.bootLitres} L</dd>
            <dt>Screen</dt><dd>{model.screenInches}" {model.screen}</dd>
          </dl>
          <ul className="features">{model.features.map((f) => <li key={f}>{f}</li>)}</ul>
        </aside>
      </div>
    </div>
  );
}
