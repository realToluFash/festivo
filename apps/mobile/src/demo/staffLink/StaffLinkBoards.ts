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
  textCheck: [
    'Text the link, the check',
    'This text uses 62 credits. Credits after sending: 1,438.',
  ],
  textCheckShort: [
    'The check with no credits',
    '1 SMS message will wait for credits. Credits cannot be added in the app.',
  ],
  textCheckQuiet: ['The check at 22:40', 'Texts to 1 person wait until 09:00, their time.'],
  textNotSent: ['Not sent', 'That did not work. Try again in a moment. in the check; status kept'],
  textSending: ['Sending text…', 'Until Twilio reports sent; Sending the link to Ada Obi.'],
  textSent: ['Link sent', 'Sent by Amara Nwosu · 19:12'],
  textOpened: ['Already opened', 'A new link went; it stays Link opened'],
  textHeld: ['Text held: no credits', 'Status kept; no Text the link; Share and Copy stay'],
  textWaits: ['Text waits until 09:00', 'Quiet hours, their time; no Text the link'],
  textUndelivered: ['Text not delivered', 'Back to No link yet with the time; Text the link back'],
  stopped: ['Stopped texts', 'In Text the link’s place; Share and Copy stay'],
  noCredits: ['No credits', 'The text held; Copy link worked'],
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
    'Texts use 310 credits. Credits after sending: 1,190.',
    'bulkCheck',
  ],
  ['The check, short of credits', '3 SMS messages will wait for credits', 'bulkCheckShort'],
  ['Short, without billing.manage', 'Ask an owner', 'bulkCheckAsk'],
  ['The check at 22:40', 'Texts to 5 people wait until 09:00, their time.', 'bulkCheckQuiet'],
  ['Sending', 'Sending to 5 people. 1 has no mobile number.', 'bulkSending'],
  ['Sent', 'Twilio reported each sent: five read Link sent', 'bulkResult'],
  ['Part held', 'Sending to 2 people. 1 has no mobile number. 3 held: no credits.', 'bulkHeld'],
  ['All waiting', '1 has no mobile number. 5 wait until 09:00, their time.', 'bulkQuiet'],
  ['Everyone sent one', 'Text links to {n} is hidden at 0 (AC)', 'bulkNone'],
  ['Stopped texts', 'Chinedu reads Stopped texts; Text links to 4', 'stopped'],
  ['Texting, without staff.manage', 'No Text links to {n}', 'smsReadOnly'],
];

export const STAFF_ROSTER_BOARDS = ROSTER.map(([title, what, state]) => ({
  title: `Staff · ${title}`,
  what,
  href: `/demo/events/evt-wed-4?area=staff&staff=${state}`,
}));
