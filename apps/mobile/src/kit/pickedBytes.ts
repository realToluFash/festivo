import { File } from 'expo-file-system';

/** Read from the file system rather than `fetch(uri).blob()`, whose blob reaches an Android PUT as the text `File not found` (sc-53493). */
export function pickedBytes(uri: string): Promise<Uint8Array<ArrayBuffer>> {
  return new File(uri).bytes();
}
