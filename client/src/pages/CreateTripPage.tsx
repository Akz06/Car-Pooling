import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DRIVER_SEAT, allSeats } from '@shared/catalog';
import type { Car } from '@shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { resolveCar, carTitle } from '../lib/carParts';
import { CarStage } from '../components/CarStage';
import { CarView, type SeatState } from '../components/CarView';
import { NumberPlate } from '../components/NumberPlate';

function defaultDeparture() {
  const d = new Date(Date.now() + 24 * 3600_000);
  d.setMinutes(0, 0, 0);
  d.setHours(8);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateTripPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [cars, setCars] = useState<Car[] | null>(null);
  const [carId, setCarId] = useState<string>('');
  const [offered, setOffered] = useState<string[]>([]);
  const [f, setF] = useState({ from: '', to: '', departAt: defaultDeparture(), price: 200, notes: '', womenOnly: false, past: false, mode: 'prepaid' as 'prepaid' | 'split' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pickCar = (c: Car) => {
    setCarId(c.id);
    setOffered(allSeats(resolveCar(c).model).filter((s) => s !== DRIVER_SEAT));
  };

  useEffect(() => {
    api.myCars().then((cs) => {
      setCars(cs);
      const pre = cs.find((c) => c.id === params.get('car')) ?? cs[0];
      if (pre) pickCar(pre);
    }).catch((e) => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cars) return <div className="page-loading">Opening garage…</div>;
  if (cars.length === 0) {
    return (
      <div className="empty">
        <h2>Add your car first</h2>
        <p>Trips are published in a real car from your garage.</p>
        <Link to="/garage/new" className="btn btn--primary">＋ Add a car</Link>
      </div>
    );
  }

  const car = cars.find((c) => c.id === carId)!;
  const { model, paint, interior } = resolveCar(car);
  const seats: Record<string, SeatState> = Object.fromEntries(
    allSeats(model).map((s) => [s, s === DRIVER_SEAT
      ? { status: 'driver', gender: user!.gender }
      : { status: offered.includes(s) ? 'available' : 'unavailable' }] as const),
  );
  const toggle = (s: string) => setOffered((o) => (o.includes(s) ? o.filter((x) => x !== s) : [...o, s]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const trip = await api.createTrip({
        carId, from: f.from, to: f.to, departAt: new Date(f.departAt).toISOString(), pricePerSeat: f.mode === 'split' ? 0 : Number(f.price), paymentMode: f.mode, pastTrip: f.past,
        offeredSeats: offered, womenOnly: f.womenOnly, notes: f.notes || undefined,
      });
      nav(`/trips/${trip.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Offer a ride</p>
          <h1>Publish a trip</h1>
          <p className="muted">Tap seats on the car to choose which ones you offer — e.g. keep the middle seat free for comfort.</p>
        </div>
      </div>
      <div className="config-layout">
        <div>
          {cars.length > 1 && (
            <div className="model-grid" style={{ marginBottom: 14 }}>
              {cars.map((c) => {
                const r = resolveCar(c);
                return (
                  <button key={c.id} type="button" className={`model-card ${c.id === carId ? 'on' : ''}`} onClick={() => pickCar(c)}>
                    <CarView model={r.model} paint={r.paint} interior={r.interior} mode="exterior" detail="lite" orientation="horizontal" />
                    <b>{r.model.model}</b>
                    <small>{c.plate}</small>
                  </button>
                );
              })}
            </div>
          )}
          <CarStage plate={car.plate} model={model} paint={paint} interior={interior} seats={seats} onSeatClick={toggle} showLabels />
          <p className="muted" style={{ fontSize: 13 }}>
            Offering <b style={{ color: 'var(--text)' }}>{offered.length}</b> of {allSeats(model).length - 1} passenger seats in your {carTitle(model)} <NumberPlate plate={car.plate} size="sm" />
          </p>
        </div>
        <form className="panel" onSubmit={submit}>
          <div className="field">
            <label htmlFor="from">Leaving from</label>
            <input id="from" className="input" required minLength={2} placeholder="e.g. Bengaluru, Indiranagar" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="to">Going to</label>
            <input id="to" className="input" required minLength={2} placeholder="e.g. Mysuru" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="when">Departure</label>
              <input id="when" className="input" type="datetime-local" required value={f.departAt} onChange={(e) => setF({ ...f, departAt: e.target.value })} />
              <label style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input type="checkbox" checked={f.past} onChange={(e) => setF({ ...f, past: e.target.checked })} />
                This is an old trip that already happened
              </label>
            </div>
          </div>
          <div className="field">
            <label>Payment</label>
            <label className="toggle">
              <input type="radio" name="mode" checked={f.mode === 'prepaid'} onChange={() => setF({ ...f, mode: 'prepaid' })} />
              <span><b>Pay upfront</b><br /><small className="muted">Fixed price per seat</small></span>
            </label>
            <label className="toggle">
              <input type="radio" name="mode" checked={f.mode === 'split'} onChange={() => setF({ ...f, mode: 'split' })} />
              <span><b>Split trip expenses</b><br /><small className="muted">Note spends during the trip, split at the end</small></span>
            </label>
          </div>
          {f.mode === 'prepaid' && (
            <div className="field">
              <label htmlFor="price">Price per seat (₹)</label>
              <input id="price" className="input" type="number" min={0} max={20000} step={10} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} />
            </div>
          )}
          <div className="field">
            <label htmlFor="notes">Notes for riders</label>
            <textarea id="notes" className="input" rows={3} maxLength={300} placeholder="Luggage space, stops, music, pets…" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          {user?.gender === 'F' && (
            <label className="toggle" style={{ marginBottom: 16 }}>
              <input type="checkbox" checked={f.womenOnly} onChange={(e) => setF({ ...f, womenOnly: e.target.checked })} />
              <span><b>Women-only ride</b><br /><small className="muted">Only female riders can book</small></span>
            </label>
          )}
          {error && <div className="error">{error}</div>}
          <button className="btn btn--primary btn--block" disabled={busy || offered.length === 0}>
            {busy ? 'Publishing…' : `Publish trip · ${offered.length} seat${offered.length === 1 ? '' : 's'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
