import { describe, expect, it, vi } from 'vitest';

import { exportToShare } from './guestExport.ts';

const BYTES = new Uint8Array([1, 2, 3]);
const written = () => ({ hand: () => Promise.resolve(), discard: vi.fn() });
const kept = () => false;

describe("sc-3784's Share", () => {
  it('refuses with no connection, before asking the API for anything', async () => {
    const make = vi.fn(() => Promise.resolve(BYTES));

    const result = await exportToShare({
      offline: true,
      make,
      write: () => Promise.resolve(written()),
      unreachable: () => false,
      abandoned: kept,
    });

    expect(result).toEqual({ shared: 'dropped', hand: null });
    expect(make).not.toHaveBeenCalled();
  });

  it('writes the bytes the API built and hands back the share', async () => {
    const file = written();
    const write = vi.fn(() => Promise.resolve(file));

    const result = await exportToShare({
      offline: false,
      make: () => Promise.resolve(BYTES),
      write,
      unreachable: () => false,
      abandoned: kept,
    });

    expect(result).toEqual({ shared: 'handed', hand: file.hand });
    expect(file.discard).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(BYTES);
  });

  it('says the connection dropped when the API cannot be reached', async () => {
    const write = vi.fn();

    const result = await exportToShare({
      offline: false,
      make: () => Promise.reject(new Error('unreachable')),
      write,
      unreachable: () => true,
      abandoned: kept,
    });

    expect(result).toEqual({ shared: 'dropped', hand: null });
    expect(write).not.toHaveBeenCalled();
  });

  it('fails with nothing shared when the API refuses, or the file cannot be written', async () => {
    const refused = await exportToShare({
      offline: false,
      make: () => Promise.reject(new Error('500')),
      write: () => Promise.resolve(written()),
      unreachable: () => false,
      abandoned: kept,
    });
    const unwritten = await exportToShare({
      offline: false,
      make: () => Promise.resolve(BYTES),
      write: () => Promise.reject(new Error('disk')),
      unreachable: () => false,
      abandoned: kept,
    });

    expect(refused).toEqual({ shared: 'failed', hand: null });
    expect(unwritten).toEqual({ shared: 'failed', hand: null });
  });

  it('writes nothing when the dialog closed while the API built the file', async () => {
    let closed = false;
    const write = vi.fn(() => Promise.resolve(written()));

    const result = await exportToShare({
      offline: false,
      make: () => {
        closed = true;
        return Promise.resolve(BYTES);
      },
      write,
      unreachable: () => false,
      abandoned: () => closed,
    });

    expect(result).toEqual({ shared: 'abandoned', hand: null });
    expect(write).not.toHaveBeenCalled();
  });

  it('deletes the file unshared when the dialog closed while it was written', async () => {
    let closed = false;
    const file = written();

    const result = await exportToShare({
      offline: false,
      make: () => Promise.resolve(BYTES),
      write: () => {
        closed = true;
        return Promise.resolve(file);
      },
      unreachable: () => false,
      abandoned: () => closed,
    });

    expect(result).toEqual({ shared: 'abandoned', hand: null });
    expect(file.discard).toHaveBeenCalledOnce();
  });

  it('shows no failure for a dialog closed before the API answered', async () => {
    const result = await exportToShare({
      offline: false,
      make: () => Promise.reject(new Error('500')),
      write: () => Promise.resolve(written()),
      unreachable: () => false,
      abandoned: () => true,
    });

    expect(result).toEqual({ shared: 'abandoned', hand: null });
  });
});
