import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getModel } from '@shared/catalog';
import type { TripView } from '@shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { TripCard } from '../components/TripCard';
import { CarView, type SeatState } from '../components/CarView';

const heroModel = getModel('mahindra-xuv700')!;
const heroSeats: Record<string, SeatState> = {
  '1R': { status: 'driver', gender: 'M' },
  '1L': { status: 'booked', gender: 'F' },
  '2L': { status: 'booked', gender: 'M' },
  '2M': { status: 'available' },
  '2R': { status: 'booked', gender: 'F' },
  '3L': { status: 'available' },
  '3R': { status: 'available' },
};

export function TripsPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripView[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState({ from: '', to: '', date: '' });
  const [womenOnly, setWomenOnly] = useState(false);
  const [hideFull, setHideFull] = useState(true);
  const [body, setBody] = useState<string>('all');

  const load = (query = q) => {
    setError('');
    api.trips(query).then(setTrips).catch((e) => setError(e.message));
  };
  useEffect(() => load(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => (trips ?? []).filter((t) => {
    if (womenOnly && !t.womenOnly) return false;
    if (hideFull && t.status !== 'open') return false;
    if (body !== 'all' && getModel(t.car.modelId)?.body !== body) return false;
    return true;
  }), [trips, womenOnly, hideFull, body]);

  return (
    <div>
      <section className="hero">
        <div>
          <p className="eyebrow">Car pooling, but you choose your seat</p>
          <h1>Look inside the car before you get in.</h1>
          <p className="muted" style={{ fontSize: 17, maxWidth: 560 }}>
            Every ride shows the real car — model, paint, interior — and exactly who sits where.
            Blue <b className="g-M">♂</b> and pink <b className="g-F">♀</b> seats are taken; green ones are yours to pick.
          </p>
          <form className="search" onSubmit={(e) => { e.preventDefault(); load(); }}>
            <input className="input" placeholder="Leaving from" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} />
            <input className="input" placeholder="Going to" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} />
            <input className="input" type="date" value={q.date} onChange={(e) => setQ({ ...q, date: e.target.value })} />
            <button className="btn btn--primary">Search</button>
          </form>
        </div>
        <div className="hero__art stage">
          <div className="stage__floor" style={{ padding: '18px 10px' }}>
            <CarView model={heroModel} paint={heroModel.paints[4]} interior={heroModel.interiors[0]} orientation="horizontal" seats={heroSeats} className="stage__svg" />
          </div>
        </div>
      </section>

      <div className="filters">
        <button className={`chip ${hideFull ? 'on' : ''}`} onClick={() => setHideFull((v) => !v)}>Has free seats</button>
        <button className={`chip ${womenOnly ? 'on' : ''}`} onClick={() => setWomenOnly((v) => !v)}>♀ Women-only rides</button>
        <span className="muted" style={{ margin: '0 6px' }}>·</span>
        {[['all', 'Any car'], ['hatchback', 'Hatchback'], ['sedan', 'Sedan'], ['compact-suv', 'Compact SUV'], ['suv', 'SUV'], ['mpv', 'MPV']].map(([k, label]) => (
          <button key={k} className={`chip ${body === k ? 'on' : ''}`} onClick={() => setBody(k)}>{label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <Link to={user ? '/trips/new' : '/login?next=/trips/new'} className="btn btn--sm">＋ Offer a ride</Link>
      </div>

      {error && <div className="error">{error}</div>}
      {!trips && !error && <div className="empty">Loading rides…</div>}
      {trips && shown.length === 0 && (
        <div className="empty">No rides match. <Link to="/trips/new" style={{ color: 'var(--accent)' }}>Offer one?</Link></div>
      )}
      <div className="trip-grid">
        {shown.map((t) => <TripCard key={t.id} trip={t} />)}
      </div>
    </div>
  );
}
