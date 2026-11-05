import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DRIVER_SEAT, allSeats } from '@shared/catalog';
import type { TripView } from '@shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { resolveCar } from '../lib/carParts';
import { CarStage } from '../components/CarStage';
import type { SeatState } from '../components/CarView';

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditTripPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [trip, setTrip] = useState<TripView | null>(null);
  const [offered, setOffered] = useState<string[]>([]);
  const [f, setF] = useState({ from: '', to: '', departAt: '', price: 0, notes: '', womenOnly: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.trip(id!).then((t) => {
      setTrip(t);
      setOffered(t.offeredSeats);
      setF({ from: t.from, to: t.to, departAt: toLocalInput(t.departAt), price: t.pricePerSeat, notes: t.notes ?? '', womenOnly: t.womenOnly });
    }).catch((e) => setError(e.message));
  }, [id]);

  if (error && !trip) return <div className="error">{error}</div>;
  if (!trip) return <div className="page-loading">Loading trip…</div>;
  if (user?.id !== trip.ownerId) return <div className="error">Only the driver can edit this trip</div>;
  if (trip.status === 'cancelled' || trip.status === 'departed') return <div className="error">This trip is {trip.status} and can't be edited</div>;

  const { model, paint, interior } = resolveCar(trip.car);
  const booked = new Set(trip.bookings.map((b) => b.seatId));
  const seats: Record<string, SeatState> = Object.fromEntries(
    allSeats(model).map((s) => [s, s === DRIVER_SEAT
      ? { status: 'driver', gender: user.gender }
      : booked.has(s)
        ? { status: 'booked', gender: trip.bookings.find((b) => b.seatId === s)!.gender }
        : { status: offered.includes(s) ? 'available' : 'unavailable' }] as const),
  );
  const toggle = (s: string) => {
    if (s === DRIVER_SEAT || booked.has(s)) return;
    setOffered((o) => (o.includes(s) ? o.filter((x) => x !== s) : [...o, s]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.updateTrip(trip.id, {
        from: f.from, to: f.to, departAt: new Date(f.departAt).toISOString(), offeredSeats: offered, womenOnly: f.womenOnly, notes: f.notes,
        ...(trip.paymentMode === 'prepaid' ? { pricePerSeat: Number(f.price) } : {}),
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
          <p className="eyebrow">Driver options</p>
          <h1>Edit trip</h1>
          <p className="muted">Booked seats can't be removed. The car can't be changed.</p>
        </div>
        <Link to={`/trips/${trip.id}`} className="btn btn--ghost btn--sm">← Back</Link>
      </div>
      <div className="config-layout">
        <CarStage plate={trip.car.plate} model={model} paint={paint} interior={interior} seats={seats} onSeatClick={toggle} showLabels />
        <form className="panel" onSubmit={submit}>
          <div className="field">
            <label htmlFor="from">Leaving from</label>
            <input id="from" className="input" required minLength={2} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="to">Going to</label>
            <input id="to" className="input" required minLength={2} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="when">Departure</label>
            <input id="when" className="input" type="datetime-local" required value={f.departAt} onChange={(e) => setF({ ...f, departAt: e.target.value })} />
          </div>
          {trip.paymentMode === 'prepaid' && (
            <div className="field">
              <label htmlFor="price">Price per seat (₹)</label>
              <input id="price" className="input" type="number" min={0} max={20000} step={10} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} />
            </div>
          )}
          <div className="field">
            <label htmlFor="notes">Notes for riders</label>
            <textarea id="notes" className="input" rows={3} maxLength={300} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          {user.gender === 'F' && (
            <label className="toggle" style={{ marginBottom: 16 }}>
              <input type="checkbox" checked={f.womenOnly} onChange={(e) => setF({ ...f, womenOnly: e.target.checked })} />
              <span><b>Women-only ride</b></span>
            </label>
          )}
          {error && <div className="error">{error}</div>}
          <button className="btn btn--primary btn--block" disabled={busy || offered.length === 0}>{busy ? 'Saving…' : 'Save changes'}</button>
        </form>
      </div>
    </div>
  );
}
