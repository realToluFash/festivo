import { emailProblem, phoneLengthProblem } from '@soirely/domain';

import { countryName, fullNumber } from './rules.ts';

export const CATEGORIES = [
  'catering',
  'venue',
  'flowers',
  'photography',
  'music',
  'transport',
  'staffing',
  'hire',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_WORDS: Record<Category, string> = {
  catering: 'Catering',
  venue: 'Venue',
  flowers: 'Flowers',
  photography: 'Photography',
  music: 'Music',
  transport: 'Transport',
  staffing: 'Staffing',
  hire: 'Hire',
  other: 'Other',
};

export const PAGE_SIZE = 25;

export type View = 'inUse' | 'archived';

export interface Vendor {
  id: string;
  name: string;
  category: Category;
  contact: string;
  email: string;
  country: string;
  phone: string;
  website: string;
  address: string;
  note: string;
  archivedOn: string | null;
}

type Seed = [name: string, category: Category, contact: string, email: string, phone?: string];

const SEEDS: readonly Seed[] = [
  ['Àbẹ̀ní Flowers', 'flowers', 'Àbẹ̀ní Okafor', 'hello@abeniflowers.ng'],
  ['Adire Lounge', 'venue', 'Kemi Bello', 'events@adirelounge.com'],
  ['Alaro Sound', 'music', 'Seyi Alaro', '', '803 555 0142'],
  ['Bloom & Co', 'flowers', 'Ngozi Eze', 'ngozi@bloomandco.ng'],
  ['Blue Gate Transport', 'transport', 'Musa Danjuma', 'bookings@bluegate.ng'],
  ['Calabar Kitchen', 'catering', 'Eno Bassey', 'eno@calabarkitchen.com'],
  ['Chairs and Canopies', 'hire', 'Tope Adebayo', '', '809 555 0177'],
  ['Delta Frames', 'photography', 'Efe Okoro', 'efe@deltaframes.com'],
  ['Éclat Catering', 'catering', 'Claire Martin', 'claire@eclat-traiteur.fr'],
  ['Eko Atlantic Hall', 'venue', 'Bisi Coker', 'halls@ekoatlantic.ng'],
  ['Fola Strings', 'music', 'Fola Ajayi', 'fola@folastrings.com'],
  ['Golden Spoon', 'catering', 'Ifeoma Nwosu', 'orders@goldenspoon.ng'],
  ['Harbour Shuttle', 'transport', 'Ahmed Bello', '', '802 555 0119'],
  ['Ikoyi Linen Hire', 'hire', 'Ronke Shittu', 'ronke@ikoyilinen.ng'],
  ['Jide Photography', 'photography', 'Jide Ogun', 'jide@jidephoto.ng'],
  ['Kola Security', 'staffing', 'Kola Hassan', 'kola@kolasecurity.ng'],
  ['Lagos Light Co', 'hire', 'Dayo Ige', 'hire@lagoslight.co'],
  ['Mama Put Deluxe', 'catering', 'Iya Basira', '', '806 555 0103'],
  ['Marquee Masters', 'hire', 'Chuka Obi', 'chuka@marqueemasters.ng'],
  ['Nkem Cakes', 'catering', 'Nkem Uba', 'nkem@nkemcakes.com'],
  ['Oriki Drums', 'music', 'Wale Oriki', 'wale@orikidrums.ng'],
  ['Petals by Tolu', 'flowers', 'Tolu Ade', 'tolu@petals.ng'],
  ['Quay Valet', 'staffing', 'Sola Martins', 'valet@quay.ng'],
  ['Rooftop at Victoria', 'venue', 'Ada Igwe', 'ada@rooftopvi.com'],
  ['Sapele Waiters', 'staffing', 'Ese Oghene', '', '805 555 0188'],
  ['The Glass House', 'venue', 'Lara Coker', 'lara@theglasshouse.ng'],
  ['Uche Visuals', 'photography', 'Uche Kalu', 'uche@uchevisuals.com'],
  ['Velvet Rope Ushers', 'staffing', 'Bimpe Ojo', 'bimpe@velvetrope.ng'],
  ['Wura Gele', 'other', 'Wura Lawal', 'wura@wuragele.ng'],
  ['Zest Bar Service', 'catering', 'Femi Kuti', 'bar@zest.ng'],
];

const ARCHIVED: readonly (readonly [Seed, string])[] = [
  [['Bloom and Co', 'flowers', 'Ngozi Eze', 'ngozi@bloomandco.ng'], '2026-10-12'],
  [['Ikeja Party Rentals', 'hire', 'Gbenga Ola', '', '807 555 0150'], '2026-09-30'],
  [['Sunset Band', 'music', '', 'sunsetband@gmail.com'], '2026-08-04'],
];

function vendorOf([name, category, contact, email, phone = '']: Seed, index: number): Vendor {
  return {
    id: `v${index + 1}`,
    name,
    category,
    contact,
    email,
    country: phone === '' ? '' : 'NG',
    phone,
    website: '',
    address: '',
    note: '',
    archivedOn: null,
  };
}

export function sampleVendors(): Vendor[] {
  const kept = SEEDS.map(vendorOf);
  const archived = ARCHIVED.map(([seed, on], index) => ({
    ...vendorOf(seed, SEEDS.length + index),
    archivedOn: on,
  }));
  const bloom = kept.find((one) => one.name === 'Bloom & Co');
  if (bloom != null) {
    bloom.website = 'https://bloomandco.ng';
    bloom.address = '14 Awolowo Road, Ikoyi, Lagos';
    bloom.note = 'Ask for Ngozi. Needs the venue’s loading times a week ahead.';
  }

  return [...kept, ...archived];
}

/** A to Z ignoring case, as the API orders them; accents still count. */
export function inNameOrder(vendors: readonly Vendor[]): Vendor[] {
  return [...vendors].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'accent' }));
}

