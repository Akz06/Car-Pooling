/**
 * All car-pooling business rules, independent of HTTP and of Node.
 * Used by the Express server (server/app.ts) and by the in-browser demo
 * backend (client/src/demo), so both enforce exactly the same rules.
 */
import { DRIVER_SEAT, allSeats, getModel, modelForCar } from './catalog.ts';
import type { Car, Expense, Gender, PublicUser, Settlement, Transfer, Trip, TripStatus, TripView } from './types.ts';

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

/** Works out each person's net balance and a small set of payments that settles everyone. */
export function settle(trip: Trip, owner: { id: string; name: string }): Settlement {
  const people = [{ userId: owner.id, name: owner.name }, ...trip.bookings.map((b) => ({ userId: b.userId, name: b.name }))];
  const paid = new Map<string, number>(people.map((p) => [p.userId, 0]));
  const share = new Map<string, number>(people.map((p) => [p.userId, 0]));
  let total = 0;
  for (const e of trip.expenses ?? []) {
    total += e.amount;
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + e.amount);
    const ids = e.sharedWith;
    if (ids.length === 0) continue;
    const base = Math.floor(e.amount / ids.length);
    let extra = e.amount - base * ids.length; // leftover rupees go to the first people
    for (const id of ids) {
      share.set(id, (share.get(id) ?? 0) + base + (extra-- > 0 ? 1 : 0));
    }
  }
  const nameOf = (id: string) => people.find((p) => p.userId === id)?.name ?? 'Former passenger';
  const ids = [...new Set([...paid.keys(), ...share.keys()])];
  const balances = ids.map((userId) => {
    const p = paid.get(userId) ?? 0, s = share.get(userId) ?? 0;
    return { userId, name: nameOf(userId), paid: p, share: s, net: p - s };
  });
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ id: b.userId, left: b.net })).sort((a, b) => b.left - a.left);
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ id: b.userId, left: -b.net })).sort((a, b) => b.left - a.left);
  const transfers: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    if (amount > 0) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left === 0) i++;
    if (creditors[j].left === 0) j++;
  }
  return { total, balances, transfers };
}

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
    const settlement = trip.paymentMode === 'split' ? settle(trip, owner) : undefined;
    return { ...trip, status: tripStatus(trip), car, owner: publicUser(owner), seatsLeft: trip.offeredSeats.length - trip.bookings.length, settlement };
  };

  const participantIds = (trip: Trip) => [trip.ownerId, ...trip.bookings.map((b) => b.userId)];

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
     * 6-digit code. Returns where to send it (always the email, plus WhatsApp when
     * a mobile is saved), or null for unknown accounts — callers must answer the
     * same either way, so accounts can't be probed.
     */
    startReset(identifier: unknown, sixDigits: () => string): { email: string; phone?: string; code: string; name: string } | null {
      const id = String(identifier ?? '').trim().toLowerCase();
      if (!id) throw new HttpError(400, 'Enter your email or mobile number');
      let phone: string | undefined;
      try { if (!id.includes('@')) phone = normalisePhone(id); } catch { /* not a phone */ }
      const user = db.data.users.find((u) => (phone ? u.phone === phone : u.email === id));
      if (!user) return null;
      const now = Date.now();
      const recent = db.data.resets.filter((r) => r.userId === user.id && now - new Date(r.createdAt).getTime() < 15 * 60_000);
      if (recent.length >= RESET_MAX_PER_15_MIN) throw new HttpError(429, 'Too many codes requested — try again in 15 minutes');
      const code = sixDigits();
      const { hash, salt } = c.hash(code);
      db.write((d) => {
        d.resets = d.resets.filter((r) => new Date(r.expiresAt).getTime() > now - 15 * 60_000);
        d.resets.push({ userId: user.id, codeHash: hash, salt, attempts: 0, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + RESET_TTL_MS).toISOString() });
      });
      return { email: user.email, phone: user.phone, code, name: user.name };
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
      const layoutId = b.layoutId && b.layoutId !== 'default' ? String(b.layoutId) : undefined;
      if (layoutId && !model.layouts?.some((l) => l.id === layoutId)) throw new HttpError(400, 'Pick a seating version this model is sold with');
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
        id: c.id('car'), ownerId: user.id, modelId: model.id, layoutId, paintId: b.paintId, interiorId: b.interiorId, plate, year,
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
      const model = modelForCar(car)!;
      const from = str(b.from, 'Pickup', { min: 2, max: 80 });
      const to = str(b.to, 'Destination', { min: 2, max: 80 });
      if (from.toLowerCase() === to.toLowerCase()) throw new HttpError(400, 'Pickup and destination must differ');
      const departAt = new Date(String(b.departAt));
      if (Number.isNaN(departAt.getTime())) throw new HttpError(400, 'Enter a valid departure date');
      if (departAt.getTime() < Date.now() && b.pastTrip !== true) throw new HttpError(400, 'Departure must be in the future (or mark it as an old trip)');
      const paymentMode = b.paymentMode === 'split' ? 'split' : 'prepaid';
      const price = paymentMode === 'split' ? 0 : Number(b.pricePerSeat);
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
        paymentMode, expenses: [],
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

    /** Driver or any booked passenger notes a spend and picks who shares it. */
    addExpense(user: UserRecord, tripId: unknown, b: Body) {
      const trip = findTrip(tripId);
      if (trip.paymentMode !== 'split') throw new HttpError(400, 'This trip uses upfront payment');
      if (tripStatus(trip) === 'cancelled') throw new HttpError(409, 'This trip was cancelled');
      const members = participantIds(trip);
      if (!members.includes(user.id)) throw new HttpError(403, 'Only people on this trip can add spends');
      const title = str(b?.title, 'What was it for', { min: 2, max: 60 });
      const amount = Math.round(Number(b?.amount));
      if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000) throw new HttpError(400, 'Enter a valid amount');
      const paidBy = String(b?.paidBy ?? user.id);
      if (!members.includes(paidBy)) throw new HttpError(400, 'Payer must be on this trip');
      const sharedWith: string[] = Array.isArray(b?.sharedWith) ? [...new Set<string>(b.sharedWith.map(String))] : [];
      if (sharedWith.length === 0) throw new HttpError(400, 'Choose at least one person to split with');
      if (sharedWith.some((id) => !members.includes(id))) throw new HttpError(400, 'Everyone in the split must be on this trip');
      const expense: Expense = { id: c.id('exp'), title, amount, paidBy, sharedWith, addedBy: user.id, createdAt: new Date().toISOString() };
      db.write(() => { (trip.expenses ??= []).push(expense); });
      return viewTrip(trip);
    },

    removeExpense(user: UserRecord, tripId: unknown, expenseId: unknown) {
      const trip = findTrip(tripId);
      const e = trip.expenses?.find((x) => x.id === expenseId);
      if (!e) throw new HttpError(404, 'Spend not found');
      if (e.addedBy !== user.id && trip.ownerId !== user.id) throw new HttpError(403, 'Only the person who added it or the driver can remove it');
      db.write(() => { trip.expenses = trip.expenses!.filter((x) => x.id !== e.id); });
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
