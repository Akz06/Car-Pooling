export type Gender = 'M' | 'F';

export interface PublicUser {
  id: string;
  name: string;
  gender: Gender;
  /** Average driver rating, purely cosmetic for now. */
  rating: number;
}

export interface Car {
  id: string;
  ownerId: string;
  modelId: string;
  paintId: string;
  interiorId: string;
  plate: string;
  year: number;
  nickname?: string;
  /** Optional real photo of the owner's car (data URL, resized client-side). */
  photo?: string;
  createdAt: string;
}

export interface Booking {
  seatId: string;
  userId: string;
  name: string;
  gender: Gender;
  bookedAt: string;
}

export type TripStatus = 'open' | 'full' | 'departed' | 'cancelled';

export interface Trip {
  id: string;
  ownerId: string;
  carId: string;
  from: string;
  to: string;
  departAt: string;
  pricePerSeat: number;
  notes?: string;
  womenOnly: boolean;
  /** Seats the owner offers to passengers (driver seat is never offered). */
  offeredSeats: string[];
  bookings: Booking[];
  status: TripStatus;
  createdAt: string;
}

/** Trip as returned by the API: joined with car and owner. */
export interface TripView extends Trip {
  car: Car;
  owner: PublicUser;
  seatsLeft: number;
}
