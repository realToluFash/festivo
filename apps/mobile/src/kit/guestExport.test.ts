import { describe, expect, it, vi } from 'vitest';

import { exportToShare } from './guestExport.ts';

const BYTES = new Uint8Array([1, 2, 3]);

describe("sc-3784's Share", () => {
  it('refuses with no connection, before asking the API for anything', async () => {
    const make = vi.fn(() => Promise.resolve(BYTES));

    const result = await exportToShare({
      offline: true,
      make,
      write: () => Promise.resolve(() => Promise.resolve()),
      unreachable: () => false,
    });

    expect(result).toEqual({ shared: 'dropped', hand: null });
    expect(make).not.toHaveBeenCalled();
  });

  it('writes the bytes the API built and hands back the share', async () => {
    const hand = () => Promise.resolve();
    const write = vi.fn(() => Promise.resolve(hand));

    const result = await exportToShare({
      offline: false,
      make: () => Promise.resolve(BYTES),
      write,
      unreachable: () => false,
    });

    expect(result).toEqual({ shared: 'handed', hand });
    expect(write).toHaveBeenCalledWith(BYTES);
  });

  it('says the connection dropped when the API cannot be reached', async () => {
    const write = vi.fn();

    const result = await exportToShare({
      offline: false,
      make: () => Promise.reject(new Error('unreachable')),
      write,
      unreachable: () => true,
    });

    expect(result).toEqual({ shared: 'dropped', hand: null });
    expect(write).not.toHaveBeenCalled();
  });

  it('fails with nothing shared when the API refuses, or the file cannot be written', async () => {
    const refused = await exportToShare({
      offline: false,
      make: () => Promise.reject(new Error('500')),
      write: () => Promise.resolve(() => Promise.resolve()),
      unreachable: () => false,
    });
    const unwritten = await exportToShare({
      offline: false,
      make: () => Promise.resolve(BYTES),
      write: () => Promise.reject(new Error('disk')),
      unreachable: () => false,
    });

    expect(refused).toEqual({ shared: 'failed', hand: null });
    expect(unwritten).toEqual({ shared: 'failed', hand: null });
  });
});
