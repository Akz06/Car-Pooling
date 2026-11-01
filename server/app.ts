import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { CATALOG } from '../shared/catalog.ts';
import { HttpError, createCore, tripStatus, type Crypto } from '../shared/core.ts';
import type { Db } from './db.ts';

export { tripStatus };

export const nodeCrypto: Crypto = {
  id: (prefix) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`,
  token: () => crypto.randomBytes(24).toString('hex'),
  hash: (password, salt = crypto.randomBytes(16).toString('hex')) => ({ hash: crypto.scryptSync(password, salt, 64).toString('hex'), salt }),
  equal: (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')),
};

/** Thin HTTP layer — all rules live in shared/core.ts. */
/** `extend` adds routes before the API's 404 handler (e.g. the image cache). */
export function createApp(db: Db, extend?: (app: express.Express) => void) {
  const core = createCore(db, nodeCrypto);
  const app = express();
  app.use(express.json({ limit: '3mb' }));

  const token = (req: Request) => req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const me = (req: Request) => core.userForToken(token(req));

  app.post('/api/auth/register', (req, res) => res.status(201).json(core.register(req.body)));
  app.post('/api/auth/login', (req, res) => res.json(core.login(req.body)));
  app.post('/api/auth/logout', (req, res) => { me(req); core.logout(token(req)); res.status(204).end(); });
  app.get('/api/auth/me', (req, res) => { const u = me(req); res.json({ id: u.id, name: u.name, gender: u.gender, rating: u.rating }); });

  app.get('/api/catalog', (_req, res) => res.json(CATALOG));

  app.get('/api/cars/mine', (req, res) => res.json(core.myCars(me(req))));
  app.post('/api/cars', (req, res) => res.status(201).json(core.addCar(me(req), req.body)));
  app.delete('/api/cars/:id', (req, res) => { core.deleteCar(me(req), req.params.id); res.status(204).end(); });

  app.get('/api/trips', (req, res) => res.json(core.listTrips(req.query)));
  app.get('/api/trips/mine', (req, res) => res.json(core.myTrips(me(req))));
  app.get('/api/trips/:id', (req, res) => res.json(core.getTrip(req.params.id)));
  app.post('/api/trips', (req, res) => res.status(201).json(core.createTrip(me(req), req.body)));
  app.post('/api/trips/:id/book', (req, res) => res.json(core.book(me(req), req.params.id, req.body?.seatId)));
  app.delete('/api/trips/:id/book', (req, res) => res.json(core.leave(me(req), req.params.id)));
  app.post('/api/trips/:id/cancel', (req, res) => res.json(core.cancel(me(req), req.params.id)));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  extend?.(app);

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof SyntaxError) return res.status(400).json({ error: 'Malformed JSON' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}
