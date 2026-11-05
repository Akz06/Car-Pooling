import type { Car, PublicUser, TripView } from '@shared/types';

const TOKEN_KEY = 'seatshare.token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  if (import.meta.env.VITE_DEMO) {
    const { demoRequest } = await import('../demo/backend');
    const r = await demoRequest(method, path, body, token);
    if (r.status >= 400) throw new ApiError(r.status, (r.data as { error: string }).error);
    return r.data as T;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

type Session = { token: string; user: PublicUser };
export type Me = PublicUser & { email?: string; phone?: string };

export const api = {
  register: (b: { name: string; email: string; password: string; gender: 'M' | 'F'; phone?: string }) => request<Session>('POST', '/auth/register', b),
  forgot: (identifier: string) => request<{ ok: boolean; message: string }>('POST', '/auth/forgot', { identifier }),
  reset: (b: { identifier: string; code: string; password: string }) => request<Session>('POST', '/auth/reset', b),
  updateMe: (b: { name?: string; phone?: string }) => request<Me>('PATCH', '/auth/me', b),
  login: (b: { email: string; password: string }) => request<Session>('POST', '/auth/login', b),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<Me>('GET', '/auth/me'),
  myCars: () => request<Car[]>('GET', '/cars/mine'),
  addCar: (b: Omit<Car, 'id' | 'ownerId' | 'createdAt'>) => request<Car>('POST', '/cars', b),
  deleteCar: (id: string) => request<void>('DELETE', `/cars/${id}`),
  trips: (q: { from?: string; to?: string; date?: string } = {}) =>
    request<TripView[]>('GET', `/trips?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`),
  trip: (id: string) => request<TripView>('GET', `/trips/${id}`),
  myTrips: () => request<{ driving: TripView[]; riding: TripView[] }>('GET', '/trips/mine'),
  addExpense: (id: string, b: { title: string; amount: number; paidBy: string; sharedWith: string[] }) => request<TripView>('POST', `/trips/${id}/expenses`, b),
  removeExpense: (id: string, eid: string) => request<TripView>('DELETE', `/trips/${id}/expenses/${eid}`),
  createTrip: (b: { carId: string; from: string; to: string; departAt: string; pricePerSeat: number; paymentMode: 'prepaid' | 'split'; offeredSeats: string[]; womenOnly: boolean; notes?: string }) =>
    request<TripView>('POST', '/trips', b),
  book: (id: string, seatId: string) => request<TripView>('POST', `/trips/${id}/book`, { seatId }),
  leave: (id: string) => request<TripView>('DELETE', `/trips/${id}/book`),
  cancel: (id: string) => request<TripView>('POST', `/trips/${id}/cancel`),
};
