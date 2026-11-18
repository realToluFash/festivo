import type { EnquiryTab } from './EnquiriesModel.ts';

/** The board's English, proposals for [l10n]: the developer puts them in the four locales when the screen is built. */
export const W = {
  enquiries: 'Enquiries',
  newEnquiry: 'New enquiry',
  search: 'Search enquiries',
  assignedToMe: 'Assigned to me',
  notAssigned: 'Not assigned',
  noDate: 'No date yet',
  tabs: { open: 'Open', won: 'Won', lost: 'Lost' } satisfies Record<EnquiryTab, string>,
  empty: {
    open: {
      title: 'No open enquiries',
      line: 'A call you record stays on Open until it is won or closed as lost.',
    },
    won: {
      title: 'Nothing won yet',
      line: 'An enquiry moves here once it becomes an event.',
    },
    lost: {
      title: 'Nothing lost',
      line: 'An enquiry closed as lost stays here, with its reason.',
    },
  } satisfies Record<EnquiryTab, { title: string; line: string }>,
  count: (count: number) => (count === 1 ? '1 enquiry' : `${count} enquiries`),
  noMatch: 'No enquiries match',
  searched: (q: string) => `You searched for “${q}”.`,
  listFailed: 'The enquiries did not load. Try again in a moment.',
  searchFailed: 'The search did not load. Try again in a moment.',
  ownDesign: (what: string) => `${what} is drawn for sc-31226, not here.`,
} as const;
