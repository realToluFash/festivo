import { SWITCHER_STATES, type SwitcherState } from './OrgSwitcherModel.ts';

/** The demo home's switcher group: each ?switcher= state, opened over Today. */
const BOARDS: Record<SwitcherState, readonly [string, string]> = {
  populated: ['open', 'Ire Events current, 2 invitations'],
  one: ['one organisation', 'Ire Events, then Create an organisation'],
  many: ['many', 'Over 15, with the search'],
  search: ['the search typed', '“even”'],
  'no-match': ['no match', '“Belém”'],
  offer: ['the offer, unasked', 'Ire Weddings, Ask to join'],
  'offer-asked': ['the offer, asked', 'Ire Weddings, Waiting for approval'],
  'offer-unavailable': ['the offer, unavailable', 'Ire Weddings, You cannot ask to join'],
  invitation: ['an invitation, opened', 'Celebraciones Alameda, Accept and join or Decline'],
  joined: ['an invitation, joined', 'Celebraciones Alameda, joined'],
  declined: ['an invitation, declined', 'Bluebird Gatherings, declined'],
  failed: ['an invitation, the answer failed', 'Bluebird Gatherings, try again'],
  busy: ['an invitation, sending', 'Joining… on the pressed pill, the other off'],
  refused: ['an invitation, refused', 'Bluebird Gatherings, Expired'],
  withdrawn: ['an invitation, withdrawn', 'Bluebird Gatherings, Withdrawn'],
  large: ['at accessibility sizes', 'Rows, names capped at 2 lines'],
  managed: ['an invitation, managed', 'Celebraciones Alameda, managed by Ire Events'],
};

export const SWITCHER_BOARDS = SWITCHER_STATES.map((state) => ({
  state,
  title: `The switcher · ${BOARDS[state][0]}`,
  what: BOARDS[state][1],
  href: `/demo/today?switcher=${state}`,
}));
