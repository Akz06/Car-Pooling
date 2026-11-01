import { DRIVER_SEAT, allSeats, getModel, seatLabel } from '@shared/catalog';
import type { PublicUser, TripView } from '@shared/types';
import type { SeatState } from '../components/CarView';

export function tripSeatStates(trip: TripView, me: PublicUser | null, selected: string | null): Record<string, SeatState> {
  const model = getModel(trip.car.modelId)!;
  const out: Record<string, SeatState> = {};
  for (const seat of allSeats(model)) {
    const booking = trip.bookings.find((b) => b.seatId === seat);
    if (seat === DRIVER_SEAT) out[seat] = { status: 'driver', gender: trip.owner.gender, name: trip.owner.name };
    else if (booking) out[seat] = { status: me && booking.userId === me.id ? 'mine' : 'booked', gender: booking.gender, name: booking.name };
    else if (!trip.offeredSeats.includes(seat)) out[seat] = { status: 'unavailable' };
    else if (seat === selected) out[seat] = { status: 'selected' };
    else out[seat] = { status: trip.status === 'open' ? 'available' : 'unavailable' };
  }
  return out;
}

/** Seats that share a row with this one, nearest first — "who will I sit next to?" */
export function neighbours(trip: TripView, seatId: string) {
  const model = getModel(trip.car.modelId)!;
  const row = model.rows.find((r) => r.seats.includes(seatId));
  if (!row) return [];
  const i = row.seats.indexOf(seatId);
  const adjacent = row.kind === 'captain' ? [] : [row.seats[i - 1], row.seats[i + 1]].filter(Boolean);
  return adjacent.map((s) => {
    if (s === DRIVER_SEAT) return { seatId: s, label: seatLabel(s), name: trip.owner.name, gender: trip.owner.gender };
    const b = trip.bookings.find((x) => x.seatId === s);
    return { seatId: s, label: seatLabel(s), name: b?.name, gender: b?.gender };
  });
}
