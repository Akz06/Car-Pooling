import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from './app.ts';
import { Db } from './db.ts';

const sent: { email: string; phone?: string; code: string }[] = [];
let server: Server;
let base = '';
before(async () => {
  server = createApp(new Db(null), undefined, { channels: { email: true, whatsapp: true }, send: async (t) => { sent.push(t); } }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
after(() => server.close());

const call = async (method: string, url: string, body?: unknown, token?: string) => {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
};

test('forgot password sends a WhatsApp code and resets the password', async () => {
  const reg = await call('POST', '/auth/register', { name: 'Rohini', email: 'rohini@x.in', password: 'oldpass1', gender: 'F', phone: '98765 43210' });
  assert.equal(reg.status, 201);
  const me = await call('GET', '/auth/me', undefined, reg.body.token);
  assert.equal(me.body.phone, '+919876543210');

  // works with the mobile number in any common format
  assert.equal((await call('POST', '/auth/forgot', { identifier: '+91 98765-43210' })).status, 200);
  assert.equal(sent.at(-1)!.phone, '+919876543210');
  assert.match(sent.at(-1)!.code, /^\d{6}$/);

  assert.equal((await call('POST', '/auth/reset', { identifier: '9876543210', code: '000000', password: 'newpass1' })).status, 400);
  const ok = await call('POST', '/auth/reset', { identifier: '9876543210', code: sent.at(-1)!.code, password: 'newpass1' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal((await call('GET', '/auth/me', undefined, reg.body.token)).status, 401, 'old sessions signed out');
  assert.equal((await call('POST', '/auth/login', { email: 'rohini@x.in', password: 'oldpass1' })).status, 401);
  assert.equal((await call('POST', '/auth/login', { email: 'rohini@x.in', password: 'newpass1' })).status, 200);
  // a used code can't be reused
  assert.equal((await call('POST', '/auth/reset', { identifier: 'rohini@x.in', code: sent.at(-1)!.code, password: 'again123' })).status, 400);
});

test('accounts without a mobile number get the code by email', async () => {
  await call('POST', '/auth/register', { name: 'No Phone', email: 'nophone@x.in', password: 'secret1', gender: 'F' });
  assert.equal((await call('POST', '/auth/forgot', { identifier: 'NoPhone@x.in' })).status, 200);
  const last = sent.at(-1)!;
  assert.equal(last.email, 'nophone@x.in');
  assert.equal(last.phone, undefined);
  assert.equal((await call('POST', '/auth/reset', { identifier: 'nophone@x.in', code: last.code, password: 'fresh123' })).status, 200);
});

test('unknown accounts get the same answer and no message', async () => {
  const before = sent.length;
  const r = await call('POST', '/auth/forgot', { identifier: 'nobody@x.in' });
  assert.equal(r.status, 200);
  assert.equal(sent.length, before);
});

test('codes lock after 5 wrong tries and requests are rate-limited', async () => {
  await call('POST', '/auth/register', { name: 'Arun', email: 'arun@x.in', password: 'secret1', gender: 'M', phone: '9123456780' });
  await call('POST', '/auth/forgot', { identifier: 'arun@x.in' });
  const code = sent.at(-1)!.code;
  for (let i = 0; i < 5; i++) await call('POST', '/auth/reset', { identifier: 'arun@x.in', code: code === '111111' ? '222222' : '111111', password: 'newpass1' });
  assert.equal((await call('POST', '/auth/reset', { identifier: 'arun@x.in', code, password: 'newpass1' })).status, 400, 'locked after 5 wrong tries');
  await call('POST', '/auth/forgot', { identifier: 'arun@x.in' });
  await call('POST', '/auth/forgot', { identifier: 'arun@x.in' });
  assert.equal((await call('POST', '/auth/forgot', { identifier: 'arun@x.in' })).status, 429);
});

test('mobile number validation and uniqueness', async () => {
  assert.equal((await call('POST', '/auth/register', { name: 'Bad Phone', email: 'bp@x.in', password: 'secret1', gender: 'M', phone: '12345' })).status, 400);
  assert.equal((await call('POST', '/auth/register', { name: 'Dup Phone', email: 'dp@x.in', password: 'secret1', gender: 'M', phone: '9876543210' })).status, 409);
});