export interface Looking {
  view: View;
  q: string;
  category: Category | 'all';
}

export const NOT_LOOKING: Looking = { view: 'inUse', q: '', category: 'all' };

/** A name containing the typed text, ignoring case: accents are matched as typed. */
export function nameMatches(name: string, typed: string): boolean {
  return name.toLowerCase().includes(typed.trim().toLowerCase());
}

export function inView(vendor: Vendor, view: View): boolean {
  return view === 'archived' ? vendor.archivedOn != null : vendor.archivedOn == null;
}

export function shown(vendors: readonly Vendor[], looking: Looking): Vendor[] {
  return inNameOrder(
    vendors.filter(
      (one) =>
        inView(one, looking.view) &&
        nameMatches(one.name, looking.q) &&
        (looking.category === 'all' || one.category === looking.category),
    ),
  );
}

export function isLooking(looking: Looking): boolean {
  return looking.q.trim() !== '' || looking.category !== 'all';
}

export interface Paged {
  rows: Vendor[];
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
}

export function paged(rows: readonly Vendor[], page: number): Paged {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const at = Math.min(Math.max(1, page), pages);
  const start = (at - 1) * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);

  return {
    rows: slice,
    page: at,
    pages,
    from: slice.length === 0 ? 0 : start + 1,
    to: start + slice.length,
    total: rows.length,
  };
}

export function reachOf(vendor: Pick<Vendor, 'email' | 'phone' | 'country'>): string | null {
  if (vendor.email !== '') return vendor.email;
  if (vendor.phone === '') return null;

  return fullNumber(vendor.phone, vendor.country);
}

export function noMatchLine(looking: Looking): string {
  const q = looking.q.trim();
  const where =
    looking.category === 'all' ? '' : ` in ${CATEGORY_WORDS[looking.category].toLowerCase()}`;
  const archived = looking.view === 'archived' ? ' archived' : '';

  return q === ''
    ? `No${archived} vendors${where}.`
    : `No${archived} vendors${where} have “${q}” in their name.`;
}

export interface Draft {
  name: string;
  category: Category | '';
  contact: string;
  email: string;
  country: string;
  phone: string;
  website: string;
  address: string;
  note: string;
}

export const BLANK: Draft = {
  name: '',
  category: '',
  contact: '',
  email: '',
  country: '',
  phone: '',
  website: '',
  address: '',
  note: '',
};

export function draftOf(vendor: Vendor): Draft {
  const { name, category, contact, email, country, phone, website, address, note } = vendor;

  return { name, category, contact, email, country, phone, website, address, note };
}

export type DraftField = keyof Omit<Draft, 'country'>;
export type Problems = Partial<Record<DraftField | 'country', string>>;

/** The longest each field may be, in characters (decided 17 Oct). */
export const LIMITS: Record<Exclude<DraftField, 'category' | 'phone'>, number> = {
  name: 100,
  contact: 100,
  email: 254,
  website: 2048,
  address: 300,
  note: 1000,
};

const LIMIT_WORDS: Record<keyof typeof LIMITS, string> = {
  name: 'the name',
  contact: 'the contact name',
  email: 'the email address',
  website: 'the website',
  address: 'the address',
  note: 'the note',
};

export function lengthOf(typed: string): number {
  return [...typed.trim()].length;
}

/** A scheme the user typed, `ftp` from `ftp://…` or `mailto` from `mailto:…`; none for `bloom.co`. */
export function schemeOf(typed: string): string | null {
  const found = /^([a-z][a-z0-9+.-]*):(\/\/|(?!\d))/i.exec(typed.trim());

  return found?.[1]?.toLowerCase() ?? null;
}

