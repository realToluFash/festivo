/** Make live's states (sc-3971), on the engagement unless the state says otherwise. */
export const MAKE_LIVE_STATES = [
  { key: 'makeLive', name: 'The question' },
  { key: 'makeLiveMaking', name: 'Making live…' },
  { key: 'makeLiveNotMade', name: 'Not made live' },
  { key: 'makeLiveOfferEmail', name: 'The offer, all by email: no credits' },
  { key: 'makeLiveOffer', name: 'The offer, the texts covered' },
  { key: 'makeLiveOfferPart', name: 'The offer, credits for one text of three' },
  { key: 'makeLiveOfferWaits', name: 'The offer, no credits: every text waits' },
  { key: 'makeLiveOfferOne', name: 'The offer, one guest' },
  { key: 'makeLiveOfferSending', name: 'Sending…' },
  { key: 'makeLiveOfferNotSent', name: 'Not sent' },
  { key: 'makeLiveOfferNobody', name: 'Nobody can be reached: no offer' },
  { key: 'makeLiveOfferRefused', name: 'Refused after Send them' },
  { key: 'makeLiveOfferForbidden', name: 'The role no longer sends (403)' },
  { key: 'makeLiveOfferSent', name: 'After Send them: the toast' },
  { key: 'makeLiveOfferNotYet', name: 'After Not yet: Live, no toast' },
  { key: 'madeLive', name: 'Live, nothing asked: ✓ Live' },
  { key: 'makeLiveNoOffer', name: 'Nobody on the list: Make live ends on ✓ Live' },
] as const;

export type MakeLiveState = (typeof MAKE_LIVE_STATES)[number]['key'];

export const MAKE_LIVE_EVENTS: Readonly<Record<MakeLiveState, string>> = Object.fromEntries(
  MAKE_LIVE_STATES.map((one) => [
    one.key,
    one.key === 'makeLiveNoOffer' ? 'evt-cena-4' : 'evt-draft-4',
  ]),
) as Record<MakeLiveState, string>;
