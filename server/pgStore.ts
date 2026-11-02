import pg from 'pg';
import { emptyDb, type DbShape, type Store } from '../shared/core.ts';

/**
 * PostgreSQL-backed store (Railway, Neon, Supabase, …).
 *
 * The app's rules work on an in-memory copy (one server instance), and every
 * change is written through to Postgres as one JSONB document. Writes are
 * queued and coalesced, so a burst of bookings costs one round trip.
 */
export async function openPgStore(connectionString: string): Promise<Store & { flush(): Promise<void>; close(): Promise<void> }> {
  const pool = new pg.Pool({ connectionString, max: 3 });
  await pool.query(`CREATE TABLE IF NOT EXISTS seatshare_state (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    data jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows } = await pool.query<{ data: DbShape }>('SELECT data FROM seatshare_state WHERE id = 1');
  const data: DbShape = { ...emptyDb(), ...(rows[0]?.data ?? {}) };

  let saving: Promise<void> | null = null;
  let dirty = false;
  const save = async () => {
    while (dirty) {
      dirty = false;
      const snapshot = JSON.stringify(store.data);
      try {
        await pool.query(
          `INSERT INTO seatshare_state (id, data, updated_at) VALUES (1, $1::jsonb, now())
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          [snapshot],
        );
      } catch (err) {
        console.error('Saving to Postgres failed, will retry with the next change:', (err as Error).message);
        dirty = true;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    saving = null;
  };

  const store = {
    data,
    write<T>(mutate: (d: DbShape) => T): T {
      const result = mutate(store.data);
      dirty = true;
      saving ??= save();
      return result;
    },
    async flush() {
      while (saving) await saving;
    },
    async close() {
      await store.flush();
      await pool.end();
    },
  };
  return store;
}
