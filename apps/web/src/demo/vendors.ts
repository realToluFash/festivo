import { emailProblem, phoneLengthProblem } from '@soirely/domain';

import { SAMPLE, countryName, fullNumber } from './rules.ts';
import { CATEGORY_WORDS, VW } from './vendorsWords.ts';

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

type Seed = [id: string, name: string, category: Category, contact: string, reach: string];

/** Budget-A-Vendors' directory: v1 to v9 are the boards' (shared with sc-87's quotes), the rest fill it to 28 in use. A reach that starts with a digit is a number in the United Kingdom. */
const IN_USE: readonly Seed[] = [
  ['v1', 'Àbẹ̀ní Flowers', 'flowers', 'Àbẹ̀ní Oyelaran', 'hello@abeni.flowers'],
  ['v2', 'Beat Collective', 'music', 'Ade Ojo', 'bookings@beatcollective.co.uk'],
  ['v3', 'Bloom & Co', 'flowers', 'Ngozi Eze', 'ngozi@bloomandco.co.uk'],
  ['v4', 'Savour Kitchen', 'catering', 'Kofi Mensah', 'kofi@savourkitchen.co.uk'],
  ['v5', 'The Landmark', 'venue', 'Priya Shah', 'events@thelandmark.co.uk'],
  ['v6', 'Lens & Light', 'photography', 'Marco Rossi', 'marco@lensandlight.com'],
  ['v7', 'Delta Frames', 'photography', 'Tolu Ade', '20 7946 0321'],
  ['v8', 'Golden Spoon', 'catering', 'Ama Owusu', 'events@goldenspoon.co.uk'],
  ['v9', 'Harbour Boats', 'transport', 'Sam Okafor', '7700 900877'],
  ['v10', 'Sesame & Saffron', 'catering', 'Leila Haddad', 'leila@sesameandsaffron.co.uk'],
  ['v11', 'Silver Strings Quartet', 'music', 'Anna Kowalski', 'anna@silverstrings.co.uk'],
  ['v12', 'Stem & Petal', 'flowers', 'Chloé Dubois', 'chloe@stemandpetal.co.uk'],
  ['v13', 'Studio Kaito', 'photography', 'Kaito Tanaka', 'kaito@studiokaito.com'],
  ['v14', 'Swift Coaches', 'transport', 'Raj Patel', 'bookings@swiftcoaches.co.uk'],
  ['v15', 'Tavola Catering', 'catering', 'Giulia Bianchi', 'giulia@tavolacatering.co.uk'],
  ['v16', 'Tempo Brass', 'music', 'Daniel Osei', '7700 900412'],
  ['v17', 'Tent & Table Hire', 'hire', 'Oliver Grant', 'hire@tentandtable.co.uk'],
  ['v18', 'The Long Table', 'catering', 'Hannah Clarke', 'hello@thelongtable.co.uk'],
  ['v19', 'The Orangery', 'venue', 'Sofia Almeida', 'events@theorangery.co.uk'],
  ['v20', 'Town & Country Cars', 'transport', 'Liam Byrne', '7700 900653'],
  ['v21', 'Tulip Lane', 'flowers', 'Emma Novak', 'emma@tuliplane.co.uk'],
  ['v22', 'Umami Kitchen', 'catering', 'Kenji Watanabe', 'kenji@umamikitchen.co.uk'],
  ['v23', 'Vela Films', 'photography', 'Lucas Ferreira', 'lucas@velafilms.com'],
  ['v24', 'Velvet Rope Ushers', 'staffing', 'Bimpe Ojo', 'bimpe@velvetrope.co.uk'],
  ['v25', 'Victoria Rooms', 'venue', 'James Whitfield', 'bookings@victoriarooms.co.uk'],
  ['v26', 'Waterside Hall', 'venue', 'Aisha Rahman', '20 7946 0412'],
  ['v27', 'Wild Meadow Flowers', 'flowers', 'Rosa Mendes', 'rosa@wildmeadowflowers.co.uk'],
  ['v28', 'Wura Gele', 'other', 'Wura Lawal', 'wura@wuragele.co.uk'],
];

