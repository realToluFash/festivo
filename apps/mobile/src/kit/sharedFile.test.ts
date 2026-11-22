import { beforeEach, describe, expect, it, vi } from 'vitest';

const disk = vi.hoisted(() => ({ exists: false, writeFails: false, deleted: 0 }));
const share = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: class {
    uri = 'file:///cache/guests.csv';
    get exists(): boolean {
      return disk.exists;
    }
    create(): void {
      disk.exists = true;
    }
    async write(): Promise<void> {
      if (disk.writeFails) throw new Error('disk full');
    }
    delete(): void {
      disk.exists = false;
      disk.deleted += 1;
    }
  },
}));
vi.mock('expo-sharing', () => ({ shareAsync: share }));

const { writeToShare } = await import('./sharedFile.ts');

const bytes = new Uint8Array(new ArrayBuffer(1));
const CSV = { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' };

describe('writeToShare', () => {
  beforeEach(() => {
    Object.assign(disk, { exists: false, writeFails: false, deleted: 0 });
    share.mockReset();
  });

  it('deletes the file once the share sheet closes', async () => {
    share.mockResolvedValue();

    await (await writeToShare(bytes, 'guests.csv', CSV)).hand();

    expect(disk).toMatchObject({ exists: false, deleted: 1 });
  });

  it('deletes the file when the share sheet fails', async () => {
    share.mockRejectedValue(new Error('no sheet'));
    const { hand } = await writeToShare(bytes, 'guests.csv', CSV);

    await expect(hand()).rejects.toThrow('no sheet');
    expect(disk).toMatchObject({ exists: false, deleted: 1 });
  });

  it('deletes the file discarded, without opening the share sheet', async () => {
    (await writeToShare(bytes, 'guests.csv', CSV)).discard();

    expect(disk).toMatchObject({ exists: false, deleted: 1 });
    expect(share).not.toHaveBeenCalled();
  });

  it('deletes the file when writing it fails', async () => {
    disk.writeFails = true;

    await expect(writeToShare(bytes, 'guests.csv', CSV)).rejects.toThrow('disk full');
    expect(disk).toMatchObject({ exists: false, deleted: 1 });
    expect(share).not.toHaveBeenCalled();
  });
});
