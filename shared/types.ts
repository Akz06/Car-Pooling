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
  /** Seating version (see CarModel.layouts); absent = the model's default. */
  layoutId?: string;
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

/** 'prepaid' = fixed price per seat; 'split' = spends are noted during the trip and shared at the end. */
export type PaymentMode = 'prepaid' | 'split';

export interface Expense {
  id: string;
  title: string;
  /** Whole rupees. */
  amount: number;
  paidBy: string;
  /** User ids sharing this spend equally (driver and/or passengers). */
  sharedWith: string[];
  addedBy: string;
  createdAt: string;
}

export interface Transfer { from: string; to: string; amount: number }

export interface Settlement {
  total: number;
  /** Positive = is owed money, negative = owes money. */
  balances: { userId: string; name: string; paid: number; share: number; net: number }[];
  transfers: Transfer[];
}

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
  /** Absent = 'prepaid' (older trips). */
  paymentMode?: PaymentMode;
  expenses?: Expense[];
  status: TripStatus;
  createdAt: string;
}

/** Trip as returned by the API: joined with car and owner. */
export interface TripView extends Trip {
  car: Car;
  owner: PublicUser;
  seatsLeft: number;
  /** Present for split-mode trips. */
  settlement?: Settlement;
}
