import type { LinkStateName } from './StaffLinkModel.ts';

const LEAD: Record<LinkStateName, readonly [string, string]> = {
  none: ['No link yet', 'Share link first, then Copy link; nothing issued until one is pressed'],
  asking: ['Back from the share sheet', 'Did you send it to Ada? Mark as sent or Not yet'],
  shared: ['Shared', 'Shared by Amara Nwosu, not marked as sent; Mark as sent offered'],
  copied: ['Copied', 'Link copied. said; Mark as sent offered'],
  sent: ['Link sent', 'Marked as sent by Amara Nwosu · 18:44'],
  opened: ['Link opened', 'Opened 19:05; Replace link offered'],
  notIssued: ['No link issued', 'That did not work. Try again in a moment. The status kept'],
  replaceAsk: ['Replace link, the question', 'A bottom sheet on a phone, docked on its side'],
  replaced: ['Replace link, replaced', 'Back to No link yet; the next Share gives a new one'],
};

export const STAFF_LINK_BOARDS = (Object.keys(LEAD) as LinkStateName[]).map((state) => ({
  title: `Staff link · ${LEAD[state][0]}`,
  what: LEAD[state][1],
  href: `/demo/staff-link?state=${state}`,
}));
