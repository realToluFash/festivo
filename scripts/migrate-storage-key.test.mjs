import { describe, expect, it } from 'vitest';

import { migrateStorageKey } from './migrate-storage-key.mjs';

describe('migrateStorageKey', () => {
  it('moves the old default pair to test/test and keeps the comment', () => {
    const old = 'A=1\nSTORAGE_KEY=soirely\nSTORAGE_SECRET=soirely-dev-secret     # CHANGE\nB=2\n';
    expect(migrateStorageKey(old)).toBe(
      'A=1\nSTORAGE_KEY=test\nSTORAGE_SECRET=test     # CHANGE\nB=2\n',
    );
  });

  it('leaves a pair somebody chose', () => {
    const custom = 'STORAGE_KEY=mine\nSTORAGE_SECRET=hunter2\n';
    expect(migrateStorageKey(custom)).toBe(custom);
  });

  it('leaves a half-old pair', () => {
    const half = 'STORAGE_KEY=soirely\nSTORAGE_SECRET=hunter2\n';
    expect(migrateStorageKey(half)).toBe(half);
  });
});
