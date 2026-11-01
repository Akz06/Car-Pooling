import fs from 'node:fs';
import path from 'node:path';
import { emptyDb, type DbShape, type Store } from '../shared/core.ts';

export type { DbShape, UserRecord } from '../shared/core.ts';

/**
 * Tiny JSON-file database. All mutations go through `write()`, which
 * persists atomically (write temp file + rename) so a crash never leaves
 * a half-written file behind.
 */
export class Db implements Store {
  data: DbShape;
  constructor(private file: string | null) {
    this.data = emptyDb();
    if (file && fs.existsSync(file)) {
      this.data = { ...emptyDb(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
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
