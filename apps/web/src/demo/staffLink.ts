/** A person's own link on the roster (sc-3912): what Copy link, Mark as sent and Replace link do to a row, on sample data. */
export type Delivered = 'opened' | 'sent' | 'copied' | 'none';

export interface Trail {
  by: string;
  at: string;
}

export const YOU = 'Amara Nwosu';
export const NOW_AT = '19:12';
export const ISSUE_MS = 600;
export const SAMPLE_LINK = 'https://soirely.com/s/7Gk2pQ9xVb4mT1sR8nLw3c';

export const LW = {
  copy: 'Copy link',
  markSent: 'Mark as sent',
  replace: 'Replace link',
  replaceOpen: 'Replace link…',
  copied: 'Link copied.',
  notIssued: 'That did not work. Try again in a moment.',
  refused: 'The link could not be copied. Copy it from the link field.',
  linkFor: (name: string) => `Link for ${name}`,
  replaceTitle: (name: string) => `Replace ${name}’s link?`,
  replaceLine: 'Their current link stops working now.',
  keep: 'Keep this link',
  replaced: (name: string) =>
    `[${name}’s link is replaced. Copy link gives them a new one to send.]`,
  marked: (name: string) => `[Marked as sent to ${name}.]`,
};

/** The who and when under a status: "Copied by Amara Nwosu · 19:12 · not marked as sent". */
export function trailLine(link: Delivered, trail: Trail | null): string | null {
  if (trail == null || link === 'none') return null;
  if (link === 'copied') return `Copied by ${trail.by} · ${trail.at} · not marked as sent`;
  if (link === 'sent') return `Marked as sent by ${trail.by} · ${trail.at}`;

  return `Opened ${trail.at}`;
}

/** A copy never moves a row back: Link sent and Link opened keep their word and their line; only No link yet and Copied become Copied by you, now. */
export function afterCopy(
  link: Delivered,
  trail: Trail | null,
): { link: Delivered; trail: Trail | null } {
  if (link === 'sent' || link === 'opened') return { link, trail };

  return { link: 'copied', trail: { by: YOU, at: NOW_AT } };
}

export function afterMark(): { link: Delivered; trail: Trail } {
  return { link: 'sent', trail: { by: YOU, at: NOW_AT } };
}

export function afterReplace(): { link: Delivered; trail: null } {
  return { link: 'none', trail: null };
}

export type CopyOutcome =
  { kind: 'copied'; url: string } | { kind: 'refused'; url: string } | { kind: 'notIssued' };

interface Clip {
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
