import fs from 'node:fs';
import path from 'node:path';
import type { Car, Gender, Trip } from '../shared/types.ts';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  gender: Gender;
  passwordHash: string;
  salt: string;
  rating: number;
  createdAt: string;
}

export interface DbShape {
  users: UserRecord[];
  sessions: { token: string; userId: string; createdAt: string }[];
  cars: Car[];
  trips: Trip[];
}

const empty = (): DbShape => ({ users: [], sessions: [], cars: [], trips: [] });

/**
 * Tiny JSON-file database. All mutations go through `write()`, which
 * persists atomically (write temp file + rename) so a crash never leaves
 * a half-written file behind.
 */
export class Db {
  data: DbShape;
  constructor(private file: string | null) {
    this.data = empty();
    if (file && fs.existsSync(file)) {
      this.data = { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    }
  }

  write<T>(mutate: (d: DbShape) => T): T {
    const result = mutate(this.data);
    if (this.file) {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    }
    return result;
  }
}
