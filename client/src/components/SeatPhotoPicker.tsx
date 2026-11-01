import { useState } from 'react';
import type { CarModel } from '@shared/catalog';
import { CATEGORY_LABEL } from '@shared/photos';
import type { SeatState } from './CarView';
import { seatPhotos } from '../lib/modelPhotos';

/** Pick a seat on the car's real interior photos — pins show ♂ / ♀ / free like the 3D view. */
export function SeatPhotoPicker({ model, seats, onSeatClick, onSeatHover }: {
  model: CarModel; seats: Record<string, SeatState>; onSeatClick?: (id: string) => void; onSeatHover?: (id: string | null) => void;
}) {
  const shots = seatPhotos(model);
  const [k, setK] = useState(shots.findIndex((s) => s.category === 'rear-seats') >= 0 ? shots.findIndex((s) => s.category === 'rear-seats') : 0);
  const shot = shots[Math.min(k, shots.length - 1)];
  if (!shot) return null;
  return (
    <div className="seatphoto">
      <div className="seatphoto__frame">
        <img src={shot.photo.url} alt={shot.photo.caption} />
        {Object.entries(shot.pins).map(([id, [x, y]]) => {
          const st = seats[id] ?? { status: 'empty' as const };
          const occupied = st.gender && (st.status === 'booked' || st.status === 'mine' || st.status === 'driver');
          const clickable = !!onSeatClick && st.status !== 'driver' && st.status !== 'booked';
          const label = occupied ? (st.gender === 'M' ? '♂' : '♀') : st.status === 'selected' ? '✓' : st.status === 'unavailable' ? '×' : '+';
          return (
            <button
              key={id}
              className={`seat3d-badge seat3d-badge--${st.status} seatphoto__pin`}
              style={{ left: `${x * 100}%`, top: `${y * 100}%`, background: occupied ? (st.gender === 'M' ? '#2f7cf6' : '#ec4899') : st.status === 'selected' ? '#f59e0b' : st.status === 'unavailable' ? '#475569' : '#22c55e' }}
              onClick={clickable ? () => onSeatClick!(id) : undefined}
              onMouseEnter={() => onSeatHover?.(id)}
              onMouseLeave={() => onSeatHover?.(null)}
              aria-label={`Seat ${id}`}
            >
              <span>{label}</span>
              {st.status === 'driver' && <em>Driver</em>}
              {st.status === 'mine' && <em>You</em>}
              {occupied && st.status === 'booked' && st.name && <em>{st.name.split(' ')[0]}</em>}
            </button>
          );
        })}
      </div>
      {shots.length > 1 && (
        <div className="seatphoto__tabs seg">
          {shots.map((s, i) => (
            <button key={s.category} className={i === k ? 'on' : ''} onClick={() => setK(i)}>{CATEGORY_LABEL[s.category]}</button>
          ))}
        </div>
      )}
    </div>
  );
}
