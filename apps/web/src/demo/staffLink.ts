/** A person's own link on the roster (sc-3912): what Copy link, Mark as sent and Replace link do to a row, on sample data. */
export type Delivered = 'opened' | 'sent' | 'shared' | 'copied' | 'none';

export interface Trail {
  by: string;
  at: string;
  /** Sent by a text (sc-77904) rather than marked as sent by hand. */
  via?: 'text';
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
  if (link === 'shared') return `Shared by ${trail.by} · ${trail.at} · not marked as sent`;
  if (link === 'sent')
    return trail.via === 'text'
      ? `Sent by ${trail.by} · ${trail.at}`
      : `Marked as sent by ${trail.by} · ${trail.at}`;

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

export { type CopyOutcome, copyIssued, plainItem } from '../copyIssued.ts';
