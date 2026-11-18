import type { EnquiryState } from './EnquiriesModel.ts';
import type { NewState } from './EnquiryFormModel.ts';
import { PAGE_IDS, type PageState } from './EnquiryPageModel.ts';
import type { WayInState } from './WayInModel.ts';

type Board = { title: string; what: string; href: string };

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
  ['lostEmpty', 'Enquiries · nothing lost', 'Lost’s empty line'],
  ['loading', 'Enquiries · loading', 'Events’ skeleton: the field off, sunk tabs, row shapes'],
  [
    'refreshing',
    'Enquiries · refreshing',
    'The rows stay, Events’ refreshing line under the title',
  ],
  ['mine', 'Enquiries · Assigned to me', 'An Owner’s list with Assigned to me on, no search'],
  ['memberList', 'Enquiries · a Member', 'Tunde’s list: only what is assigned to him, no filter'],
];

const NEW: readonly [NewState, string, string][] = [
  ['blank', 'New enquiry · blank', 'Every field empty, Save enquiry on'],
  ['nameAndPhone', 'New enquiry · name and phone', 'Enough to save: Save sends it'],
  ['invalidContact', 'New enquiry · no way to reach them', 'No phone or email: Phone is red'],
  ['invalidPhone', 'New enquiry · not a phone number', '“04000 000000” for the United Kingdom'],
  ['fixedLine', 'New enquiry · a fixed line', '“020 7946 0018” is accepted and Save works'],
  [
    'phoneTooShort',
    'New enquiry · a number too short',
    '“0770 090”: too short for the United Kingdom',
  ],
  [
    'phoneTooLong',
    'New enquiry · a number too long',
    '“07700 900456 789”: too long for the United Kingdom',
  ],
  ['invalidDate', 'New enquiry · a date that has passed', '10 Nov 2026, before today'],
  [
    'invalidName',
    'New enquiry · a name too long',
    '101 characters: Keep the name to 100 characters',
  ],
  ['invalidEmail', 'New enquiry · not an email', '“ama@”: no domain'],
  ['invalidGuests', 'New enquiry · guests', '“0”: a whole number from 1 to 100,000'],
  ['invalidWhere', 'New enquiry · where, too long', 'Over 200 characters'],
  [
    'invalidBudget',
    'New enquiry · budget decimals',
    '“120.555” in GBP: GBP takes 2 decimal places',
  ],
  ['invalidNote', 'New enquiry · a note too long', 'Over 5,000 characters, the counter showing'],
  [
    'duplicateAdmin',
    'New enquiry · same client, an Owner',
    'Ada’s number: who has it, and Open it',
  ],
  [
    'duplicateMember',
    'New enquiry · same client, a Member',
    'Someone else’s client: the line, no name',
  ],
  ['noConnection', 'New enquiry · no connection', 'Nothing saved, everything typed still there'],
  ['member', 'New enquiry · a Member', 'No Assigned to: it is his'],
  ['saving', 'New enquiry · saving', 'Saving…, the fields held'],
  ['keyboardSe', 'New enquiry · the keys up', 'The name focused, the keys up on a small phone'],
];

const PAGE: readonly [PageState, string, string][] = [
  ['open', 'Enquiry · Open', 'Ada Okafor as Folake: reach them, the event, Assigned to, notes'],
  ['openMember', 'Enquiry · a Member', 'Femi as Tunde: Assigned to you, no picker'],
  ['notFound', 'Enquiry · not here', 'Tunde opening Ada’s: This enquiry isn’t here'],
  ['withNotes', 'Enquiry · notes', 'Two notes, the newest first, one Edited'],
  ['editNote', 'Enquiry · editing a note', 'Folake’s own note open to edit'],
  [
    'closeAsLost',
    'Enquiry · Close as lost',
    'Sheet on a phone, centred upright, docked on its side',
  ],
  [
    'closeAsLostTooLong',
    'Enquiry · Close as lost, too long',
    'A 201-character line: Keep it to 200 characters',
  ],
  ['lost', 'Enquiry · Lost', 'The Lost banner, its line, and Reopen'],
  ['lostNoLine', 'Enquiry · Lost, no line', 'Ngozi Umeh, Chose someone else, no line'],
  ['notAssigned', 'Enquiry · not given', 'Chinedu: Not assigned, every fact Not given'],
  ['whatsapp', 'Enquiry · WhatsApp', 'Best way WhatsApp: the WhatsApp button'],
  ['loadFailed', 'Enquiry · did not load', 'The broken Notice and Try again'],
  [
    'datePassed',
    'Enquiry · the date has passed',
    'Bisi’s 7 Nov shown plainly; Edit and notes still work',
  ],
];

const WAY_IN: readonly [WayInState, string, string][] = [
  ['eventsEnterprise', 'Events · Enterprise', 'The Enquiries row under the title block'],
  ['eventsFree', 'Events · Free', 'No row: Events as it is today'],
  ['eventsFirstRun', 'Events · first run', 'The row above the first-event welcome'],
  ['eventsLoading', 'Events · loading', 'The row while the list loads'],
  ['eventsFailed', 'Events · did not load', 'The row above the broken Notice'],
  ['wayInOffline', 'Events · offline', 'The row with the offline band'],
  ['eventsSearch', 'Events · searching', '“lucia” searched, the row stays'],
  [
    'wayInFr',
    'Events · French',
    'The row reads Demandes; at 200 percent it grows, whole on one line',
  ],
  ['wayInEs', 'Events · Spanish', 'The row reads Consultas'],
  ['wayInPt', 'Events · Portuguese', 'The row reads Pedidos'],
  ['enquiriesBack', 'Events · back from Enquiries', 'Opens Enquiries; Back lands on Events'],
];

export const NEW_ENQUIRY_BOARDS: readonly Board[] = NEW.map(([state, title, what]) => ({
  title,
  what,
  href: state === 'blank' ? '/demo/enquiries/new' : `/demo/enquiries/new?state=${state}`,
}));

export const ENQUIRY_PAGE_BOARDS: readonly Board[] = PAGE.map(([state, title, what]) => ({
  title,
  what,
  href: `/demo/enquiries/${PAGE_IDS[state]}${state === 'open' ? '' : `?state=${state}`}`,
}));

export const WAY_IN_BOARDS: readonly Board[] = WAY_IN.map(([state, title, what]) => ({
  title,
  what,
  href: `/demo/events?state=${state}`,
}));

/** Page 31221 · Enquiries, sc-31226’s list with sc-42749’s search. */
export const ENQUIRIES_BOARDS: readonly Board[] = STATES.map(([state, title, what]) => ({
  title,
  what,
  href: state === 'idle' ? '/demo/enquiries' : `/demo/enquiries?state=${state}`,
}));
