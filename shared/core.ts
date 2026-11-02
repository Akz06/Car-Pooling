/**
 * All car-pooling business rules, independent of HTTP and of Node.
 * Used by the Express server (server/app.ts) and by the in-browser demo
 * backend (client/src/demo), so both enforce exactly the same rules.
 */
import { DRIVER_SEAT, allSeats, getModel } from './catalog.ts';
import type { Car, Gender, PublicUser, Trip, TripStatus, TripView } from './types.ts';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  gender: Gender;
  passwordHash: string;
  salt: string;
  rating: number;
  createdAt: string;
  /** Mobile number in +<country><number> form; used for WhatsApp password reset codes. */
  phone?: string;
}

/** A pending password reset: only a hash of the code is stored. */
export interface ResetRecord {
  userId: string;
  codeHash: string;
  salt: string;
  expiresAt: string;
  attempts: number;
  createdAt: string;
}

export interface DbShape {
  users: UserRecord[];
  sessions: { token: string; userId: string; createdAt: string }[];
  cars: Car[];
  trips: Trip[];
  resets: ResetRecord[];
}

export interface Store {
  data: DbShape;
  write<T>(mutate: (d: DbShape) => T): T;
}

export interface Crypto {
  id(prefix: string): string;
  token(): string;
  hash(password: string, salt?: string): { hash: string; salt: string };
  /** Constant-time compare where available. */
  equal(a: string, b: string): boolean;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const emptyDb = (): DbShape => ({ users: [], sessions: [], cars: [], trips: [], resets: [] });

export const publicUser = (u: UserRecord): PublicUser => ({ id: u.id, name: u.name, gender: u.gender, rating: u.rating });

/** Normalises an Indian or international mobile number to +<digits>; throws if it isn't one. */
export function normalisePhone(v: unknown): string {
  const raw = String(v ?? '').replace(/[\s()-]/g, '');
  const digits = raw.replace(/^\+/, '');
  if (!/^\d+$/.test(digits)) throw new HttpError(400, 'Enter a valid mobile number');
  if (!raw.startsWith('+') && digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`; // Indian mobile
  if (!raw.startsWith('+') && digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (raw.startsWith('+') && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  throw new HttpError(400, 'Enter a 10-digit mobile number (or include the country code, e.g. +91…)');
}

const RESET_TTL_MS = 10 * 60_000;
const RESET_MAX_ATTEMPTS = 5;
const RESET_MAX_PER_15_MIN = 3;

function str(v: unknown, field: string, { min = 1, max = 200 } = {}): string {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) {
    throw new HttpError(400, `${field} must be ${min}-${max} characters`);
  }
  return v.trim();
}

/** Status is derived, so it can never drift out of sync with bookings or the clock. */
export function tripStatus(trip: Trip, now = Date.now()): TripStatus {
  if (trip.status === 'cancelled') return 'cancelled';
  if (new Date(trip.departAt).getTime() < now) return 'departed';
  return trip.bookings.length >= trip.offeredSeats.length ? 'full' : 'open';
}

const live = (t: Trip) => ['open', 'full'].includes(tripStatus(t));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = Record<string, any>;

export function createCore(db: Store, c: Crypto) {
  const startSession = (user: UserRecord) => {
    const token = c.token();
    db.write((d) => d.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() }));
    return { token, user: publicUser(user) };
  };

  const viewTrip = (trip: Trip): TripView => {
    const car = db.data.cars.find((x) => x.id === trip.carId)!;
    const owner = db.data.users.find((u) => u.id === trip.ownerId)!;
    return { ...trip, status: tripStatus(trip), car, owner: publicUser(owner), seatsLeft: trip.offeredSeats.length - trip.bookings.length };
  };

  const findTrip = (tripId: unknown) => {
    const trip = db.data.trips.find((t) => t.id === tripId);
    if (!trip) throw new HttpError(404, 'Trip not found');
    return trip;
  };

  return {
    userForToken(token: string | undefined | null): UserRecord {
      const session = token ? db.data.sessions.find((s) => s.token === token) : undefined;
      const user = session && db.data.users.find((u) => u.id === session.userId);
      if (!user) throw new HttpError(401, 'Please sign in');
      return user;
    },

    register(b: Body) {
      const name = str(b?.name, 'Name', { min: 2, max: 60 });
      const email = str(b?.email, 'Email', { min: 5, max: 120 }).toLowerCase();
      const password = str(b?.password, 'Password', { min: 6, max: 200 });
      const gender = b?.gender as Gender;
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
      if (gender !== 'M' && gender !== 'F') throw new HttpError(400, 'Select gender (M or F) — it is shown on your booked seat');
      if (db.data.users.some((u) => u.email === email)) throw new HttpError(409, 'An account with this email already exists');
      const phone = b?.phone ? normalisePhone(b.phone) : undefined;
      if (phone && db.data.users.some((u) => u.phone === phone)) throw new HttpError(409, 'This mobile number is already on another account');
      const { hash, salt } = c.hash(password);
      const user: UserRecord = { id: c.id('usr'), name, email, gender, phone, passwordHash: hash, salt, rating: 5, createdAt: new Date().toISOString() };
      db.write((d) => d.users.push(user));
      return startSession(user);
    },

    login(b: Body) {
      const email = String(b?.email ?? '').trim().toLowerCase();
      const user = db.data.users.find((u) => u.email === email);
      if (!user || !c.equal(c.hash(String(b?.password ?? ''), user.salt).hash, user.passwordHash)) {
        throw new HttpError(401, 'Wrong email or password');
      }
      return startSession(user);
    },

    /** Owner updates their own name / mobile number. */
    updateMe(user: UserRecord, b: Body) {
      const name = b?.name !== undefined ? str(b.name, 'Name', { min: 2, max: 60 }) : user.name;
      const phone = b?.phone === '' || b?.phone === null ? undefined : b?.phone !== undefined ? normalisePhone(b.phone) : user.phone;
      if (phone && db.data.users.some((u) => u.phone === phone && u.id !== user.id)) throw new HttpError(409, 'This mobile number is already on another account');
      db.write((d) => {
        const u = d.users.find((x) => x.id === user.id)!;
        u.name = name;
        u.phone = phone;
      });
      return { ...publicUser(user), name, phone };
    },

    /**
     * Step 1 of "forgot password": find the account by email or mobile and make a
     * 6-digit code. Returns where to send it, or null when there's nowhere to send
     * (callers must answer the same either way, so accounts can't be probed).
     */
    startReset(identifier: unknown, sixDigits: () => string): { phone: string; code: string; name: string } | null {
      const id = String(identifier ?? '').trim().toLowerCase();
      if (!id) throw new HttpError(400, 'Enter your email or mobile number');
      let phone: string | undefined;
      try { if (!id.includes('@')) phone = normalisePhone(id); } catch { /* not a phone */ }
      const user = db.data.users.find((u) => (phone ? u.phone === phone : u.email === id));
      if (!user?.phone) return null;
      const now = Date.now();
      const recent = db.data.resets.filter((r) => r.userId === user.id && now - new Date(r.createdAt).getTime() < 15 * 60_000);
      if (recent.length >= RESET_MAX_PER_15_MIN) throw new HttpError(429, 'Too many codes requested — try again in 15 minutes');
      const code = sixDigits();
      const { hash, salt } = c.hash(code);
      db.write((d) => {
        d.resets = d.resets.filter((r) => new Date(r.expiresAt).getTime() > now - 15 * 60_000);
        d.resets.push({ userId: user.id, codeHash: hash, salt, attempts: 0, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + RESET_TTL_MS).toISOString() });
      });
      return { phone: user.phone, code, name: user.name };
    },

    /** Step 2: check the code, set the new password, sign out other devices, sign in here. */
    finishReset(identifier: unknown, code: unknown, password: unknown) {
      const id = String(identifier ?? '').trim().toLowerCase();
      let phone: string | undefined;
      try { if (!id.includes('@')) phone = normalisePhone(id); } catch { /* not a phone */ }
      const user = db.data.users.find((u) => (phone ? u.phone === phone : u.email === id));
      const fail = new HttpError(400, 'That code is wrong or has expired');
      if (!user) throw fail;
      const newPassword = str(password, 'Password', { min: 6, max: 200 });
      const pending = db.data.resets
        .filter((r) => r.userId === user.id && new Date(r.expiresAt).getTime() > Date.now() && r.attempts < RESET_MAX_ATTEMPTS)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!pending) throw fail;
      const ok = c.equal(c.hash(String(code ?? '').trim(), pending.salt).hash, pending.codeHash);
      if (!ok) {
        db.write(() => { pending.attempts += 1; });
        throw fail;
      }
      const { hash, salt } = c.hash(newPassword);
      db.write((d) => {
        const u = d.users.find((x) => x.id === user.id)!;
        u.passwordHash = hash;
        u.salt = salt;
        d.sessions = d.sessions.filter((s) => s.userId !== user.id);
        d.resets = d.resets.filter((r) => r.userId !== user.id);
      });
      return startSession(user);
    },

    logout(token: string | undefined) {
      db.write((d) => (d.sessions = d.sessions.filter((s) => s.token !== token)));
    },

    myCars: (user: UserRecord) => db.data.cars.filter((x) => x.ownerId === user.id),

    addCar(user: UserRecord, b: Body) {
      const model = getModel(String(b?.modelId));
      if (!model) throw new HttpError(400, 'Unknown car model');
      if (!model.paints.some((p) => p.id === b.paintId)) throw new HttpError(400, 'Pick a factory paint for this model');
      if (!model.interiors.some((i) => i.id === b.interiorId)) throw new HttpError(400, 'Pick an interior trim for this model');
      const plate = str(b.plate, 'Number plate', { min: 4, max: 15 }).toUpperCase();
      const year = Number(b.year);
      const thisYear = new Date().getFullYear();
      if (!Number.isInteger(year) || year < 1990 || year > thisYear + 1) throw new HttpError(400, 'Enter a valid model year');
      if (b.photo !== undefined && (typeof b.photo !== 'string' || !b.photo.startsWith('data:image/') || b.photo.length > 2_500_000)) {
        throw new HttpError(400, 'Photo must be an image under ~2 MB');
      }
      if (db.data.cars.some((x) => x.plate.replace(/\s/g, '') === plate.replace(/\s/g, ''))) {
        throw new HttpError(409, 'A car with this number plate is already registered');
      }
      const car: Car = {
        id: c.id('car'), ownerId: user.id, modelId: model.id, paintId: b.paintId, interiorId: b.interiorId, plate, year,
        nickname: typeof b.nickname === 'string' && b.nickname.trim() ? b.nickname.trim().slice(0, 40) : undefined,
        photo: b.photo, createdAt: new Date().toISOString(),
      };
      db.write((d) => d.cars.push(car));
      return car;
    },

    deleteCar(user: UserRecord, carId: unknown) {
      const car = db.data.cars.find((x) => x.id === carId && x.ownerId === user.id);
      if (!car) throw new HttpError(404, 'Car not found');
      if (db.data.trips.some((t) => t.carId === car.id && live(t))) throw new HttpError(409, 'This car has upcoming trips — cancel them first');
      db.write((d) => (d.cars = d.cars.filter((x) => x.id !== car.id)));
    },

    listTrips(q: { from?: unknown; to?: unknown; date?: unknown }) {
      const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
      const from = norm(q.from), to = norm(q.to), date = norm(q.date);
      return db.data.trips
        .filter(live)
        .filter((t) => !from || t.from.toLowerCase().includes(from))
        .filter((t) => !to || t.to.toLowerCase().includes(to))
        .filter((t) => !date || t.departAt.slice(0, 10) === date)
        .sort((a, b) => a.departAt.localeCompare(b.departAt))
        .map(viewTrip);
    },

    myTrips(user: UserRecord) {
      const byTime = (a: Trip, b: Trip) => b.departAt.localeCompare(a.departAt);
      return {
        driving: db.data.trips.filter((t) => t.ownerId === user.id).sort(byTime).map(viewTrip),
        riding: db.data.trips.filter((t) => t.bookings.some((b) => b.userId === user.id)).sort(byTime).map(viewTrip),
      };
    },

    getTrip: (tripId: unknown) => viewTrip(findTrip(tripId)),

    createTrip(user: UserRecord, b: Body) {
      const car = db.data.cars.find((x) => x.id === b?.carId && x.ownerId === user.id);
      if (!car) throw new HttpError(400, 'Choose one of your own cars');
      const model = getModel(car.modelId)!;
      const from = str(b.from, 'Pickup', { min: 2, max: 80 });
      const to = str(b.to, 'Destination', { min: 2, max: 80 });
      if (from.toLowerCase() === to.toLowerCase()) throw new HttpError(400, 'Pickup and destination must differ');
      const departAt = new Date(String(b.departAt));
      if (Number.isNaN(departAt.getTime()) || departAt.getTime() < Date.now()) throw new HttpError(400, 'Departure must be in the future');
      const price = Number(b.pricePerSeat);
      if (!Number.isFinite(price) || price < 0 || price > 20000) throw new HttpError(400, 'Price per seat must be between 0 and 20000');
      const valid = allSeats(model).filter((s) => s !== DRIVER_SEAT);
      const offered: string[] = Array.isArray(b.offeredSeats) ? [...new Set<string>(b.offeredSeats.map(String))] : valid;
      if (offered.length === 0 || offered.some((s) => !valid.includes(s))) throw new HttpError(400, 'Offer at least one valid passenger seat');
      const clash = db.data.trips.find((t) => t.carId === car.id && live(t) && Math.abs(new Date(t.departAt).getTime() - departAt.getTime()) < 2 * 3600_000);
      if (clash) throw new HttpError(409, `This car already has a trip ${clash.from} → ${clash.to} within 2 hours of that time`);
      if (b.womenOnly && user.gender !== 'F') throw new HttpError(400, 'Only women drivers can publish a women-only trip');
      const trip: Trip = {
        id: c.id('trp'), ownerId: user.id, carId: car.id, from, to, departAt: departAt.toISOString(), pricePerSeat: Math.round(price),
        notes: typeof b.notes === 'string' ? b.notes.trim().slice(0, 300) || undefined : undefined,
        womenOnly: Boolean(b.womenOnly), offeredSeats: allSeats(model).filter((s) => offered.includes(s)),
        bookings: [], status: 'open', createdAt: new Date().toISOString(),
      };
      db.write((d) => d.trips.push(trip));
      return viewTrip(trip);
    },

    book(user: UserRecord, tripId: unknown, seatIdIn: unknown) {
      const trip = findTrip(tripId);
      const seatId = String(seatIdIn ?? '');
      const status = tripStatus(trip);
      if (status !== 'open') throw new HttpError(409, `This trip is ${status}`);
      if (trip.ownerId === user.id) throw new HttpError(400, "You're driving this trip");
      if (trip.womenOnly && user.gender !== 'F') throw new HttpError(403, 'This is a women-only trip');
      if (!trip.offeredSeats.includes(seatId)) throw new HttpError(400, 'That seat is not offered on this trip');
      if (trip.bookings.some((x) => x.userId === user.id)) throw new HttpError(409, 'You already have a seat on this trip');
      if (trip.bookings.some((x) => x.seatId === seatId)) throw new HttpError(409, 'Someone just took that seat — pick another');
      db.write(() => trip.bookings.push({ seatId, userId: user.id, name: user.name, gender: user.gender, bookedAt: new Date().toISOString() }));
      return viewTrip(trip);
    },

    leave(user: UserRecord, tripId: unknown) {
      const trip = findTrip(tripId);
      if (!trip.bookings.some((x) => x.userId === user.id)) throw new HttpError(404, "You don't have a seat on this trip");
      if (tripStatus(trip) === 'departed') throw new HttpError(409, 'This trip has already departed');
      db.write(() => (trip.bookings = trip.bookings.filter((x) => x.userId !== user.id)));
      return viewTrip(trip);
    },

    cancel(user: UserRecord, tripId: unknown) {
      const trip = findTrip(tripId);
      if (trip.ownerId !== user.id) throw new HttpError(403, 'Only the driver can cancel this trip');
      if (tripStatus(trip) === 'departed') throw new HttpError(409, 'This trip has already departed');
      db.write(() => (trip.status = 'cancelled'));
      return viewTrip(trip);
    },
  };
}

export type Core = ReturnType<typeof createCore>;
