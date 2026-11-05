/**
 * In-browser backend for the shareable demo build (VITE_DEMO=1).
 * Runs the exact same rules as the server (shared/core.ts) against a
 * localStorage store, so the app works where no server can run.
 * NOT secure — passwords are only lightly hashed and data lives on one device.
 */
import { CATALOG } from '@shared/catalog';
import { HttpError, createCore, emptyDb, type Crypto, type DbShape, type Store } from '@shared/core';
import { seed } from '@shared/seed';

const KEY = 'seatshare.demo.db.v1';

const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
function weakHash(s: string) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return ((h2 >>> 0).toString(16) + (h1 >>> 0).toString(16)).padStart(16, '0');
}

const browserCrypto: Crypto = {
  id: (p) => `${p}_${hex(6)}`,
  token: () => hex(24),
  hash: (pw, salt = hex(8)) => ({ hash: weakHash(salt + pw), salt }),
  equal: (a, b) => a === b,
};

function load(): DbShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyDb(), ...JSON.parse(raw) };
  } catch { /* storage unavailable — run in memory */ }
  return emptyDb();
}

const store: Store = {
  data: load(),
  write(mutate) {
    const r = mutate(this.data);
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* in-memory only */ }
    return r;
  },
};
seed(store, browserCrypto);
const core = createCore(store, browserCrypto);

export function resetDemo() {
  store.data = emptyDb();
  try { localStorage.removeItem(KEY); localStorage.removeItem('seatshare.token'); } catch { /* ignore */ }
  seed(store, browserCrypto);
}

/** Mirrors server/app.ts routes. */
export async function demoRequest(method: string, path: string, body: unknown, token: string | null): Promise<{ status: number; data: unknown }> {
  const url = new URL(path, 'http://demo');
  const parts = url.pathname.split('/').filter(Boolean); // e.g. ['trips', id, 'book']
  const me = () => core.userForToken(token);
  const b = (body ?? {}) as Record<string, unknown>;
  await new Promise((r) => setTimeout(r, 120)); // feel like a network call
  try {
    const route = `${method} /${parts.map((p, i) => ((i === 1 && !['mine', 'register', 'login', 'logout', 'me'].includes(p)) || (i === 3 && parts[2] === 'expenses') ? ':id' : p)).join('/')}`;
    const id = parts[1];
    switch (route) {
      case 'POST /auth/register': return { status: 201, data: core.register(b) };
      case 'POST /auth/login': return { status: 200, data: core.login(b) };
      case 'POST /auth/logout': me(); core.logout(token ?? undefined); return { status: 204, data: undefined };
      case 'GET /auth/me': { const u = me(); return { status: 200, data: { id: u.id, name: u.name, gender: u.gender, rating: u.rating } }; }
      case 'GET /users': return { status: 200, data: core.myUsers(me()) };
      case 'POST /users': return { status: 201, data: core.addUser(me(), b) };
      case 'GET /catalog': return { status: 200, data: CATALOG };
      case 'GET /cars/mine': return { status: 200, data: core.myCars(me()) };
      case 'POST /cars': return { status: 201, data: core.addCar(me(), b) };
      case 'DELETE /cars/:id': core.deleteCar(me(), id); return { status: 204, data: undefined };
      case 'GET /trips': return { status: 200, data: core.listTrips(Object.fromEntries(url.searchParams)) };
      case 'GET /trips/mine': return { status: 200, data: core.myTrips(me()) };
      case 'GET /trips/:id': return { status: 200, data: core.getTrip(id) };
      case 'POST /trips': return { status: 201, data: core.createTrip(me(), b) };
      case 'PATCH /trips/:id': return { status: 200, data: core.updateTrip(me(), id, b) };
      case 'POST /trips/:id/book': return { status: 200, data: core.book(me(), id, b.seatId) };
      case 'DELETE /trips/:id/book': return { status: 200, data: core.leave(me(), id) };
      case 'POST /trips/:id/expenses': return { status: 201, data: core.addExpense(me(), id, b) };
      case 'DELETE /trips/:id/expenses/:id': return { status: 200, data: core.removeExpense(me(), id, parts[3]) };
      case 'POST /trips/:id/cancel': return { status: 200, data: core.cancel(me(), id) };
      default: return { status: 404, data: { error: 'Not found' } };
    }
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, data: { error: e.message } };
    throw e;
  }
}
