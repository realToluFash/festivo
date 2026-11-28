import { describe, expect, it } from 'vitest';

import { asServiceRead } from './serviceRead.ts';

const readWith = (table: Record<string, unknown>) => ({
  course: { id: 'c1', name: 'Starter' },
  items: [],
  trays: [],
  tables: [{ kind: 'block', guests: [], ...table }],
});

describe('asServiceRead', () => {
  it('parses a block of single seats with no name and keeps its seats in order', () => {
    const read = asServiceRead(
      readWith({ key: 'block:none:1', name: null, seats: ['1', '2', '10'] }),
    );

    expect(read?.tables[0]).toMatchObject({ name: null, seats: ['1', '2', '10'] });
  });

  it('reads a table without seats as having none', () => {
    const read = asServiceRead(readWith({ key: 't1', name: 'Table 1' }));

    expect(read?.tables[0]).toMatchObject({ name: 'Table 1', seats: [] });
  });
});
