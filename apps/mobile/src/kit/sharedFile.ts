import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

/** Writes the bytes to the cache under the name the dialog showed; handing them over opens the system share sheet, and the file is deleted once it closes, so the app keeps no copy; a write that fails deletes it too. */
export async function writeToShare(
  bytes: Uint8Array<ArrayBuffer>,
  name: string,
  type: { mimeType: string; UTI: string },
): Promise<() => Promise<void>> {
  const file = new File(Paths.cache, name);

  file.create({ overwrite: true });
  try {
    await file.write(bytes);
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }

  return async () => {
    try {
      await shareAsync(file.uri, { ...type, dialogTitle: name });
    } finally {
      if (file.exists) file.delete();
    }
  };
}
