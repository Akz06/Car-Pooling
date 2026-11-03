import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATALOG, MAKES, allSeats, rowsSummary, seatingOptions, withLayout, type CarModel } from '@shared/catalog';
import { api } from '../lib/api';
import { CarStage } from '../components/CarStage';
import { CarView, type SeatState } from '../components/CarView';
import { NumberPlate } from '../components/NumberPlate';
import { PaintSwatches, TrimSwatches } from '../components/Swatches';
import { useModelGallery, viaCache } from '../lib/modelPhotos';

/** Downscale a photo on the client so we never upload multi-MB camera images. */
function resizeImage(file: File, max = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

const STEPS = ['Make', 'Model', 'Seating', 'Colour', 'Details'] as const;
type Step = 0 | 1 | 2 | 3 | 4;

/** Every seat drawn as free, so the preview shows the layout clearly. */
const allFree = (m: CarModel): Record<string, SeatState> =>
  Object.fromEntries(allSeats(m).map((s, i) => [s, { status: i === 1 ? 'driver' : 'available' } as SeatState]));

/** A model card with its real CarDekho photo, falling back to the drawn car. */
function ModelCard({ model, on, onPick }: { model: CarModel; on: boolean; onPick: () => void }) {
  const gallery = useModelGallery(model);
  const photo = gallery?.find((p) => p.group === 'exterior');
  const seats = seatingOptions(model).map((o) => o.rows.reduce((a, r) => a + r.seats.length, 0));
  return (
    <button type="button" className={`pick-card ${on ? 'on' : ''}`} onClick={onPick}>
      <span className="pick-card__img">
        {photo
          ? <img src={viaCache(photo.thumb ?? photo.url)} alt="" loading="lazy" />
          : <CarView model={model} paint={model.paints[0]} interior={model.interiors[0]} mode="exterior" detail="lite" orientation="horizontal" />}
      </span>
      <b>{model.model}</b>
      <small>{[...new Set(seats)].sort((a, b) => a - b).join(' / ')} seats · {model.body.replace('-', ' ')} · {model.fuel}</small>
    </button>
  );
}

export function AddCarPage() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [make, setMake] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [layoutId, setLayoutId] = useState('default');
  const [paintId, setPaintId] = useState('');
  const [trimId, setTrimId] = useState('');
  const [plate, setPlate] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [nickname, setNickname] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const base = CATALOG.find((m) => m.id === modelId);
  const model = base ? withLayout(base, layoutId) : undefined;
  const paint = base?.paints.find((p) => p.id === paintId) ?? base?.paints[0];
  const interior = base?.interiors.find((i) => i.id === trimId) ?? base?.interiors[0];
  const options = base ? seatingOptions(base) : [];
  const layout = options.find((o) => o.id === layoutId) ?? options[0];
  const makes = useMemo(() => MAKES.map((mk) => ({ make: mk, models: CATALOG.filter((m) => m.make === mk) })), []);

  const pickMake = (mk: string) => {
    setMake(mk);
    if (base?.make !== mk) setModelId(null);
    setStep(1);
  };
  const pickModel = (m: CarModel) => {
    setModelId(m.id);
    setLayoutId('default');
    setPaintId(m.paints[0].id);
    setTrimId(m.interiors[0].id);
  };
  const canGo = (s: Step) => s === 0 || (s === 1 && !!make) || (s >= 2 && !!model);

  const save = async () => {
    if (!model || !paint || !interior) return;
    setError('');
    setBusy(true);
    try {
      await api.addCar({ modelId: model.id, layoutId: layoutId === 'default' ? undefined : layoutId, paintId: paint.id, interiorId: interior.id, plate, year, nickname: nickname || undefined, photo });
      nav('/garage');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const titles = ['Which make is your car?', `Which ${make ?? ''} do you drive?`, 'How many seats does yours have?', 'Paint and interior', 'Registration details'];

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Add a car · step {step + 1} of 5</p>
          <h1>{titles[step]}</h1>
        </div>
      </div>

      <ol className="wizard">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'on' : i < step ? 'done' : ''}>
            <button type="button" disabled={!canGo(i as Step) || i > step} onClick={() => setStep(i as Step)}>
              <span>{i < step ? '✓' : i + 1}</span>{label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="make-grid">
          {makes.map(({ make: mk, models }) => (
            <button key={mk} type="button" className={`make-card ${mk === make ? 'on' : ''}`} onClick={() => pickMake(mk)}>
              <span className="make-card__badge" style={{ background: models[0].brandColor }}>{mk.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
              <b>{mk}</b>
              <small>{models.length} model{models.length > 1 ? 's' : ''}</small>
            </button>
          ))}
        </div>
      )}

      {step > 0 && (
        <div className="config-layout">
          <div>
            {model && paint && interior ? (
              <>
                <CarStage key={step === 3 ? 'ext' : 'cab'} model={model} paint={paint} interior={interior} plate={plate || undefined}
                  initialMode={step === 3 ? 'exterior' : 'cabin'} seats={allFree(model)} showLabels />
                <div className="preview-caption">
                  <b>{model.make} {model.model}</b>
                  <span>{layout?.label} · {rowsSummary(model.rows)}</span>
                  <span>{paint.name}</span>
                </div>
              </>
            ) : (
              <div className="stage stage--empty"><span>Pick a model to see it here — drawn to scale with its real seat layout.</span></div>
            )}
          </div>

          <aside className="panel">
            {step === 1 && make && (
              <>
                <div className="pick-grid">
                  {makes.find((x) => x.make === make)!.models.map((m) => (
                    <ModelCard key={m.id} model={m} on={m.id === modelId} onPick={() => pickModel(m)} />
                  ))}
                </div>
                <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={() => setStep(0)}>← Change make</button>
              </>
            )}

            {step === 2 && base && (
              <>
                <p className="muted" style={{ marginTop: 0 }}>
                  {options.length > 1 ? `The ${base.model} is sold in ${options.length} seating versions. Pick yours — riders will book exactly these seats.` : `The ${base.model} comes in one seating version.`}
                </p>
                <div className="seat-options">
                  {options.map((o) => {
                    const m = withLayout(base, o.id);
                    return (
                      <button key={o.id} type="button" className={`seat-option ${o.id === layoutId ? 'on' : ''}`} onClick={() => setLayoutId(o.id)}>
                        <CarView model={m} paint={paint!} interior={interior!} detail="lite" orientation="horizontal" seats={allFree(m)} />
                        <span><b>{o.label}</b><small>{rowsSummary(o.rows)} · {allSeats(m).length - 1} passenger seats</small></span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 3 && base && paint && interior && (
              <>
                <h4 style={{ marginTop: 0 }}>Paint — {paint.name} <span style={{ textTransform: 'none' }}>({paint.finish}{paint.roof ? ', dual-tone' : ''})</span></h4>
                <PaintSwatches paints={base.paints} value={paint.id} onChange={setPaintId} />
                <h4>Interior trim</h4>
                <TrimSwatches interiors={base.interiors} value={interior.id} onChange={setTrimId} />
              </>
            )}

            {step === 4 && model && (
              <>
                <div className="field">
                  <label htmlFor="plate">Number plate</label>
                  <input id="plate" className="input" placeholder="KA 01 AB 1234" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} />
                  {plate && <div><NumberPlate plate={plate} /></div>}
                </div>
                <div className="row">
                  <div className="field">
                    <label htmlFor="year">Model year</label>
                    <input id="year" className="input" type="number" min={1990} max={new Date().getFullYear() + 1} value={year} onChange={(e) => setYear(Number(e.target.value))} />
                  </div>
                  <div className="field">
                    <label htmlFor="nick">Nickname (optional)</label>
                    <input id="nick" className="input" maxLength={40} value={nickname} onChange={(e) => setNickname(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label>Photo of your actual car (optional)</label>
                  <label className="photo-drop">
                    {photo ? <img src={photo} alt="Your car" /> : <span>📷 Tap to add a photo — riders love seeing the real car</span>}
                    <input type="file" accept="image/*" hidden onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) setPhoto(await resizeImage(file).catch((err) => { setError(err.message); return undefined; }));
                    }} />
                  </label>
                </div>
                <dl className="specs">
                  <dt>Car</dt><dd>{model.make} {model.model}</dd>
                  <dt>Seating</dt><dd>{layout?.label} · {rowsSummary(model.rows)}</dd>
                  <dt>Paint</dt><dd>{paint?.name}</dd>
                  <dt>Interior</dt><dd>{interior?.name}</dd>
                </dl>
                {error && <div className="error">{error}</div>}
              </>
            )}

            <div className="row" style={{ marginTop: 18 }}>
              {step > 0 && <button className="btn" onClick={() => setStep((step - 1) as Step)}>Back</button>}
              {step < 4
                ? <button className="btn btn--primary" disabled={(step === 1 && !model)} onClick={() => setStep((step + 1) as Step)}>Continue</button>
                : <button className="btn btn--primary" disabled={busy || plate.trim().length < 4} onClick={save}>{busy ? 'Saving…' : 'Add to garage'}</button>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
