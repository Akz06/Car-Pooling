import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from './app.ts';
import { Db } from './db.ts';

let server: Server;
let base = '';

before(async () => {
  server = createApp(new Db(null)).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
after(() => server.close());

async function call(method: string, url: string, body?: unknown, token?: string) {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

const register = async (name: string, gender: 'M' | 'F') =>
  (await call('POST', '/auth/register', { name, email: `${name.toLowerCase()}@t.in`, password: 'secret1', gender })).body.token as string;

test('owner creates a trip and passengers book gendered seats', async () => {
  const owner = await register('Asha', 'F');
  const man = await register('Ravi', 'M');
  const woman = await register('Leela', 'F');

  const car = await call('POST', '/cars', { modelId: 'mahindra-xuv700', paintId: 'red-rage', interiorId: 'black-ivory', plate: 'KA 01 AB 1234', year: 2024 }, owner);
  assert.equal(car.status, 201);

  const departAt = new Date(Date.now() + 86400_000).toISOString();
  const trip = await call('POST', '/trips', { carId: car.body.id, from: 'Pune', to: 'Mumbai', departAt, pricePerSeat: 500, offeredSeats: ['1L', '2L'] }, owner);
  assert.equal(trip.status, 201);
  assert.deepEqual(trip.body.offeredSeats, ['1L', '2L']);

  assert.equal((await call('POST', `/trips/${trip.body.id}/book`, { seatId: '1R' }, man)).status, 400, 'driver seat is never bookable');
  assert.equal((await call('POST', `/trips/${trip.body.id}/book`, { seatId: '2M' }, man)).status, 400, 'unoffered seat');
  assert.equal((await call('POST', `/trips/${trip.body.id}/book`, { seatId: '1L' }, owner)).status, 400, 'owner cannot book own trip');

  const b1 = await call('POST', `/trips/${trip.body.id}/book`, { seatId: '1L' }, man);
  assert.equal(b1.status, 200);
  assert.equal(b1.body.bookings[0].gender, 'M');
  assert.equal((await call('POST', `/trips/${trip.body.id}/book`, { seatId: '2L' }, man)).status, 409, 'one seat per user');
  assert.equal((await call('POST', `/trips/${trip.body.id}/book`, { seatId: '1L' }, woman)).status, 409, 'seat taken');

  const b2 = await call('POST', `/trips/${trip.body.id}/book`, { seatId: '2L' }, woman);
  assert.equal(b2.body.status, 'full');
  assert.equal(b2.body.seatsLeft, 0);

  const left = await call('DELETE', `/trips/${trip.body.id}/book`, undefined, man);
  assert.equal(left.body.status, 'open');

  const list = await call('GET', '/trips');
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].car.modelId, 'mahindra-xuv700');
});

test('women-only trips reject male passengers', async () => {
  const owner = await register('Divya', 'F');
  const man = await register('Sunil', 'M');
  const woman = await register('Nisha', 'F');
  const car = await call('POST', '/cars', { modelId: 'hyundai-creta', paintId: 'fiery-red', interiorId: 'black-greige', plate: 'MH 12 ZZ 0001', year: 2024 }, owner);
  const trip = await call('POST', '/trips', { carId: car.body.id, from: 'Andheri', to: 'Bandra', departAt: new Date(Date.now() + 3600_000).toISOString(), pricePerSeat: 50, womenOnly: true }, owner);
  assert.equal((await call('POST', `/trips/${trip.body.id}/book`, { seatId: '2L' }, man)).status, 403);
  assert.equal((await call('POST', `/trips/${trip.body.id}/book`, { seatId: '2L' }, woman)).status, 200);
});

test('validation: unknown paint, past departure, auth required', async () => {
  const owner = await register('Manoj', 'M');
  assert.equal((await call('POST', '/cars', { modelId: 'honda-city', paintId: 'nope', interiorId: 'black', plate: 'DL 1 X 1', year: 2020 }, owner)).status, 400);
  const car = await call('POST', '/cars', { modelId: 'honda-city', paintId: 'lunar-silver', interiorId: 'black', plate: 'DL 1C 1111', year: 2020 }, owner);
  assert.equal((await call('POST', '/trips', { carId: car.body.id, from: 'Andheri', to: 'Bandra', departAt: '2001-01-01T00:00:00Z', pricePerSeat: 1 }, owner)).status, 400);
  assert.equal((await call('GET', '/cars/mine')).status, 401);
  assert.equal((await call('POST', '/trips', { carId: car.body.id, from: 'Andheri', to: 'Bandra', departAt: new Date(Date.now() + 3600_000).toISOString(), pricePerSeat: 1, womenOnly: true }, owner)).status, 400);
});

test('seating versions: a 5-seater XUV700 only offers its own seats', async () => {
  const owner = await register('Layla', 'F');
  assert.equal((await call('POST', '/cars', { modelId: 'mahindra-xuv700', layoutId: '9', paintId: 'red-rage', interiorId: 'black-ivory', plate: 'KA 09 LY 0001', year: 2024 }, owner)).status, 400, 'unknown layout');
  const car = await call('POST', '/cars', { modelId: 'mahindra-xuv700', layoutId: '5', paintId: 'red-rage', interiorId: 'black-ivory', plate: 'KA 09 LY 0002', year: 2024 }, owner);
  assert.equal(car.status, 201);
  assert.equal(car.body.layoutId, '5');
  const departAt = new Date(Date.now() + 86400_000).toISOString();
  const trip = await call('POST', '/trips', { carId: car.body.id, from: 'Mysuru', to: 'Bengaluru', departAt, pricePerSeat: 300 }, owner);
  assert.deepEqual(trip.body.offeredSeats, ['1L', '2L', '2M', '2R']);
  assert.equal((await call('POST', '/trips', { carId: car.body.id, from: 'Mysuru', to: 'Ooty', departAt: new Date(Date.now() + 5 * 86400_000).toISOString(), pricePerSeat: 300, offeredSeats: ['3L'] }, owner)).status, 400, 'no third row on a 5-seater');
});
