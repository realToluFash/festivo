/** Copy link for a link the API issues on the press (sc-3912): the outcome says whether the clipboard took it, or hands it back to copy by hand. */
export type CopyOutcome =
  { kind: 'copied'; url: string } | { kind: 'refused'; url: string } | { kind: 'notIssued' };

export interface Clip {
  writeText: (text: string) => Promise<void>;
  write?: (items: ClipboardItem[]) => Promise<void>;
}

/** Safari refuses a clipboard write made after the press has finished, so where a ClipboardItem can hold a promise the write starts inside the press. */
export async function copyIssued(
  issue: () => Promise<string>,
  clip: Clip | null,
  itemOf: ((text: Promise<string>) => ClipboardItem) | null,
): Promise<CopyOutcome> {
  const asked = issue();
  let written: Promise<void>;
  if (clip == null) written = Promise.reject(new Error('No clipboard'));
  else if (itemOf != null && clip.write != null) written = clip.write([itemOf(asked)]);
  else written = asked.then((url) => clip.writeText(url));
  written.catch(() => {});

  let url: string;
  try {
    url = await asked;
  } catch {
    return { kind: 'notIssued' };
  }
  try {
    await written;
    return { kind: 'copied', url };
  } catch {
    return { kind: 'refused', url };
  }
}

export function plainItem(text: Promise<string>): ClipboardItem {
  return new ClipboardItem({
    'text/plain': text.then((one) => new Blob([one], { type: 'text/plain' })),
  });
}
