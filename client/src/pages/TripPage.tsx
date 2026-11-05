import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DRIVER_SEAT, seatLabel } from '@shared/catalog';
import type { TripView } from '@shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { resolveCar, carTitle } from '../lib/carParts';
import { initials, relative, rupees, when } from '../lib/format';
import { neighbours, tripSeatStates } from '../lib/seats';
import { CarStage } from '../components/CarStage';
import { NumberPlate } from '../components/NumberPlate';
import { SeatLegend } from '../components/SeatLegend';
import { CarGallery } from '../components/CarPhotos';
import { ExpensePanel } from '../components/ExpensePanel';

export function TripPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [trip, setTrip] = useState<TripView | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    api.trip(id!).then(setTrip).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  if (error) return <div className="error">{error}</div>;
  if (!trip) return <div className="page-loading">Opening the doors…</div>;

  const { model, paint, interior } = resolveCar(trip.car);
  const isOwner = user?.id === trip.ownerId;
  const myBooking = user ? trip.bookings.find((b) => b.userId === user.id) : undefined;
  const t = when(trip.departAt);
  const focus = hover ?? selected ?? myBooking?.seatId ?? null;

  const whyNot = (): string | null => {
    if (!user) return 'Sign in to book a seat';
    if (isOwner) return "You're driving this one";
    if (myBooking) return `You already have ${myBooking.seatId} — leave it first to switch`;
    if (trip.status !== 'open') return `This trip is ${trip.status}`;
    if (trip.womenOnly && user.gender !== 'F') return 'This ride is for women only';
    return null;
  };

  const clickSeat = (seatId: string) => {
    if (!trip.offeredSeats.includes(seatId)) return setToast(`${seatId} isn't offered on this ride`);
    if (myBooking?.seatId === seatId) return setToast("That's your seat 👋");
    const reason = whyNot();
    if (reason) {
      if (!user) nav(`/login?next=/trips/${trip.id}`);
      setToast(reason);
      return;
    }
    setSelected((s) => (s === seatId ? null : seatId));
  };

  const act = async (fn: () => Promise<TripView>, msg: string) => {
    setBusy(true);
    try {
      const updated = await fn();
      setTrip(updated);
      setSelected(null);
      setToast(msg);
    } catch (e) {
      setToast((e as Error).message);
      api.trip(trip.id).then(setTrip).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const seats = tripSeatStates(trip, user, selected);
  const showMobileBook = !isOwner && !myBooking && trip.status === 'open';
  // Seats the viewer can't book still render green, but booking is explained via toast.
  const focusInfo = focus ? seats[focus] : null;
  const near = focus && focus !== DRIVER_SEAT ? neighbours(trip, focus) : [];

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t.day} · {t.time} · {relative(trip.departAt)}</p>
          <h1>{trip.from} → {trip.to}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="tag">{carTitle(model)} · {model.generation}</span>
            <NumberPlate plate={trip.car.plate} size="sm" />
            {trip.womenOnly && <span className="tag tag--pink">♀ Women only</span>}
            {trip.status === 'full' && <span className="tag tag--red">Full</span>}
            {trip.status === 'cancelled' && <span className="tag tag--red">Cancelled</span>}
            {trip.status === 'departed' && <span className="tag">Departed</span>}
          </div>
        </div>
        <Link to="/" className="btn btn--ghost btn--sm">← All rides</Link>
      </div>

      <div className="trip-layout">
        <div>
          <CarStage
            reveal
            plate={trip.car.plate}
            model={model}
            paint={paint}
            interior={interior}
            seats={seats}
            onSeatClick={clickSeat}
            onSeatHover={setHover}
            openDoorFor={focus && focus !== DRIVER_SEAT ? focus : null}
          >
            <SeatLegend />
          </CarStage>
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            {paint.name} {paint.finish} paint{paint.roof ? ' with contrast roof' : ''} · {interior.name} {interior.material.replace('-', ' ')} · drawn to scale from {model.lengthMm} × {model.widthMm} mm.
            Hover or tap a seat to open its door.
          </p>
        </div>

        <aside className="trip-side">
          <div className="panel">
            <div className="trip-card__meta">
              <div className="when"><b>{t.time}</b><span className="muted">{t.day}</span></div>
              <div className="price">{trip.paymentMode === 'split' ? <small>Split at end</small> : <>{rupees(trip.pricePerSeat)}<small>{trip.pricePerSeat ? ' /seat' : ''}</small></>}</div>
            </div>
            <div className="route" style={{ margin: '12px 0 16px' }}>
              <div className="route__dots"><i /><b /><i /></div>
              <span>{trip.from}</span>
              <span>{trip.to}</span>
            </div>

            <div className="seat-info">
              {focus && focusInfo ? (
                <>
                  <h5>{focus} · {seatLabel(focus)}</h5>
                  {focusInfo.status === 'driver' && <span>{trip.owner.name} is driving <span className={`g-${trip.owner.gender}`}>{trip.owner.gender === 'M' ? '♂' : '♀'}</span></span>}
                  {(focusInfo.status === 'booked' || focusInfo.status === 'mine') && (
                    <span>Taken by <b className={`g-${focusInfo.gender}`}>{focusInfo.gender === 'M' ? '♂' : '♀'} {focusInfo.status === 'mine' ? 'you' : focusInfo.name?.split(' ')[0]}</b></span>
                  )}
                  {(focusInfo.status === 'available' || focusInfo.status === 'selected') && <span className="g-free" style={{ color: '#86efac' }}>Free</span>}
                  {focusInfo.status === 'unavailable' && <span className="muted">Not offered on this ride</span>}
                  {near.length > 0 && (
                    <div className="neighbours">
                      <span className="muted" style={{ fontSize: 12 }}>Next to:</span>
                      {near.map((n) => (
                        <span key={n.seatId} className={`tag ${n.gender === 'F' ? 'tag--pink' : ''}`} style={n.gender === 'M' ? { background: 'rgba(47,124,246,.15)', color: '#93c5fd' } : undefined}>
                          {n.gender ? `${n.gender === 'M' ? '♂' : '♀'} ${n.name?.split(' ')[0]}` : `${n.seatId} empty`}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <span className="muted">{isOwner
                  ? "You're driving. Riders appear on their seats as they book — hover a seat for details."
                  : "Pick a green seat on the car. Hover any seat to see who you'd sit next to."}</span>
              )}
            </div>

            <div style={{ marginTop: 14 }} className={showMobileBook ? 'trip-action' : undefined}>
              {isOwner ? (
                trip.status === 'open' || trip.status === 'full' ? (
                  <>
                  <Link to={`/trips/${trip.id}/edit`} className="btn btn--block" style={{ marginBottom: 8 }}>Edit trip</Link>
                  <button className="btn btn--danger btn--block" disabled={busy} onBlur={() => setConfirmCancel(false)}
                    onClick={() => (confirmCancel ? act(() => api.cancel(trip.id), 'Trip cancelled') : setConfirmCancel(true))}>
                    {confirmCancel ? 'Tap again to cancel for everyone' : 'Cancel trip'}
                  </button>
                  </>
                ) : null
              ) : myBooking ? (
                <button className="btn btn--block" disabled={busy || trip.status === 'departed'} onClick={() => act(() => api.leave(trip.id), 'Seat released')}>
                  Leave seat {myBooking.seatId}
                </button>
              ) : (
                <button className="btn btn--primary btn--block" disabled={busy || !selected} onClick={() => selected && act(() => api.book(trip.id, selected), `Seat ${selected} booked — see you on board!`)}>
                  {selected ? `Book ${selected}${trip.paymentMode === 'split' ? '' : ` · ${rupees(trip.pricePerSeat)}`}` : whyNot() ?? 'Select a seat'}
                </button>
              )}
            </div>
          </div>

          <div className="panel">
            <h4 style={{ marginTop: 0 }}>Driver</h4>
            <div className="driver-line">
              <span className={`avatar avatar--lg avatar--${trip.owner.gender}`}>{initials(trip.owner.name)}</span>
              <div>
                <b>{trip.owner.name}</b> <span className={`g-${trip.owner.gender}`}>{trip.owner.gender === 'M' ? '♂' : '♀'}</span>
                <small>★ {trip.owner.rating.toFixed(1)} rating</small>
              </div>
            </div>
            {trip.notes && <p className="notes">{trip.notes}</p>}
            <h4>On board ({trip.bookings.length + 1}/{trip.offeredSeats.length + 1})</h4>
            <ul className="manifest">
              <li><span className={`avatar avatar--${trip.owner.gender}`}>{initials(trip.owner.name)}</span>{trip.owner.name}<small>{DRIVER_SEAT} · Driver</small></li>
              {trip.bookings.map((b) => (
                <li key={b.seatId}>
                  <span className={`avatar avatar--${b.gender}`}>{initials(b.name)}</span>
                  {b.userId === user?.id ? 'You' : b.name}
                  <small>{b.seatId} · {seatLabel(b.seatId)}</small>
                </li>
              ))}
            </ul>
          </div>

          {trip.paymentMode === 'split' && (
            <ExpensePanel
              key={`${trip.bookings.length}-${user?.id}`}
              trip={trip}
              userId={user?.id}
              onChange={(t) => setTrip(t)}
              onError={setToast}
            />
          )}

          <div className="panel">
            <div className="trip-card__meta"><h4 style={{ margin: 0 }}>The car</h4><Link to={`/cars/${model.id}`} className="link">All photos →</Link></div>
            <CarGallery model={model} ownPhoto={trip.car.photo} />
            <b>{trip.car.nickname ? `“${trip.car.nickname}” · ` : ''}{trip.car.year} {carTitle(model)}</b>
            <dl className="specs" style={{ margin: '10px 0 0' }}>
              <dt>Paint</dt><dd>{paint.name}</dd>
              <dt>Interior</dt><dd>{interior.name}</dd>
              <dt>Fuel</dt><dd>{model.fuel}</dd>
              <dt>Boot</dt><dd>{model.bootLitres} L</dd>
              <dt>Comfort</dt><dd>{model.features[0]}</dd>
            </dl>
          </div>
        </aside>
      </div>
      {showMobileBook && (
        <div className="mobile-book">
          <div>
            <b>{selected ? `${selected} · ${seatLabel(selected)}` : 'Tap a green seat'}</b>
            <small>{rupees(trip.pricePerSeat)}{trip.pricePerSeat ? ' per seat' : ''} · {trip.seatsLeft} left</small>
          </div>
          <button className="btn btn--primary" disabled={busy || !selected} onClick={() => selected && act(() => api.book(trip.id, selected), `Seat ${selected} booked — see you on board!`)}>
            {selected ? 'Book' : 'Select'}
          </button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
