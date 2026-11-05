import { useState } from 'react';
import type { TripView } from '@shared/types';
import { api } from '../lib/api';
import { rupees } from '../lib/format';

interface Props {
  trip: TripView;
  userId?: string;
  onChange: (t: TripView) => void;
  onError: (msg: string) => void;
}

/** Trip spends, who shares each one, and the end-of-trip "who pays whom". */
export function ExpensePanel({ trip, userId, onChange, onError }: Props) {
  const people = [{ id: trip.ownerId, name: trip.owner.name }, ...trip.bookings.map((b) => ({ id: b.userId, name: b.name }))];
  const nameOf = (id: string) => (id === userId ? 'You' : people.find((p) => p.id === id)?.name ?? 'Former passenger');
  const canAdd = !!userId && people.some((p) => p.id === userId) && trip.status !== 'cancelled';

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(userId ?? trip.ownerId);
  const [shared, setShared] = useState<string[]>(people.map((p) => p.id));
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => setShared((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      onChange(await api.addExpense(trip.id, { title, amount: Number(amount), paidBy, sharedWith: shared }));
      setTitle('');
      setAmount('');
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try { onChange(await api.removeExpense(trip.id, id)); } catch (err) { onError((err as Error).message); }
  };

  const s = trip.settlement;
  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Trip expenses · {rupees(s?.total ?? 0)}</h4>

      {(trip.expenses ?? []).length === 0 ? (
        <p className="muted">No spends yet. Add fuel, tolls, food — each one can be shared with just the people involved.</p>
      ) : (
        <ul className="manifest">
          {trip.expenses!.map((x) => (
            <li key={x.id} style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <b>{x.title}</b> · {rupees(x.amount)}
                <br />
                <small className="muted">
                  Paid by {nameOf(x.paidBy)} · split {x.sharedWith.length === people.length ? 'among everyone' : `between ${x.sharedWith.map(nameOf).join(', ')}`}
                </small>
              </div>
              {(x.addedBy === userId || trip.ownerId === userId) && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(x.id)} aria-label={`Remove ${x.title}`}>✕</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <form onSubmit={add} style={{ marginTop: 12 }}>
          <div className="field">
            <input className="input" required minLength={2} maxLength={60} placeholder="What for? e.g. Fuel, Toll, Lunch" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="row">
            <div className="field">
              <input className="input" type="number" required min={1} placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="field">
              <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} aria-label="Paid by">
                {people.map((p) => <option key={p.id} value={p.id}>Paid by {nameOf(p.id)}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Split between</label>
            {people.map((p) => (
              <label key={p.id} className="toggle">
                <input type="checkbox" checked={shared.includes(p.id)} onChange={() => toggle(p.id)} />
                <span>{nameOf(p.id)}{p.id === trip.ownerId ? ' (driver)' : ''}</span>
              </label>
            ))}
          </div>
          <button className="btn btn--primary btn--block" disabled={busy || shared.length === 0}>
            {busy ? 'Adding…' : 'Add spend'}
          </button>
        </form>
      )}

      {s && s.total > 0 && (
        <>
          <h4>Settle up</h4>
          {s.transfers.length === 0 ? (
            <p className="muted">All square — nobody owes anything.</p>
          ) : (
            <ul className="manifest">
              {s.transfers.map((t, i) => (
                <li key={i}><b>{nameOf(t.from)}</b>&nbsp;pays&nbsp;<b>{nameOf(t.to)}</b><small>{rupees(t.amount)}</small></li>
              ))}
            </ul>
          )}
          <details style={{ marginTop: 8 }}>
            <summary className="muted" style={{ cursor: 'pointer', fontSize: 13 }}>Per-person breakdown</summary>
            <ul className="manifest">
              {s.balances.map((b) => (
                <li key={b.userId}>{nameOf(b.userId)}<small>paid {rupees(b.paid)} · share {rupees(b.share)} · {b.net >= 0 ? 'gets' : 'owes'} {rupees(Math.abs(b.net))}</small></li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
