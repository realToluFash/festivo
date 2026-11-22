import type { ExportFormat } from '@soirely/domain';

import type { WrittenFile } from './sharedFile.ts';

/** What became of a press of Share (sc-3784): handed to the share sheet, refused for want of a connection, failed with nothing shared, or cancelled while the file was prepared. */
export type Shared = 'handed' | 'dropped' | 'failed' | 'abandoned';

/** The API builds the file from the list as it is now, never a cached copy; only once it is written does the dialog close and the share sheet open. A dialog closed meanwhile shares nothing, and keeps no file. */
export async function exportToShare({
  offline,
  make,
  write,
  unreachable,
  abandoned,
}: {
  offline: boolean;
  make: () => Promise<Uint8Array<ArrayBuffer>>;
  /** Writes the file where the share sheet can read it, and gives back how to hand it over or throw it away. */
  write: (bytes: Uint8Array<ArrayBuffer>) => Promise<WrittenFile>;
  unreachable: (error: unknown) => boolean;
  abandoned: () => boolean;
}): Promise<{ shared: Shared; hand: (() => Promise<void>) | null }> {
  if (offline) return { shared: 'dropped', hand: null };

  try {
    const bytes = await make();
    if (abandoned()) return { shared: 'abandoned', hand: null };

    const written = await write(bytes);
    if (abandoned()) {
      written.discard();
      return { shared: 'abandoned', hand: null };
    }

    return { shared: 'handed', hand: written.hand };
  } catch (error) {
    if (abandoned()) return { shared: 'abandoned', hand: null };

    return { shared: unreachable(error) ? 'dropped' : 'failed', hand: null };
  }
}

export const EXPORT_TYPES: Record<ExportFormat, { mimeType: string; UTI: string }> = {
  xlsx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  },
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
};
