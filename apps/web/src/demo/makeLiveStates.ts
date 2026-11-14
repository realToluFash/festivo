/** Make live's states (sc-3971, Events-A-MakeLive), on the engagement unless the state names its own event. */
export const MAKE_LIVE_STATES = [
  { key: 'makeLive', name: 'The question' },
  { key: 'makeLiveMaking', name: 'Making live…' },
  { key: 'makeLiveNotMade', name: 'Not made live' },
  { key: 'makeLiveHost', name: 'A draft with no host: Host 1' },
  { key: 'makeLiveHostBlank', name: 'Host 1 left empty' },
  { key: 'makeLiveChanged', name: 'Somebody else made it live' },
  { key: 'makeLiveCannotSend', name: 'A member who cannot send: no offer, ✓ Live' },
  { key: 'makeLiveOffer', name: 'The offer, with what the texts cost' },
  { key: 'makeLiveOfferEmail', name: 'The offer, everyone by email: no cost' },
  { key: 'makeLiveOfferOne', name: 'The offer, one guest by email' },
  { key: 'makeLiveOfferWaits', name: 'The offer, too few credits' },
  { key: 'makeLiveOfferPart', name: 'The offer, credits for some texts' },
  { key: 'makeLiveOfferWhatsApp', name: 'The offer, texts and WhatsApp at marketing (sc-45251)' },
  { key: 'makeLiveOfferWhatsAppOnly', name: 'The offer, WhatsApp only, at utility (sc-45251)' },
  { key: 'makeLiveOfferSending', name: 'Sending…' },
  { key: 'makeLiveOfferSent', name: 'After Send them: the toast and Messages' },
  { key: 'makeLiveOfferNotYet', name: 'After Not yet: Live, no toast' },
  { key: 'makeLiveOfferNotSent', name: 'Not sent' },
  { key: 'makeLiveOfferNobody', name: 'Nobody can be reached: no offer' },
  { key: 'makeLiveOfferRefused', name: 'Refused after Send them' },
  { key: 'makeLiveOfferForbidden', name: 'The role no longer sends (403)' },
  { key: 'makeLiveEndPassed', name: 'Refused: its end has passed' },
  { key: 'makeLiveNoOffer', name: 'Nobody on the list: no offer' },
  { key: 'madeLive', name: 'Live, nothing asked: ✓ Live' },
] as const;

export type MakeLiveState = (typeof MAKE_LIVE_STATES)[number]['key'];

const OWN_EVENT: Partial<Record<MakeLiveState, string>> = {
  makeLiveEndPassed: 'evt-shower-2',
  makeLiveNoOffer: 'evt-cena-4',
  madeLive: 'evt-cena-4',
};

export const MAKE_LIVE_EVENTS: Readonly<Record<MakeLiveState, string>> = Object.fromEntries(
  MAKE_LIVE_STATES.map((one) => [one.key, OWN_EVENT[one.key] ?? 'evt-draft-4']),
) as Record<MakeLiveState, string>;
