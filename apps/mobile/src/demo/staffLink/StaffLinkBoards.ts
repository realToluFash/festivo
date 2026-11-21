import type { LinkStateName } from './StaffLinkModel.ts';

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
];

export const STAFF_ROSTER_BOARDS = ROSTER.map(([title, what, state]) => ({
  title: `Staff · ${title}`,
  what,
  href: `/demo/events/evt-wed-4?area=staff&staff=${state}`,
}));
