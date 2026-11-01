import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { CATALOG, DRIVER_SEAT, allSeats, getModel } from '../shared/catalog.ts';
import type { Car, Gender, PublicUser, Trip, TripStatus, TripView } from '../shared/types.ts';
import type { Db, UserRecord } from './db.ts';

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const id = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password: string, user: UserRecord) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
}

const publicUser = (u: UserRecord): PublicUser => ({ id: u.id, name: u.name, gender: u.gender, rating: u.rating });

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

export function createApp(db: Db) {
  const app = express();
  app.use(express.json({ limit: '3mb' }));

  type AuthedRequest = Request & { user?: UserRecord };

  const auth = (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const session = token && db.data.sessions.find((s) => s.token === token);
    const user = session && db.data.users.find((u) => u.id === session.userId);
    if (!user) return next(new HttpError(401, 'Please sign in'));
    req.user = user;
    next();
  };
  const me = (req: AuthedRequest) => req.user!;

  const startSession = (user: UserRecord) => {
    const token = crypto.randomBytes(24).toString('hex');
    db.write((d) => d.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() }));
    return { token, user: publicUser(user) };
  };

  const viewTrip = (trip: Trip): TripView => {
    const car = db.data.cars.find((c) => c.id === trip.carId)!;
    const owner = db.data.users.find((u) => u.id === trip.ownerId)!;
    return {
      ...trip,
      status: tripStatus(trip),
      car,
      owner: publicUser(owner),
      seatsLeft: trip.offeredSeats.length - trip.bookings.length,
    };
  };

  const findTrip = (tripId: unknown) => {
    const trip = db.data.trips.find((t) => t.id === tripId);
    if (!trip) throw new HttpError(404, 'Trip not found');
    return trip;
  };

  // ---------- auth ----------
  app.post('/api/auth/register', (req, res) => {
    const name = str(req.body?.name, 'Name', { min: 2, max: 60 });
    const email = str(req.body?.email, 'Email', { min: 5, max: 120 }).toLowerCase();
    const password = str(req.body?.password, 'Password', { min: 6, max: 200 });
    const gender = req.body?.gender as Gender;
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
    if (gender !== 'M' && gender !== 'F') throw new HttpError(400, 'Select gender (M or F) — it is shown on your booked seat');
    if (db.data.users.some((u) => u.email === email)) throw new HttpError(409, 'An account with this email already exists');
    const { hash, salt } = hashPassword(password);
    const user: UserRecord = { id: id('usr'), name, email, gender, passwordHash: hash, salt, rating: 5, createdAt: new Date().toISOString() };
    db.write((d) => d.users.push(user));
    res.status(201).json(startSession(user));
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const user = db.data.users.find((u) => u.email === email);
    if (!user || !verifyPassword(String(req.body?.password ?? ''), user)) throw new HttpError(401, 'Wrong email or password');
    res.json(startSession(user));
  });

  app.post('/api/auth/logout', auth, (req, res) => {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    db.write((d) => (d.sessions = d.sessions.filter((s) => s.token !== token)));
    res.status(204).end();
  });

  app.get('/api/auth/me', auth, (req, res) => res.json(publicUser(me(req))));

  // ---------- catalog ----------
  app.get('/api/catalog', (_req, res) => res.json(CATALOG));

  // ---------- cars ----------
  app.get('/api/cars/mine', auth, (req, res) => {
    res.json(db.data.cars.filter((c) => c.ownerId === me(req).id));
  });

  app.post('/api/cars', auth, (req, res) => {
    const b = req.body ?? {};
    const model = getModel(String(b.modelId));
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
    if (db.data.cars.some((c) => c.plate.replace(/\s/g, '') === plate.replace(/\s/g, ''))) {
      throw new HttpError(409, 'A car with this number plate is already registered');
    }
    const car: Car = {
      id: id('car'),
      ownerId: me(req).id,
      modelId: model.id,
      paintId: b.paintId,
      interiorId: b.interiorId,
      plate,
      year,
      nickname: typeof b.nickname === 'string' && b.nickname.trim() ? b.nickname.trim().slice(0, 40) : undefined,
      photo: b.photo,
      createdAt: new Date().toISOString(),
    };
    db.write((d) => d.cars.push(car));
    res.status(201).json(car);
  });

  app.delete('/api/cars/:id', auth, (req, res) => {
    const car = db.data.cars.find((c) => c.id === req.params.id && c.ownerId === me(req).id);
    if (!car) throw new HttpError(404, 'Car not found');
    const active = db.data.trips.some((t) => t.carId === car.id && ['open', 'full'].includes(tripStatus(t)));
    if (active) throw new HttpError(409, 'This car has upcoming trips — cancel them first');
    db.write((d) => (d.cars = d.cars.filter((c) => c.id !== car.id)));
    res.status(204).end();
  });

  // ---------- trips ----------
  app.get('/api/trips', (req, res) => {
    const q = (v: unknown) => String(v ?? '').trim().toLowerCase();
    const from = q(req.query.from);
    const to = q(req.query.to);
    const date = q(req.query.date);
    const trips = db.data.trips
      .filter((t) => ['open', 'full'].includes(tripStatus(t)))
      .filter((t) => !from || t.from.toLowerCase().includes(from))
      .filter((t) => !to || t.to.toLowerCase().includes(to))
      .filter((t) => !date || t.departAt.slice(0, 10) === date)
      .sort((a, b) => a.departAt.localeCompare(b.departAt))
      .map(viewTrip);
    res.json(trips);
  });

  app.get('/api/trips/mine', auth, (req, res) => {
    const uid = me(req).id;
    const byTime = (a: Trip, b: Trip) => b.departAt.localeCompare(a.departAt);
    res.json({
      driving: db.data.trips.filter((t) => t.ownerId === uid).sort(byTime).map(viewTrip),
      riding: db.data.trips.filter((t) => t.bookings.some((b) => b.userId === uid)).sort(byTime).map(viewTrip),
    });
  });

  app.get('/api/trips/:id', (req, res) => res.json(viewTrip(findTrip(req.params.id))));

  app.post('/api/trips', auth, (req, res) => {
    const b = req.body ?? {};
    const user = me(req);
    const car = db.data.cars.find((c) => c.id === b.carId && c.ownerId === user.id);
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
    const offered: string[] = Array.isArray(b.offeredSeats) ? [...new Set(b.offeredSeats.map(String))] as string[] : valid;
    if (offered.length === 0 || offered.some((s) => !valid.includes(s))) throw new HttpError(400, 'Offer at least one valid passenger seat');
    const clash = db.data.trips.find(
      (t) => t.carId === car.id && ['open', 'full'].includes(tripStatus(t)) &&
        Math.abs(new Date(t.departAt).getTime() - departAt.getTime()) < 2 * 3600_000,
    );
    if (clash) throw new HttpError(409, `This car already has a trip ${clash.from} → ${clash.to} within 2 hours of that time`);
    const trip: Trip = {
      id: id('trp'),
      ownerId: user.id,
      carId: car.id,
      from,
      to,
      departAt: departAt.toISOString(),
      pricePerSeat: Math.round(price),
      notes: typeof b.notes === 'string' ? b.notes.trim().slice(0, 300) || undefined : undefined,
      womenOnly: Boolean(b.womenOnly),
      offeredSeats: allSeats(model).filter((s) => offered.includes(s)),
      bookings: [],
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    if (trip.womenOnly && user.gender !== 'F') throw new HttpError(400, 'Only women drivers can publish a women-only trip');
    db.write((d) => d.trips.push(trip));
    res.status(201).json(viewTrip(trip));
  });

  app.post('/api/trips/:id/book', auth, (req, res) => {
    const user = me(req);
    const trip = findTrip(req.params.id);
    const seatId = String(req.body?.seatId ?? '');
    const status = tripStatus(trip);
    if (status !== 'open') throw new HttpError(409, `This trip is ${status}`);
    if (trip.ownerId === user.id) throw new HttpError(400, "You're driving this trip");
    if (trip.womenOnly && user.gender !== 'F') throw new HttpError(403, 'This is a women-only trip');
    if (!trip.offeredSeats.includes(seatId)) throw new HttpError(400, 'That seat is not offered on this trip');
    if (trip.bookings.some((b) => b.userId === user.id)) throw new HttpError(409, 'You already have a seat on this trip');
    if (trip.bookings.some((b) => b.seatId === seatId)) throw new HttpError(409, 'Someone just took that seat — pick another');
    db.write(() => trip.bookings.push({ seatId, userId: user.id, name: user.name, gender: user.gender, bookedAt: new Date().toISOString() }));
    res.json(viewTrip(trip));
  });

  app.delete('/api/trips/:id/book', auth, (req, res) => {
    const user = me(req);
    const trip = findTrip(req.params.id);
    if (!trip.bookings.some((b) => b.userId === user.id)) throw new HttpError(404, "You don't have a seat on this trip");
    if (tripStatus(trip) === 'departed') throw new HttpError(409, 'This trip has already departed');
    db.write(() => (trip.bookings = trip.bookings.filter((b) => b.userId !== user.id)));
    res.json(viewTrip(trip));
  });

  app.post('/api/trips/:id/cancel', auth, (req, res) => {
    const trip = findTrip(req.params.id);
    if (trip.ownerId !== me(req).id) throw new HttpError(403, 'Only the driver can cancel this trip');
    if (tripStatus(trip) === 'departed') throw new HttpError(409, 'This trip has already departed');
    db.write(() => (trip.status = 'cancelled'));
    res.json(viewTrip(trip));
  });

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof SyntaxError) return res.status(400).json({ error: 'Malformed JSON' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}