const ARCHIVED: readonly (readonly [Seed, string])[] = [
  [
    ['v29', 'Éclat Catering', 'catering', 'Claire Martin', 'claire@eclat-traiteur.fr'],
    '2026-10-12',
  ],
  [['v30', 'Marquee Masters', 'hire', 'Chuka Obi', '7700 900150'], '2026-10-12'],
];

const BLOOM = 'v3';
export const SAVOUR = 'v4';

function vendorOf([id, name, category, contact, reach]: Seed): Vendor {
  const phone = /^\d/.test(reach) ? reach : '';

  return {
    id,
    name,
    category,
    contact,
    email: phone === '' ? reach : '',
    country: phone === '' ? '' : 'GB',
    phone,
    website: '',
    address: '',
    note: '',
    archivedOn: null,
  };
}

export function sampleVendors(): Vendor[] {
  const kept = IN_USE.map(vendorOf);
  const gone = ARCHIVED.map(([seed, on]) => ({ ...vendorOf(seed), archivedOn: on }));
  const bloom = kept.find((one) => one.id === BLOOM);
  if (bloom != null) {
    bloom.country = 'GB';
    bloom.phone = '20 7946 0958';
    bloom.website = 'https://bloomandco.co.uk';
  }

  return [...kept, ...gone];
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

/** The page of In use, A to Z, that holds a vendor: where a vendor's name on an event's Budget lands. */
export function pageOf(vendors: readonly Vendor[], id: string): number {
  const at = shown(vendors, NOT_LOOKING).findIndex((one) => one.id === id);

  return at < 0 ? 1 : Math.floor(at / PAGE_SIZE) + 1;
}

export function reachOf(vendor: Pick<Vendor, 'email' | 'phone' | 'country'>): string | null {
  if (vendor.email !== '') return vendor.email;
  if (vendor.phone === '') return null;

  return fullNumber(vendor.phone, vendor.country);
}

export function archivedDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00Z`));
}

export function rowLine(vendor: Vendor, locale: string): string {
  const last =
    vendor.archivedOn != null
      ? VW.archivedOn(archivedDay(vendor.archivedOn, locale))
      : reachOf(vendor);

  return [vendor.contact, CATEGORY_WORDS[vendor.category], last]
    .filter((part) => part != null && part !== '')
    .join(' · ');
}

export function noMatchLine(looking: Looking): string {
  const q = looking.q.trim();
  const category = looking.category === 'all' ? null : CATEGORY_WORDS[looking.category];

  return q === '' && category != null
    ? VW.noneIn(category, looking.view === 'archived')
    : VW.noMatch(q, category);
}

export interface VendorsCard {
  says: string;
  line: string;
  tags: string[];
}

export function vendorsCard(vendors: readonly Vendor[]): VendorsCard {
  const inUse = vendors.filter((one) => one.archivedOn == null).length;
  const gone = vendors.length - inUse;

  if (inUse === 0)
    return {
      says: VW.noneYet,
      line: VW.noneYetLine(SAMPLE.organisation),
      tags: gone > 0 ? [VW.archivedCount(gone)] : [],
    };

  return {
    says: VW.vendors(inUse),
    line: VW.cardLine(SAMPLE.organisation),
    tags: [VW.inUseCount(inUse), ...(gone > 0 ? [VW.archivedCount(gone)] : [])],
  };
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

  if (draft.name.trim() === '') problems.name = VW.nameBlank;
  if (draft.category === '') problems.category = VW.categoryBlank;

  for (const field of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (problems[field] == null && lengthOf(draft[field]) > LIMITS[field])
      problems[field] = VW.shorten(LIMIT_WORDS[field], LIMITS[field].toLocaleString('en'));
  }

  if (problems.email == null && draft.email.trim() !== '' && emailProblem(draft.email) != null)
    problems.email = VW.emailShape;

  if (draft.phone.trim() !== '') {
    const problem = phoneLengthProblem(draft.phone, draft.country);
    if (problem === 'noCountry') problems.country = VW.countryBlank;
    else if (problem === 'tooShort' || problem === 'tooLong')
      problems.phone = VW.phoneLength(
        problem === 'tooShort' ? 'short' : 'long',
        countryName(draft.country),
      );
  }

  const scheme = schemeOf(draft.website);
  if (problems.website == null && scheme != null && scheme !== 'http' && scheme !== 'https')
    problems.website = VW.websiteScheme;

  return problems;
}

/** How many fields need fixing: the country and its number are one field. */
export function fieldsToFix(problems: Problems): number {
  return new Set(Object.keys(problems).map((key) => (key === 'country' ? 'phone' : key))).size;
}

export function notANumberFor(country: string): string {
  return VW.notANumber(countryName(country));
}

/** The demo's stand-in for the API refusing a number its country does not use: all zeros, as `?state=add_invalid` types. */
export function refusedPhone(draft: Draft): Problems {
  const digits = draft.phone.replace(/\D/g, '');

  return draft.country !== '' && digits !== '' && /^0+$/.test(digits)
    ? { phone: notANumberFor(draft.country) }
    : {};
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

/** The sample is read on Tue, Nov 3, 2026, as the wedding's Budget is (spec §1). */
export const TODAY = '2026-11-03';

export function archived(vendors: readonly Vendor[], id: string, on = TODAY): Vendor[] {
  return vendors.map((one) => (one.id === id ? { ...one, archivedOn: on } : one));
}

export function restored(vendors: readonly Vendor[], id: string): Vendor[] {
  return vendors.map((one) => (one.id === id ? { ...one, archivedOn: null } : one));
}

export type Load = 'loaded' | 'loading' | 'failed';

export type VendorsDialog =
  | { kind: 'add'; draft: Draft; problems: Problems }
  | { kind: 'edit'; id: string; draft: Draft; problems: Problems; refused?: boolean };

export interface VendorsStart {
  load: Load;
  vendors: Vendor[];
  looking: Looking;
  page: number;
  menu: 'category' | 'filter' | null;
  dialog: VendorsDialog | null;
  lit: string | null;
  told: string | null;
  searching: boolean;
}

function bloomDraft(vendors: readonly Vendor[]): Draft {
  const bloom = vendors.find((one) => one.id === BLOOM);

  return bloom == null ? BLANK : draftOf(bloom);
}

const REFUSED: Draft = {
  ...BLANK,
  name: 'Harbour Boats',
  category: 'transport',
  contact: 'Sam Okafor',
  email: 'sam@harbourboats',
  country: 'GB',
  phone: '000 000 0000',
  website: 'ftp://harbourboats.co.uk',
};

export function vendorsStart(state: string, vendor: string | null = null): VendorsStart {
  const vendors = state === 'empty' ? [] : sampleVendors();
  const wanted = vendor ?? (state === 'from_event' ? SAVOUR : null);
  const lit = vendors.some((one) => one.id === wanted && one.archivedOn == null) ? wanted : null;
  const start: VendorsStart = {
    load: 'loaded',
    vendors,
    looking: NOT_LOOKING,
    page: lit == null ? 1 : pageOf(vendors, lit),
    menu: null,
    dialog: null,
    lit,
    told: null,
    searching: false,
  };

  switch (state) {
    case 'loading':
    case 'failed':
      return { ...start, load: state };
    case 'next':
      return { ...start, page: 2 };
    case 'searched':
      return { ...start, looking: { ...NOT_LOOKING, q: 'bloom' }, searching: true };
    case 'filtered':
      return { ...start, looking: { ...NOT_LOOKING, category: 'flowers' } };
    case 'category_menu':
      return { ...start, menu: 'category' };
    case 'no_match':
      return { ...start, looking: { ...NOT_LOOKING, q: 'eclat', category: 'catering' } };
    case 'archived':
      return { ...start, looking: { ...NOT_LOOKING, view: 'archived' } };
    case 'add':
      return { ...start, dialog: { kind: 'add', draft: BLANK, problems: {} } };
    case 'add_blank':
      return { ...start, dialog: { kind: 'add', draft: BLANK, problems: draftProblems(BLANK) } };
    case 'add_invalid':
      return {
        ...start,
        dialog: {
          kind: 'add',
          draft: REFUSED,
          problems: { ...draftProblems(REFUSED), phone: notANumberFor('GB') },
        },
      };
    case 'too_long': {
      const draft = { ...BLANK, name: 'Bloom '.repeat(17).trim(), category: 'flowers' as const };
      return { ...start, dialog: { kind: 'add', draft, problems: draftProblems(draft) } };
    }
    case 'edit':
      return {
        ...start,
        dialog: { kind: 'edit', id: BLOOM, draft: bloomDraft(vendors), problems: {} },
      };
    case 'archive_refused':
      return {
        ...start,
        dialog: {
          kind: 'edit',
          id: BLOOM,
          draft: bloomDraft(vendors),
          problems: {},
          refused: true,
        },
      };
    case 'archived_toast': {
      const name = vendors.find((one) => one.id === BLOOM)?.name ?? '';
      return { ...start, vendors: archived(vendors, BLOOM), told: VW.archivedToast(name) };
    }
    default:
      return start;
  }
}

export function vendorsViewerKey(as: string | null, state: string): string | null {
  return state === 'member' ? 'ana' : as;
}

export interface DemoLink {
  to: string;
  name: string;
}

const at = (state?: string, extra: { as?: string; vendor?: string } = {}): string => {
  const query = new URLSearchParams();
  if (extra.as != null) query.set('as', extra.as);
  if (state != null) query.set('state', state);
  if (extra.vendor != null) query.set('vendor', extra.vendor);
  const search = query.toString();

  return `/demo/settings/vendors${search === '' ? '' : `?${search}`}`;
};

export const VENDORS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The directory',
    states: [
      { to: at('populated'), name: 'Owner, 1 to 25 of 28 (populated)' },
      { to: at('populated', { as: 'julien' }), name: 'Admin, the same' },
      { to: at('next'), name: 'The second page (next)' },
      { to: at('searched'), name: 'Searched for “bloom” (searched)' },
      { to: at('no_match'), name: 'No match for “eclat” in Catering (no_match)' },
      { to: at('category_menu'), name: 'The category menu open (category_menu)' },
      { to: at('filtered'), name: 'Flowers only (filtered)' },
      { to: at('empty'), name: 'No vendors yet (empty)' },
      { to: at('loading'), name: 'Loading (loading)' },
      { to: at('failed'), name: 'Failed (failed)' },
    ],
  },
  {
    name: 'Archived, added, edited',
    states: [
      { to: at('archived'), name: 'In use · 28 set to Archived · 2 (archived)' },
      { to: at('add'), name: 'Add a vendor (add)' },
      { to: at('add_blank'), name: 'Add, nothing typed (add_blank)' },
      { to: at('add_invalid'), name: 'Add, refused at three fields (add_invalid)' },
      { to: at('too_long'), name: 'A name over 100 characters (too_long)' },
      { to: at('edit'), name: 'Edit Bloom & Co, with Archive this vendor (edit)' },
      { to: at('archived_toast'), name: 'Bloom & Co archived (archived_toast)' },
      {
        to: at('archive_refused'),
        name: 'Archive refused: two events still owe Bloom & Co (archive_refused, sc-87)',
      },
    ],
  },
  {
    name: 'Who reaches it',
    states: [
      { to: at('member'), name: 'A member, on its address (member)' },
      { to: at(undefined, { as: 'ana' }), name: 'Ana, a member, on its address' },
      {
        to: at('from_event', { vendor: SAVOUR }),
        name: 'From Savour Kitchen on the wedding’s Budget (from_event)',
      },
      { to: at(undefined, { vendor: SAVOUR }), name: 'A vendor’s name, with no state' },
    ],
  },
];
