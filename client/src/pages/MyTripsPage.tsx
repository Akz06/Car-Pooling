import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TripView } from '@shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { resolveCar, carTitle } from '../lib/carParts';
import { rupees, when } from '../lib/format';
import { tripSeatStates } from '../lib/seats';
import { CarView } from '../components/CarView';
import { SeatBar } from '../components/TripCard';

export function MyTripsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<{ driving: TripView[]; riding: TripView[] } | null>(null);
  const [tab, setTab] = useState<'riding' | 'driving'>('riding');
  const [error, setError] = useState('');
  useEffect(() => { api.myTrips().then(setData).catch((e) => setError(e.message)); }, []);

  const list = data?.[tab] ?? [];
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">My trips</p>
          <h1>Your rides</h1>
        </div>
      </div>
      <div className="tabs">
        <button className={`chip ${tab === 'riding' ? 'on' : ''}`} onClick={() => setTab('riding')}>Riding ({data?.riding.length ?? 0})</button>
        <button className={`chip ${tab === 'driving' ? 'on' : ''}`} onClick={() => setTab('driving')}>Driving ({data?.driving.length ?? 0})</button>
      </div>
      {error && <div className="error">{error}</div>}
      {data && list.length === 0 && (
        <div className="empty">
          {tab === 'riding' ? <>No seats booked yet. <Link to="/" style={{ color: 'var(--accent)' }}>Find a ride →</Link></> : <>You haven't offered a ride. <Link to="/trips/new" style={{ color: 'var(--accent)' }}>Offer one →</Link></>}
        </div>
      )}
      {list.map((t) => {
        const { model, paint, interior } = resolveCar(t.car);
        const w = when(t.departAt);
        const mine = t.bookings.find((b) => b.userId === user?.id);
        return (
          <Link key={t.id} to={`/trips/${t.id}`} className="list-trip">
            <CarView model={model} paint={paint} interior={interior} detail="lite" orientation="horizontal" seats={tripSeatStates(t, user, null)} />
            <div style={{ display: 'grid', gap: 6 }}>
              <b>{t.from} → {t.to}</b>
              <span className="muted">{w.day}, {w.time} · {carTitle(model)} · {rupees(t.pricePerSeat)}{mine ? ` · your seat ${mine.seatId}` : ''}</span>
              <SeatBar trip={t} />
            </div>
            <span className={`tag ${t.status === 'open' ? 'tag--green' : t.status === 'full' ? 'tag--amber' : 'tag--red'}`}>{t.status}</span>
          </Link>
        );
      })}
    </div>
  );
}
