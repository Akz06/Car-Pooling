import { useEffect, useState } from 'react';
import { api, type Me } from '../lib/api';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';

/** Your name and WhatsApp number (used for password-reset codes). */
export function AccountPage() {
  const { user, signIn } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [f, setF] = useState({ name: '', phone: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.me().then((m) => { setMe(m); setF({ name: m.name, phone: m.phone ?? '' }); }).catch((e) => setError(e.message));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setError('');
    setBusy(true);
    try {
      const updated = await api.updateMe({ name: f.name, phone: f.phone });
      setMe({ ...me!, ...updated });
      setF({ name: updated.name, phone: updated.phone ?? '' });
      signIn(localStorage.getItem('seatshare.token') ?? '', { ...user!, name: updated.name });
      setMsg('Saved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const [users, setUsers] = useState<Me[]>([]);
  const [u, setU] = useState({ name: '', email: '', gender: 'M' as 'M' | 'F' });
  const [uMsg, setUMsg] = useState('');
  const [uErr, setUErr] = useState('');
  const [uBusy, setUBusy] = useState(false);

  useEffect(() => { api.myUsers().then(setUsers).catch(() => undefined); }, []);

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUMsg('');
    setUErr('');
    setUBusy(true);
    try {
      const created = await api.addUser(u);
      setUsers((list) => [...list, created]);
      setU({ name: '', email: '', gender: 'M' });
      setUMsg(`Added ${created.name}. They can sign in by choosing "Forgot password" with ${created.email}.`);
    } catch (err) {
      setUErr((err as Error).message);
    } finally {
      setUBusy(false);
    }
  };

  if (!me) return error ? <div className="error">{error}</div> : <div className="page-loading">Loading…</div>;
  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="page-head">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span className={`avatar avatar--lg avatar--${me.gender}`}>{initials(me.name)}</span>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Account</p>
            <h1 style={{ margin: 0 }}>{me.name}</h1>
            <span className="muted">{me.email}</span>
          </div>
        </div>
      </div>
      <form className="panel" onSubmit={save}>
        {!me.phone && <div className="notes" style={{ marginTop: 0, marginBottom: 14 }}>Optional: add your WhatsApp number to also get password-reset codes there (they always go to your email).</div>}
        <div className="field">
          <label htmlFor="aname">Full name</label>
          <input id="aname" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="aphone">Mobile number (WhatsApp)</label>
          <input id="aphone" className="input" type="tel" inputMode="tel" placeholder="98765 43210" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <small className="muted">Only used to send you password-reset codes. Never shown to other riders.</small>
        </div>
        {error && <div className="error">{error}</div>}
        {msg && <div className="notes" style={{ marginBottom: 12 }}>{msg}</div>}
        <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>

      <form className="panel" onSubmit={addUser} style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>Add a user</h2>
        <div className="field">
          <label htmlFor="uname">Name</label>
          <input id="uname" className="input" value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="uemail">Email</label>
          <input id="uemail" className="input" type="email" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} required />
        </div>
        <div className="field">
          <label htmlFor="ugender">Gender</label>
          <select id="ugender" className="input" value={u.gender} onChange={(e) => setU({ ...u, gender: e.target.value as 'M' | 'F' })}>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        {uErr && <div className="error">{uErr}</div>}
        {uMsg && <div className="notes" style={{ marginBottom: 12 }}>{uMsg}</div>}
        <button className="btn btn--primary btn--block" disabled={uBusy}>{uBusy ? 'Adding…' : 'Add user'}</button>
        {users.length > 0 && (
          <ul style={{ margin: '14px 0 0', paddingLeft: 18 }}>
            {users.map((x) => <li key={x.id}>{x.name} <span className="muted">· {x.email}</span></li>)}
          </ul>
        )}
      </form>
    </div>
  );
}
