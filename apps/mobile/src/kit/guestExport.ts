import type { ExportFormat } from '@soirely/domain';

/** What became of a press of Share (sc-3784): handed to the share sheet, refused for want of a connection, or failed with nothing shared. */
export type Shared = 'handed' | 'dropped' | 'failed';

/** The API builds the file from the list as it is now, never a cached copy; only once it is written does the dialog close and the share sheet open. */
export async function exportToShare({
  offline,
  make,
  write,
  unreachable,
}: {
  offline: boolean;
  make: () => Promise<Uint8Array<ArrayBuffer>>;
  /** Writes the file where the share sheet can read it, and gives back how to hand it over. */
  write: (bytes: Uint8Array<ArrayBuffer>) => Promise<() => Promise<void>>;
  unreachable: (error: unknown) => boolean;
}): Promise<{ shared: Shared; hand: (() => Promise<void>) | null }> {
  if (offline) return { shared: 'dropped', hand: null };

  try {
    return { shared: 'handed', hand: await write(await make()) };
  } catch (error) {
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
