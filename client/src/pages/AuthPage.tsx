import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getModel } from '@shared/catalog';
import type { Gender } from '@shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CarView, type SeatState } from '../components/CarView';

const model = getModel('toyota-innova-crysta')!;
const art: Record<string, SeatState> = {
  '1R': { status: 'driver', gender: 'F' }, '1L': { status: 'booked', gender: 'F' },
  '2L': { status: 'booked', gender: 'M' }, '2R': { status: 'available' },
  '3L': { status: 'booked', gender: 'F' }, '3M': { status: 'available' }, '3R': { status: 'booked', gender: 'M' },
};
const DEMO = ['priya', 'arjun', 'kavya', 'vikram'];

export function AuthPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ name: '', email: '', password: '', gender: '' as Gender | '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = params.get('next') || '/';

  const submit = async (e?: React.FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const s = override
        ? await api.login(override)
        : mode === 'login'
          ? await api.login({ email: f.email, password: f.password })
          : await api.register({ name: f.name, email: f.email, password: f.password, gender: f.gender as Gender });
      signIn(s.token, s.user);
      nav(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__art">
        <p className="eyebrow">SeatShare</p>
        <h1>Share the drive.<br /><span>Choose your seat.</span></h1>
        <p className="muted" style={{ maxWidth: 520, fontSize: 17 }}>
          Owners publish trips in their real car. Riders see the actual cabin — and who's sitting where — before booking.
        </p>
        <CarView className="auth__car" model={model} paint={model.paints[3]} interior={model.interiors[0]} orientation="horizontal" seats={art} night ambient="#f59e0b" />
      </div>
      <div className="auth__form">
        <form onSubmit={submit}>
          <div className="seg" style={{ marginBottom: 22 }}>
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Sign in</button>
            <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>Create account</button>
          </div>
          <h2>{mode === 'login' ? 'Welcome back' : 'Join the ride'}</h2>
          {error && <div className="error">{error}</div>}
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
          {mode === 'register' && (
            <div className="field">
              <label>Gender — shown on the seat you book</label>
              <div className="gender-pick">
                <button type="button" className={`M ${f.gender === 'M' ? 'on' : ''}`} onClick={() => setF({ ...f, gender: 'M' })}><i>♂</i>Male</button>
                <button type="button" className={`F ${f.gender === 'F' ? 'on' : ''}`} onClick={() => setF({ ...f, gender: 'F' })}><i>♀</i>Female</button>
              </div>
            </div>
          )}
          <button className="btn btn--primary btn--block" disabled={busy || (mode === 'register' && !f.gender)}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          <div className="demo">
            Try a demo account (password <code>demo123</code>):
            <div>
              {DEMO.map((d) => (
                <button key={d} type="button" className="chip" onClick={() => submit(undefined, { email: `${d}@demo.in`, password: 'demo123' })}>
                  {d[0].toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
