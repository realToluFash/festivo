import type { LinkStateName } from './StaffLinkModel.ts';
import type { TextStateName } from './StaffTextModel.ts';

const LEAD: Record<LinkStateName, readonly [string, string]> = {
  none: ['No link yet', 'Share link first, then Copy link; nothing issued until one is pressed'],
  asking: ['Back from the share sheet', 'Did you send it to Ada? Mark as sent or Not yet'],
  shared: ['Shared', 'Shared by Amara Nwosu, not marked as sent; Mark as sent offered'],
  copied: ['Copied', 'Link copied. said; Mark as sent offered'],
  sent: ['Link sent', 'Marked as sent by Amara Nwosu · 18:44'],
  opened: ['Link opened', 'Opened 19:05; Replace link offered'],
  notIssued: ['No link issued', 'That did not work. Try again in a moment. The status kept'],
  refused: [
    'Copy link, the clipboard refused',
    'The link in a read-only field to copy by hand; Copied kept',
  ],
  replaceAsk: ['Replace link, the question', 'A bottom sheet on a phone, docked on its side'],
  replaced: ['Replace link, replaced', 'Back to No link yet; the next Share gives a new one'],
  noMobile: ['No mobile number', 'Ada Nnaji: Add a mobile number to send a link; no actions'],
  erased: [
    'After the erasure',
    'Contact details removed after the event; nothing to share or copy',
  ],
  readOnly: [
    'Without staff.manage',
    'Link sent and its line; no Share, Copy, Mark as sent or Replace',
  ],
  removed: [
    'Removed while open',
    'No longer on the staff, no actions; Roster returns without them',
  ],
};

export const STAFF_LINK_BOARDS = (Object.keys(LEAD) as LinkStateName[]).map((state) => ({
  title: `Staff link · ${LEAD[state][0]}`,
  what: LEAD[state][1],
  href: `/demo/staff-link?state=${state}`,
}));

const TEXT: Record<TextStateName, readonly [string, string]> = {
  smsOn: ['Text the link', 'Once SMS is in: Text the link first, then Share link and Copy link'],
  textBusy: ['Text the link, sending', 'Busy while the text goes'],
  textSent: [
    'Text the link, sent',
    'Link sent · Sent by Amara Nwosu · 19:12; Text sent to Ada Obi.',
  ],
  textOpened: ['Text the link, already opened', 'A new link goes; the status stays Link opened'],
  textNotSent: ['Text the link, not sent', 'That did not work. Try again in a moment. Status kept'],
  textHeld: ['Held: no credits', 'Proposal, #77921: the status kept, no Text the link'],
  stopped: ['Stopped texts', 'Proposal, #77921: Copy link and Share link stay'],
  quiet: ['Quiet hours', 'Proposal, #77921: a staff link goes at 22:40 all the same'],
  quietWaits: ['Quiet hours, if pm says they hold', 'Waits until 08:00, their time'],
  noCredits: ['No credits', 'Held: no credits; Share link and Copy link stay and work'],
  smsReadOnly: ['Texting, without staff.manage', 'No Text the link'],
};

export const STAFF_TEXT_BOARDS = (Object.keys(TEXT) as TextStateName[]).map((state) => ({
  title: `Staff link · ${TEXT[state][0]}`,
  what: TEXT[state][1],
  href: `/demo/staff-link?state=${state}`,
}));

const ROSTER: readonly (readonly [string, string, string])[] = [
  ['Populated', 'Twelve people in shift order, every status a mark with its word', 'populated'],
  ['Loading', 'The roster’s rows as a skeleton', 'loading'],
  ['Cannot load', 'Says so with Try again, never an empty roster', 'failed'],
  ['Empty', 'Nobody on the staff yet; no Add a person', 'empty'],
  [
    'Without staff.manage',
    'The list and each status; a person’s screen has no actions',
    'readOnly',
  ],
  ['A change on the web', 'Amina Yusuf’s Copied reads Link sent within 10 seconds', 'live'],
  ['After the erasure', 'Every Link reads Contact details removed after the event', 'erased'],
  ['Without staff.read', 'More, or the event’s menu, has no Staff', 'noRead'],
  ['Text links to 5', 'Once SMS is in: the button at the head of the list', 'smsOn'],
  [
    'Text links to 5, the check',
    'Uses 310 credits; 1,190 after; a sheet, centred or docked',
    'bulkCheck',
  ],
  ['Text links to 5, the result', 'Sent to 5. 1 has no mobile number.', 'bulkResult'],
  ['The check, short of credits', '2 go now, 3 texts will wait for credits', 'bulkCheckShort'],
  [
    'The result, part held',
    'Sent to 2. 3 are held: no credits. 1 has no mobile number.',
    'bulkHeld',
  ],
  ['Everyone sent one', 'Proposal: the button hidden at 0, with a line saying why', 'bulkNone'],
  ['Stopped texts', 'Proposal, #77921: Chinedu left out and counted', 'stopped'],
  ['Texting, without staff.manage', 'No Text links to {n}', 'smsReadOnly'],
];

export const STAFF_ROSTER_BOARDS = ROSTER.map(([title, what, state]) => ({
  title: `Staff · ${title}`,
  what,
  href: `/demo/events/evt-wed-4?area=staff&staff=${state}`,
}));