export function savedWebsite(typed: string): string {
  const trimmed = typed.trim();

  return trimmed === '' || schemeOf(trimmed) != null ? trimmed : `https://${trimmed}`;
}

export function draftProblems(draft: Draft): Problems {
  const problems: Problems = {};

  if (draft.name.trim() === '') problems.name = 'Enter the vendor’s name.';
  if (draft.category === '') problems.category = 'Choose the category.';

  for (const field of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (problems[field] == null && lengthOf(draft[field]) > LIMITS[field])
      problems[field] =
        `Shorten ${LIMIT_WORDS[field]} to ${LIMITS[field].toLocaleString('en')} characters or fewer.`;
  }

  if (problems.email == null && draft.email.trim() !== '' && emailProblem(draft.email) != null)
    problems.email = 'That does not look like an email address. Check it has an @ and a domain.';

  if (draft.phone.trim() !== '') {
    const problem = phoneLengthProblem(draft.phone, draft.country);
    if (problem === 'noCountry') problems.country = 'Choose a country.';
    else if (problem === 'tooShort' || problem === 'tooLong')
      problems.phone = `That number looks too ${problem === 'tooShort' ? 'short' : 'long'} for ${countryName(draft.country)}. Check it and try again.`;
  }

  const scheme = schemeOf(draft.website);
  if (problems.website == null && scheme != null && scheme !== 'http' && scheme !== 'https')
    problems.website =
      'Enter a web address that starts with https:// or http://, or leave that part off.';

  return problems;
}

/** The API's own answer on a number of the right length that its country does not use. */
export function notANumberFor(country: string): string {
  return `That is not a phone number for ${countryName(country)}. Check it and try again.`;
}

export function savedVendor(draft: Draft, id: string): Vendor {
  return {
    id,
    name: draft.name.trim(),
    category: draft.category === '' ? 'other' : draft.category,
    contact: draft.contact.trim(),
    email: draft.email.trim(),
    country: draft.phone.trim() === '' ? '' : draft.country,
    phone: draft.phone.trim(),
    website: savedWebsite(draft.website),
    address: draft.address.trim(),
    note: draft.note.trim(),
    archivedOn: null,
  };
}

export function changed(draft: Draft, from: Draft): boolean {
  return (Object.keys(from) as (keyof Draft)[]).some((key) => draft[key] !== from[key]);
}

export const TODAY = '2026-11-07';

export function archived(vendors: readonly Vendor[], id: string, on = TODAY): Vendor[] {
  return vendors.map((one) => (one.id === id ? { ...one, archivedOn: on } : one));
}

export function restored(vendors: readonly Vendor[], id: string): Vendor[] {
  return vendors.map((one) => (one.id === id ? { ...one, archivedOn: null } : one));
}

export function archiveRefused(name: string): string {
  return `${name} was not archived, because the events below still have payments to it that are not paid or cancelled. Once each one is paid or cancelled, you can archive the vendor.`;
}

export function owingLink(vendor: string, event: string): string {
  return `Payments to ${vendor} on ${event}`;
}

export type Load = 'loaded' | 'loading' | 'failed';

export type VendorsDialog =
  | { kind: 'add'; draft: Draft; problems: Problems }
  | { kind: 'edit'; id: string; draft: Draft; problems: Problems; refused?: boolean }
  | { kind: 'read'; id: string };

export interface VendorsStart {
  load: Load;
  vendors: Vendor[];
  looking: Looking;
  page: number;
  menu: boolean;
  readOnly: boolean;
  dialog: VendorsDialog | null;
}

const BLOOM = 'v4';

function bloomDraft(vendors: readonly Vendor[], change: Partial<Draft>): Draft {
  const bloom = vendors.find((one) => one.id === BLOOM);

  return { ...(bloom == null ? BLANK : draftOf(bloom)), ...change };
}

