import type { EnquiryState } from './EnquiriesModel.ts';

const STATES: readonly [EnquiryState, string, string][] = [
  ['idle', 'Enquiries · Open', 'The field empty, Open with its rows, Assigned to me off'],
  ['won', 'Enquiries · Won', 'Nothing won yet, as sc-31232 alone makes an enquiry Won'],
  ['lost', 'Enquiries · Lost', 'The Lost tab'],
  ['emptyOpen', 'Enquiries · nothing open', 'Open’s empty line with New enquiry'],
  ['listFailed', 'Enquiries · did not load', 'The broken Notice and Try again, as Events’'],
  ['short', 'Search · one character', '“o” is ignored: the tabs stay as they were'],
  ['searching', 'Search · the pause', '“oka” typed, focus kept in the field, then it searches'],
  ['results', 'Search · results', '“oka”: Open 2 and Lost 1, 3 enquiries, no Won group'],
  ['onePhone', 'Search · a phone number', '“07400 123456” finds +44 7400 123456: 1 enquiry'],
  ['noMatch', 'Search · no match', '“0803 555 0142”, read as a UK number: No enquiries match'],
  ['assignedToMe', 'Search · Assigned to me', 'An Owner’s “oka” narrowed to her own: 1 enquiry'],
  ['member', 'Search · a Member', 'Tunde’s “oka”: only the two assigned to him'],
  [
    'memberNoMatch',
    'Search · a Member, another’s client',
    'Folake’s client’s number: the same no match',
  ],
  ['offline', 'Search · offline', 'Search needs a connection, the tabs as they were'],
  ['failed', 'Search · did not load', 'The broken Notice and Try again'],
  ['longNames', 'Search · a long name', 'A client’s name that wraps on the phone'],
];

/** Page 31221 · Enquiries, sc-31226’s list with sc-42749’s search. */
export const ENQUIRIES_BOARDS: readonly { title: string; what: string; href: string }[] =
  STATES.map(([state, title, what]) => ({
    title,
    what,
    href: state === 'idle' ? '/demo/enquiries' : `/demo/enquiries?state=${state}`,
  }));
