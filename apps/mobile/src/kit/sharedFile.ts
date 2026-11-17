import type { ExportFormat } from '@soirely/domain';
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

import { EXPORT_TYPES } from './guestExport.ts';

/** Writes the bytes to the cache under the name the dialog showed; handing them over opens the system share sheet, and the file is deleted once it closes, so the app keeps no copy. */
export async function writeToShare(
  bytes: Uint8Array<ArrayBuffer>,
  name: string,
  format: ExportFormat,
): Promise<() => Promise<void>> {
  const file = new File(Paths.cache, name);

  file.create({ overwrite: true });
  await file.write(bytes);

  return async () => {
    try {
      await shareAsync(file.uri, { ...EXPORT_TYPES[format], dialogTitle: name });
    } finally {
      if (file.exists) file.delete();
    }
  };
}