export function vendorsStart(state: string, vendorId: string | null = null): VendorsStart {
  const vendors = state === 'empty' ? [] : sampleVendors();
  const start: VendorsStart = {
    load: 'loaded',
    vendors,
    looking: NOT_LOOKING,
    page: 1,
    menu: false,
    readOnly: false,
    dialog: null,
  };
  const invalid: Draft = {
    ...BLANK,
    name: 'Harbour Boats',
    category: 'transport',
    email: 'bookings@harbour',
    country: 'NG',
    phone: '000 000 0000',
    website: 'ftp://harbourboats.ng',
  };

  const asked = vendors.find((one) => one.id === vendorId);
  if (asked != null && (state === '' || state === 'read_only')) {
    return state === 'read_only'
      ? { ...start, readOnly: true, dialog: { kind: 'read', id: asked.id } }
      : {
          ...start,
          dialog: { kind: 'edit', id: asked.id, draft: draftOf(asked), problems: {} },
        };
  }

  switch (state) {
    case 'loading':
    case 'failed':
      return { ...start, load: state };
    case 'next':
      return { ...start, page: 2 };
    case 'search':
      return { ...start, looking: { ...NOT_LOOKING, q: 'bloom' } };
    case 'filtered':
      return { ...start, looking: { ...NOT_LOOKING, category: 'flowers' } };
    case 'menu':
      return { ...start, menu: true };
    case 'noMatch':
      return { ...start, looking: { ...NOT_LOOKING, q: 'eclat' } };
    case 'noMatchFiltered':
      return { ...start, looking: { ...NOT_LOOKING, q: 'bloom', category: 'catering' } };
    case 'archived':
      return { ...start, looking: { ...NOT_LOOKING, view: 'archived' } };
    case 'add':
      return { ...start, dialog: { kind: 'add', draft: BLANK, problems: {} } };
    case 'blank':
      return { ...start, dialog: { kind: 'add', draft: BLANK, problems: draftProblems(BLANK) } };
    case 'invalid':
      return {
        ...start,
        dialog: {
          kind: 'add',
          draft: invalid,
          problems: { ...draftProblems(invalid), phone: notANumberFor('NG') },
        },
      };
    case 'too_long': {
      const draft = { ...BLANK, name: 'Bloom '.repeat(17).trim(), category: 'flowers' as const };
      return { ...start, dialog: { kind: 'add', draft, problems: draftProblems(draft) } };
    }
    case 'edit':
      return {
        ...start,
        dialog: { kind: 'edit', id: BLOOM, draft: bloomDraft(vendors, {}), problems: {} },
      };
    case 'archive_refused':
      return {
        ...start,
        dialog: {
          kind: 'edit',
          id: BLOOM,
          draft: bloomDraft(vendors, {}),
          problems: {},
          refused: true,
        },
      };
    case 'read_only':
      return { ...start, readOnly: true };
    case 'read_only_open':
      return { ...start, readOnly: true, dialog: { kind: 'read', id: BLOOM } };
    default:
      return start;
  }
}

export interface DemoLink {
  to: string;
  name: string;
}

const at = (state?: string, as?: string): string => {
  const query = new URLSearchParams();
  if (as != null) query.set('as', as);
  if (state != null) query.set('state', state);
  const search = query.toString();

  return `/demo/vendors${search === '' ? '' : `?${search}`}`;
};

/** One vendor open in the directory, as a quote's vendor name links to it (sc-87). */
export function vendorAt(id: string, as: string | null = null): string {
  const query = new URLSearchParams({ vendor: id });
  if (as != null) query.set('as', as);

  return `/demo/vendors?${query.toString()}`;
}

export const VENDORS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The directory',
    states: [
      { to: at(), name: 'Owner, the first page of 30' },
      { to: at(undefined, 'julien'), name: 'Admin, the same' },
      { to: at('next'), name: 'The second page' },
      { to: at('loading'), name: 'Loading' },
      { to: at('failed'), name: 'Failed' },
      { to: at('empty'), name: 'No vendors yet' },
    ],
  },
  {
    name: 'Finding one',
    states: [
      { to: at('search'), name: 'Searched for “bloom”' },
      { to: at('menu'), name: 'The category menu open' },
      { to: at('filtered'), name: 'Flowers only' },
      { to: at('noMatch'), name: 'No match: “eclat” is not “Éclat”' },
      { to: at('noMatchFiltered'), name: 'No match in a category' },
      { to: at('archived'), name: 'Archived, with their dates' },
    ],
  },
  {
    name: 'Add or edit a vendor',
    states: [
      { to: at('add'), name: 'Add a vendor' },
      { to: at('blank'), name: 'Saved with nothing typed (blank)' },
      { to: at('invalid'), name: 'Not an address, a number or a web address (invalid)' },
      { to: at('too_long'), name: 'A name over 100 characters (too_long)' },
      { to: at('edit'), name: 'Edit Bloom & Co, with Archive' },
      { to: vendorAt('v9'), name: 'One vendor open, as a quote links to it (?vendor=v9)' },
      {
        to: at('archive_refused'),
        name: 'Archive refused: two events still owe Bloom & Co (sc-87)',
      },
    ],
  },
  {
    name: 'Who sees it',
    states: [
      { to: at('read_only'), name: 'After a downgrade: read only (read_only)' },
      { to: at('read_only_open'), name: 'Read only, a vendor open' },
      { to: at(undefined, 'ana'), name: 'A member, on its address' },
    ],
  },
];
