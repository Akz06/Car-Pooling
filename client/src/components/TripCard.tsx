import { Link } from 'react-router-dom';
import { DRIVER_SEAT, allSeats } from '@shared/catalog';
import type { TripView } from '@shared/types';
import { CarView } from './CarView';
import { NumberPlate } from './NumberPlate';
import { CarPhotoThumb } from './CarPhotos';
import { resolveCar, carTitle } from '../lib/carParts';
import { initials, relative, rupees, when } from '../lib/format';
import { tripSeatStates } from '../lib/seats';
import { useAuth } from '../lib/auth';

export function SeatBar({ trip }: { trip: TripView }) {
  const { model } = resolveCar(trip.car);
  return (
    <div className="seatbar" aria-label="Seats">
      {allSeats(model).filter((s) => s === DRIVER_SEAT || trip.offeredSeats.includes(s)).map((s) => {
        if (s === DRIVER_SEAT) return <i key={s} className="drv" title={`Driver: ${trip.owner.name}`}>⎈</i>;
        const b = trip.bookings.find((x) => x.seatId === s);
        return b
          ? <i key={s} className={b.gender} title={`${s}: ${b.name}`}>{b.gender === 'M' ? '♂' : '♀'}</i>
          : <i key={s} className="free" title={`${s}: free`} />;
      })}
    </div>
  );
}

export function TripCard({ trip }: { trip: TripView }) {
  const { user } = useAuth();
  const { model, paint, interior } = resolveCar(trip.car);
  const t = when(trip.departAt);
  return (
    <Link to={`/trips/${trip.id}`} className="trip-card">
      <div className="trip-card__car">
        <div className="trip-card__badges">
          {trip.womenOnly && <span className="tag tag--pink">♀ Women only</span>}
          {trip.status === 'full' ? <span className="tag tag--red">Full</span> : <span className="tag tag--green">{trip.seatsLeft} seat{trip.seatsLeft === 1 ? '' : 's'} left</span>}
        </div>
        <CarView model={model} paint={paint} interior={interior} detail="lite" orientation="horizontal" seats={tripSeatStates(trip, user, null)} />
        <CarPhotoThumb model={model} ownPhoto={trip.car.photo} className="trip-card__photo" />
      </div>
      <div className="trip-card__body">
        <div className="trip-card__meta">
          <div>
            <b>{t.day}, {t.time}</b> <span className="muted">· {relative(trip.departAt)}</span>
          </div>
          <div className="price">{rupees(trip.pricePerSeat)}<small>{trip.pricePerSeat ? ' /seat' : ''}</small></div>
        </div>
        <div className="route">
          <div className="route__dots"><i /><b /><i /></div>
          <span>{trip.from}</span>
          <span>{trip.to}</span>
        </div>
        <div className="trip-card__meta">
          <div className="driver-line">
            <span className={`avatar avatar--${trip.owner.gender}`}>{initials(trip.owner.name)}</span>
            <div>
              {trip.owner.name} <span className={`g-${trip.owner.gender}`}>{trip.owner.gender === 'M' ? '♂' : '♀'}</span>
              <small>★ {trip.owner.rating.toFixed(1)} · {carTitle(model)} · {paint.name}</small>
            </div>
          </div>
          <NumberPlate plate={trip.car.plate} size="sm" />
        </div>
        <SeatBar trip={trip} />
      </div>
    </Link>
  );
}
