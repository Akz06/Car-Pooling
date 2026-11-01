import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATALOG, MAKES, allSeats } from '@shared/catalog';
import { api } from '../lib/api';
import { CarStage } from '../components/CarStage';
import { CarView } from '../components/CarView';
import { NumberPlate } from '../components/NumberPlate';
import { PaintSwatches, TrimSwatches } from '../components/Swatches';

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

export function AddCarPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [modelId, setModelId] = useState(CATALOG[1].id);
  const model = CATALOG.find((m) => m.id === modelId)!;
  const [paintId, setPaintId] = useState(model.paints[0].id);
  const [trimId, setTrimId] = useState(model.interiors[0].id);
  const [plate, setPlate] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [nickname, setNickname] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const paint = model.paints.find((p) => p.id === paintId) ?? model.paints[0];
  const interior = model.interiors.find((i) => i.id === trimId) ?? model.interiors[0];

  const chooseModel = (id: string) => {
    const m = CATALOG.find((x) => x.id === id)!;
    setModelId(id);
    setPaintId(m.paints[0].id);
    setTrimId(m.interiors[0].id);
  };

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      await api.addCar({ modelId, paintId: paint.id, interiorId: interior.id, plate, year, nickname: nickname || undefined, photo });
      nav('/garage');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Add a car · step {step + 1} of 3</p>
          <h1>{step === 0 ? 'Which car do you drive?' : step === 1 ? 'Spec it exactly like yours' : 'Registration details'}</h1>
        </div>
      </div>
      <div className="config-layout">
        <CarStage model={model} paint={paint} interior={interior} initialMode={step === 1 ? 'exterior' : 'cabin'} key={step} showLabels />
        <aside className="panel">
          <div className="steps">{[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
          {step === 0 && (
            <>
              {MAKES.map((make) => (
                <div key={make}>
                  <h4>{make}</h4>
                  <div className="model-grid">
                    {CATALOG.filter((m) => m.make === make).map((m) => (
                      <button key={m.id} type="button" className={`model-card ${m.id === modelId ? 'on' : ''}`} onClick={() => chooseModel(m.id)}>
                        <CarView model={m} paint={m.paints[0]} interior={m.interiors[0]} mode="exterior" detail="lite" orientation="horizontal" />
                        <b>{m.model}</b>
                        <small>{allSeats(m).length} seats · {m.body.replace('-', ' ')}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
          {step === 1 && (
            <>
              <h3>{model.make} {model.model}</h3>
              <h4>Paint — {paint.name} <span style={{ textTransform: 'none' }}>({paint.finish}{paint.roof ? ', dual-tone' : ''})</span></h4>
              <PaintSwatches paints={model.paints} value={paint.id} onChange={setPaintId} />
              <h4>Interior trim</h4>
              <TrimSwatches interiors={model.interiors} value={interior.id} onChange={setTrimId} />
              <p className="muted" style={{ fontSize: 13 }}>Tip: switch the preview to <b>Cabin</b> to see your trim on the seats.</p>
            </>
          )}
          {step === 2 && (
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
              {error && <div className="error">{error}</div>}
            </>
          )}
          <div className="row" style={{ marginTop: 18 }}>
            {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
            {step < 2
              ? <button className="btn btn--primary" onClick={() => setStep(step + 1)}>Continue</button>
              : <button className="btn btn--primary" disabled={busy || plate.trim().length < 4} onClick={save}>{busy ? 'Saving…' : 'Add to garage'}</button>}
          </div>
        </aside>
      </div>
    </div>
  );
}
