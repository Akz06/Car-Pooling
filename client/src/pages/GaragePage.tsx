import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Car } from '@shared/types';
import { allSeats } from '@shared/catalog';
import { api } from '../lib/api';
import { resolveCar, carTitle } from '../lib/carParts';
import { CarView } from '../components/CarView';
import { NumberPlate } from '../components/NumberPlate';

export function GaragePage() {
  const [cars, setCars] = useState<Car[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.myCars().then(setCars).catch((e) => setError(e.message)); }, []);

  const remove = async (c: Car) => {
    if (!confirm(`Remove ${c.plate} from your garage?`)) return;
    try {
      await api.deleteCar(c.id);
      setCars((cs) => cs!.filter((x) => x.id !== c.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">My garage</p>
          <h1>Your cars</h1>
          <p className="muted">Add the car you drive — its exact model, factory paint and interior — so riders know what they're getting into.</p>
        </div>
        <Link to="/garage/new" className="btn btn--primary">＋ Add a car</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {cars && cars.length === 0 && <div className="empty">Your garage is empty. <Link to="/garage/new" style={{ color: 'var(--accent)' }}>Add your first car →</Link></div>}
      <div className="garage-grid">
        {cars?.map((c) => {
          const { model, paint, interior } = resolveCar(c);
          return (
            <div key={c.id} className="garage-card">
              <div className="garage-card__art">
                <CarView model={model} paint={paint} interior={interior} mode="exterior" orientation="horizontal" detail="lite" />
              </div>
              <div className="garage-card__body">
                <div className="trip-card__meta">
                  <div>
                    <b>{c.year} {carTitle(model)}</b>
                    {c.nickname && <div className="muted">“{c.nickname}”</div>}
                  </div>
                  <NumberPlate plate={c.plate} size="sm" />
                </div>
                <span className="muted" style={{ fontSize: 13 }}>{paint.name} · {interior.name} · {allSeats(model).length} seats</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <Link to={`/trips/new?car=${c.id}`} className="btn btn--sm btn--primary">Offer a ride</Link>
                  <button className="btn btn--sm btn--danger" onClick={() => remove(c)}>Remove</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
