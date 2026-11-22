import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

/** A file written for the share sheet: handed over, or discarded unshared. */
export interface WrittenFile {
  hand: () => Promise<void>;
  discard: () => void;
}

/** Writes the bytes to the cache under the name the dialog showed; handing them over opens the system share sheet, and the file is deleted once it closes, so the app keeps no copy; a write that fails, or a file discarded, deletes it too. */
export async function writeToShare(
  bytes: Uint8Array<ArrayBuffer>,
  name: string,
  type: { mimeType: string; UTI: string },
): Promise<WrittenFile> {
  const file = new File(Paths.cache, name);

  file.create({ overwrite: true });
  try {
    await file.write(bytes);
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }

  const discard = () => {
    if (file.exists) file.delete();
  };

  return {
    hand: async () => {
      try {
        await shareAsync(file.uri, { ...type, dialogTitle: name });
      } finally {
        discard();
      }
    },
    discard,
  };
}
