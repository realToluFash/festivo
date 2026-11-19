/** One person's own link on the roster, in the app (sc-3912): Share link first, Copy link, Mark as sent and Replace link, on sample data. */
export type LinkStatus = 'none' | 'shared' | 'copied' | 'sent' | 'opened';

export const PERSON = { name: 'Ada Obi', first: 'Ada', job: 'Waiter', shift: '17:00 to 00:00' };
export const YOU = 'Amara Nwosu';
export const NOW = '19:12';
export const ISSUE_MS = 600;
export const SAMPLE_LINK = 'https://soirely.com/s/7Gk2pQ9xVb4mT1sR8nLw3c';

export const W = {
  link: 'Link',
  share: 'Share link',
  copy: 'Copy link',
  markSent: 'Mark as sent',
  notYet: 'Not yet',
  replace: 'Replace link',
  replaceOpen: 'Replace link…',
  keep: 'Keep this link',
  replaceTitle: (first: string) => `Replace ${first}’s link?`,
  replaceLine: 'Their current link stops working now.',
  didYouSend: (first: string) => `Did you send it to ${first}?`,
  didYouSendLine: 'The share sheet cannot tell whether it went.',
  copied: 'Link copied.',
  notIssued: 'That did not work. Try again in a moment.',
  refused: 'The link could not be copied. Copy it from the link field.',
  linkFor: (name: string) => `Link for ${name}`,
  replaced: (first: string) => `[${first}’s link is replaced. Share link gives them a new one.]`,
  marked: (first: string) => `[Marked as sent to ${first}.]`,
  help: 'It opens their own shift, from 12 hours before it starts.',
};

export const WORDS: Record<LinkStatus, string> = {
  none: 'No link yet',
  shared: 'Shared',
  copied: 'Copied',
  sent: 'Link sent',
  opened: 'Link opened',
};

export interface Trail {
  by: string;
  at: string;
}

export interface LinkState {
  status: LinkStatus;
  trail: Trail | null;
  /** Back from the share sheet, asking whether it went. */
  asking: boolean;
  replacing: boolean;
  busy: 'share' | 'copy' | null;
  failed: boolean;
  /** The link the clipboard refused, shown in a read-only field to copy by hand. */
  held: string | null;
  /** The demo's switch: no link is issued, as with no connection or a server error. */
  issueFails: boolean;
  /** The demo's switch: the link is issued but the clipboard refuses it. */
  clipFails: boolean;
  toast: string;
  say: string;
}

export function trailLine(status: LinkStatus, trail: Trail | null): string | null {
  if (trail == null) return null;
  if (status === 'shared') return `Shared by ${trail.by} · ${trail.at} · not marked as sent`;
  if (status === 'copied') return `Copied by ${trail.by} · ${trail.at} · not marked as sent`;
  if (status === 'sent') return `Marked as sent by ${trail.by} · ${trail.at}`;
  if (status === 'opened') return `Opened ${trail.at}`;

  return null;
}

const mine = (): Trail => ({ by: YOU, at: NOW });

/** A delivery never moves a row back: Link sent and Link opened stay as they are. */
function delivered(s: LinkState, as: 'shared' | 'copied'): Pick<LinkState, 'status' | 'trail'> {
  if (s.status === 'sent' || s.status === 'opened') return { status: s.status, trail: s.trail };

  return { status: as, trail: mine() };
}

export function pressed(s: LinkState, what: 'share' | 'copy'): LinkState {
  if (s.busy != null) return s;

  return { ...s, busy: what, failed: false, held: null, asking: false, say: '', toast: '' };
}

/** No link issued: nothing shared, copied or recorded, and the row keeps its status. */
export function notIssued(s: LinkState): LinkState {
  return { ...s, busy: null, failed: true, say: W.notIssued };
}

export function copiedNow(s: LinkState): LinkState {
  return { ...s, ...delivered(s, 'copied'), busy: null, toast: W.copied, say: W.copied };
}

/** Issued but the clipboard refused it: the copy is still recorded, as on the web, and the link waits in a field to copy by hand. */
export function copyRefused(s: LinkState, url: string): LinkState {
  return { ...s, ...delivered(s, 'copied'), busy: null, held: url, say: W.refused };
}

/** Back from the share sheet: it says nothing about whether it went, so Mark as sent is asked. */
export function backFromShare(s: LinkState): LinkState {
  const next = { ...s, ...delivered(s, 'shared'), busy: null };

  return next.status === 'shared'
    ? { ...next, asking: true, say: W.didYouSend(PERSON.first) }
    : next;
}

export function markSent(s: LinkState): LinkState {
  return {
    ...s,
    status: 'sent',
    trail: mine(),
    asking: false,
    held: null,
    toast: W.marked(PERSON.first),
    say: W.marked(PERSON.first),
  };
}

export function notYet(s: LinkState): LinkState {
  return { ...s, asking: false, say: '' };
}

export function askReplace(s: LinkState, open: boolean): LinkState {
  return { ...s, replacing: open };
}

/** Replace link ends every link they were given and issues nothing: the next Share or Copy gives a new one. */
export function replace(s: LinkState): LinkState {
  const toast = W.replaced(PERSON.first);

  return {
    ...s,
    status: 'none',
    trail: null,
    asking: false,
    replacing: false,
    failed: false,
    held: null,
    toast,
    say: toast,
  };
}

export function offersMarkSent(s: LinkState): boolean {
  return !s.asking && (s.status === 'shared' || s.status === 'copied');
}

export function offersReplace(s: LinkState): boolean {
  return s.status !== 'none';
}

export const LINK_STATES = [
  'none',
  'asking',
  'shared',
  'copied',
  'sent',
  'opened',
  'notIssued',
  'refused',
  'replaceAsk',
  'replaced',
] as const;

export type LinkStateName = (typeof LINK_STATES)[number];

export function linkStateOf(raw: string | null | undefined): LinkStateName {
  return LINK_STATES.find((one) => one === raw) ?? 'none';
}

const fresh = (): LinkState => ({
  status: 'none',
  trail: null,
  asking: false,
  replacing: false,
  busy: null,
  failed: false,
  held: null,
  issueFails: false,
  clipFails: false,
  toast: '',
  say: '',
});

export function seed(name: LinkStateName): LinkState {
  const s = fresh();
  const opened: LinkState = { ...s, status: 'opened', trail: { by: '', at: '19:05' } };
  switch (name) {
    case 'asking':
      return { ...backFromShare(s), say: '' };
    case 'shared':
      return notYet(backFromShare(s));
    case 'copied':
      return { ...copiedNow(s), toast: '', say: '' };
    case 'sent':
      return { ...s, status: 'sent', trail: { by: YOU, at: '18:44' } };
    case 'opened':
      return opened;
    case 'notIssued':
      return { ...notIssued(s), issueFails: true, say: '' };
    case 'refused':
      return { ...copyRefused(s, SAMPLE_LINK), clipFails: true, say: '' };
    case 'replaceAsk':
      return askReplace(opened, true);
    case 'replaced':
      return replace(opened);
    default:
      return s;
  }
}
