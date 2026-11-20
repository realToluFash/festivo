export type LinkStatus = 'none' | 'shared' | 'copied' | 'sent' | 'opened';

export interface Who {
  id: string;
  name: string;
  first: string;
  job: string;
  shift: string;
  mobile: boolean;
}

export const PERSON: Who = {
  id: 'ada-obi',
  name: 'Ada Obi',
  first: 'Ada',
  job: 'Waiter',
  shift: '17:00 to 00:00',
  mobile: true,
};

/** What the screen may do: share and copy, read the status only (no staff.manage), or nothing after the 30-day erasure. */
export type LinkView = 'manage' | 'read' | 'erased';
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
  noMobile: 'Add a mobile number to send a link',
  noMobileLine: '[Their mobile number is added on the web, in the roster.]',
  erased: 'Contact details removed after the event',
  erasedLine: '[There is nothing to share or copy: their number went 30 days after the event.]',
  readOnly: '[You can see their link. Sharing it needs permission to manage staff.]',
  removed: (name: string) => `[${name} is no longer on the staff.]`,
  removedLine: '[They were removed from the event on the web, and their link stopped working.]',
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
  /** Sent by a text (sc-77904) rather than marked as sent by hand. */
  via?: 'text';
}

/** Texting once SMS (sc-3946) is in: the credits, the demo's switches, and this person's text. */
export interface Texting {
  credits: number;
  refused: boolean;
  undelivered: boolean;
  /** Outside 09:00–20:00 their time, the event not Happening now and no shift before 09:00 (pm, #77935). */
  quiet: boolean;
  clock: string;
  billing: boolean;
  stopped: boolean;
  pending: 'sending' | 'held' | 'waits' | null;
  notDelivered: string | null;
  before: { status: LinkStatus; trail: Trail | null } | null;
  checking: boolean;
  checkFailed: boolean;
}

export interface LinkState {
  who: Who;
  view: LinkView;
  /** Removed from the roster on the web while the screen is open: no actions, nothing issued. */
  removed: boolean;
  status: LinkStatus;
  trail: Trail | null;
  asking: boolean;
  replacing: boolean;
  busy: 'share' | 'copy' | 'text' | null;
  /** Null until SMS is merged: then Text the link shows. */
  texting: Texting | null;
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
  if (status === 'sent')
    return trail.via === 'text'
      ? `Sent by ${trail.by} · ${trail.at}`
      : `Marked as sent by ${trail.by} · ${trail.at}`;
  if (status === 'opened') return `Opened ${trail.at}`;

  return null;
}

const mine = (): Trail => ({ by: YOU, at: NOW });

/** A delivery never moves a row back: Link sent and Link opened stay as they are. */
function delivered(s: LinkState, as: 'shared' | 'copied'): Pick<LinkState, 'status' | 'trail'> {
  if (s.status === 'sent' || s.status === 'opened') return { status: s.status, trail: s.trail };

  return { status: as, trail: mine() };
}

export function pressed(s: LinkState, what: 'share' | 'copy' | 'text'): LinkState {
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
    ? { ...next, asking: true, say: W.didYouSend(s.who.first) }
    : next;
}

export function markSent(s: LinkState): LinkState {
  return {
    ...s,
    status: 'sent',
    trail: mine(),
    asking: false,
    held: null,
    toast: W.marked(s.who.first),
    say: W.marked(s.who.first),
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
  const toast = W.replaced(s.who.first);

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

/** Share link, Copy link, Mark as sent and Replace link… need staff.manage, a mobile number, and the person still on the staff. */
export function acts(s: LinkState): boolean {
  return s.view === 'manage' && s.who.mobile && !s.removed;
}

export function offersMarkSent(s: LinkState): boolean {
  return acts(s) && !s.asking && (s.status === 'shared' || s.status === 'copied');
}

export function offersReplace(s: LinkState): boolean {
  return acts(s) && s.status !== 'none';
}

/** What the status reads: after the erasure and without a number, those words; else the link's own. */
export function statusWord(s: LinkState): string {
  if (s.view === 'erased') return W.erased;
  if (!s.who.mobile) return W.noMobile;

  return WORDS[s.status];
}

/** Removed on the web: the screen says so and holds nothing, whatever was under way. */
export function removedNow(s: LinkState): LinkState {
  const say = W.removed(s.who.name);

  return {
    ...s,
    removed: true,
    asking: false,
    replacing: false,
    busy: null,
    failed: false,
    held: null,
    toast: '',
    say,
  };
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
  'noMobile',
  'erased',
  'readOnly',
  'removed',
] as const;

export type LinkStateName = (typeof LINK_STATES)[number];

export function linkStateOf(raw: string | null | undefined): LinkStateName {
  return LINK_STATES.find((one) => one === raw) ?? 'none';
}

const fresh = (who: Who): LinkState => ({
  who,
  view: 'manage',
  removed: false,
  status: 'none',
  trail: null,
  asking: false,
  replacing: false,
  busy: null,
  texting: null,
  failed: false,
  held: null,
  issueFails: false,
  clipFails: false,
  toast: '',
  say: '',
});

const NO_MOBILE: Who = {
  id: 'ada',
  name: 'Ada Nnaji',
  first: 'Ada',
  job: 'Cook',
  shift: '15:00 to 23:00',
  mobile: false,
};

export function seed(name: LinkStateName, who: Who = PERSON): LinkState {
  const s = fresh(name === 'noMobile' ? NO_MOBILE : who);
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
    case 'noMobile':
      return s;
    case 'erased':
      return { ...opened, view: 'erased', trail: null };
    case 'readOnly':
      return { ...s, view: 'read', status: 'sent', trail: { by: YOU, at: '18:44' } };
    case 'removed':
      return { ...removedNow(opened), say: '' };
    default:
      return s;
  }
}

/** The link screen opened from the roster: that person, their status as the roster has it, and what the viewer may do. */
export function seedFor(
  who: Who,
  status: LinkStatus,
  trail: Trail | null,
  view: LinkView,
): LinkState {
  return { ...fresh(who), status, trail, view };
}
