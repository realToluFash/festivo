import { describe, expect, it } from 'vitest';

import { VIEWERS, groupsFor } from './settings.ts';
import {
  BLANK,
  CATEGORIES,
  NOT_LOOKING,
  PAGE_SIZE,
  SAVOUR,
  VENDORS_PAGES,
  archived,
  archivedDay,
  draftProblems,
  fieldsToFix,
  inNameOrder,
  nameMatches,
  noMatchLine,
  pageOf,
  paged,
  reachOf,
  refusedPhone,
  restored,
  rowLine,
  sampleVendors,
  savedWebsite,
  schemeOf,
  shown,
  vendorsCard,
  vendorsStart,
  vendorsViewerKey,
} from './vendors.ts';
import { VW } from './vendorsWords.ts';

const STATES = [
  'populated',
  'searched',
  'no_match',
  'category_menu',
  'empty',
  'archived',
  'add_blank',
  'add_invalid',
  'edit',
  'archived_toast',
  'member',
  'from_event',
  'loading',
  'failed',
];

describe('the vendor directory’s rules (sc-82)', () => {
  it('holds 28 in use and 2 archived, the boards’ nine at their ids', () => {
    const vendors = sampleVendors();
    const inUse = shown(vendors, NOT_LOOKING);
    const byCategory = Object.fromEntries(
      CATEGORIES.map((key) => [key, inUse.filter((one) => one.category === key).length]),
    );

    expect(inUse).toHaveLength(28);
    expect(shown(vendors, { ...NOT_LOOKING, view: 'archived' })).toHaveLength(2);
    expect(byCategory).toEqual({
      catering: 6,
      venue: 4,
      flowers: 5,
      photography: 4,
      music: 3,
      transport: 3,
      staffing: 1,
      hire: 1,
      other: 1,
    });
    expect(
      ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9'].map((id) => {
        const one = vendors.find((each) => each.id === id);
        return one == null ? id : `${one.name} · ${one.contact} · ${reachOf(one)}`;
      }),
    ).toEqual([
      'Àbẹ̀ní Flowers · Àbẹ̀ní Oyelaran · hello@abeni.flowers',
      'Beat Collective · Ade Ojo · bookings@beatcollective.co.uk',
      'Bloom & Co · Ngozi Eze · ngozi@bloomandco.co.uk',
      'Savour Kitchen · Kofi Mensah · kofi@savourkitchen.co.uk',
      'The Landmark · Priya Shah · events@thelandmark.co.uk',
      'Lens & Light · Marco Rossi · marco@lensandlight.com',
      'Delta Frames · Tolu Ade · +44 20 7946 0321',
      'Golden Spoon · Ama Owusu · events@goldenspoon.co.uk',
      'Harbour Boats · Sam Okafor · +44 7700 900877',
    ]);
    expect(vendors.filter((one) => one.phone !== '').every((one) => one.country === 'GB')).toBe(
      true,
    );
  });

  it('lists in name order, A to Z ignoring case, 25 a page, as the board’s first rows', () => {
    const names = inNameOrder([
      { ...sampleVendors()[0]!, name: 'zest' },
      { ...sampleVendors()[0]!, name: 'Bloom' },
      { ...sampleVendors()[0]!, name: 'adire' },
    ]).map((one) => one.name);
    const inUse = shown(sampleVendors(), NOT_LOOKING);

    expect(names).toEqual(['adire', 'Bloom', 'zest']);
    expect(PAGE_SIZE).toBe(25);
    expect(inUse.slice(0, 8).map((one) => one.name)).toEqual([
      'Àbẹ̀ní Flowers',
      'Beat Collective',
      'Bloom & Co',
      'Delta Frames',
      'Golden Spoon',
      'Harbour Boats',
      'Lens & Light',
      'Savour Kitchen',
    ]);
    expect(paged(inUse, 1)).toMatchObject({ from: 1, to: 25, pages: 2, total: 28 });
    expect(paged(inUse, 2)).toMatchObject({ from: 26, to: 28, page: 2 });
    expect(paged(inUse, 9).page).toBe(2);
    expect(VW.page(1, 25, 28)).toBe('1 to 25 of 28, A to Z');
  });

  it('matches a name containing the typed text, ignoring case but not accents', () => {
    expect(nameMatches('Bloom & Co', '  BLOOM ')).toBe(true);
    expect(nameMatches('Town & Country Cars', 'y c')).toBe(true);
    expect(nameMatches('Éclat Catering', 'éclat')).toBe(true);
    expect(nameMatches('Éclat Catering', 'eclat')).toBe(false);
    expect(shown(sampleVendors(), { ...NOT_LOOKING, q: 'bloom' }).map((one) => one.id)).toEqual([
      'v3',
    ]);
  });

  it('keeps archived vendors out of In use, and lists them under Archived', () => {
    const vendors = sampleVendors();
    const later = archived(vendors, 'v3', '2026-11-03');

    expect(shown(later, NOT_LOOKING).map((one) => one.id)).not.toContain('v3');
    expect(later.find((one) => one.id === 'v3')?.archivedOn).toBe('2026-11-03');
    expect(shown(restored(later, 'v3'), NOT_LOOKING).map((one) => one.id)).toContain('v3');
  });

  it('writes a row as its contact, category and email, else phone, or the day it was archived', () => {
    const vendors = sampleVendors();
    const of = (id: string) => vendors.find((one) => one.id === id)!;

    expect(rowLine(of('v4'), 'en-US')).toBe('Kofi Mensah · Catering · kofi@savourkitchen.co.uk');
    expect(rowLine(of('v7'), 'en-US')).toBe('Tolu Ade · Photography · +44 20 7946 0321');
    expect(rowLine(of('v29'), 'en-US')).toBe('Claire Martin · Catering · Archived Mon, Oct 12');
    expect(rowLine({ ...of('v4'), contact: '', email: '' }, 'en-US')).toBe('Catering');
    expect(archivedDay('2026-10-12', 'en-GB')).toBe('Mon 12 Oct');
    expect(reachOf({ email: '', phone: '', country: '' })).toBeNull();
  });

  it('says what was looked for, and in which category', () => {
    expect(noMatchLine({ ...NOT_LOOKING, q: 'eclat', category: 'catering' })).toBe(
      'No vendor matches “eclat” in Catering.',
    );
    expect(noMatchLine({ ...NOT_LOOKING, q: ' eclat ' })).toBe('No vendor matches “eclat”.');
    expect(noMatchLine({ view: 'archived', q: '', category: 'flowers' })).toBe(
      'No archived vendors in Flowers.',
    );
  });

  it('counts the card as Members does, and says what an empty directory is for', () => {
    expect(vendorsCard(sampleVendors())).toEqual({
      says: '28 vendors',
      line: 'The people Ire Events buys from, chosen on each event’s quotes.',
      tags: ['28 in use', '2 archived'],
    });
    expect(vendorsCard([])).toEqual({
      says: 'No vendors yet',
      line: 'Add the caterers, florists and venues Ire Events buys from, once, and choose them on any event’s quote.',
      tags: [],
    });
  });

  it('requires a name and a category, a name of spaces being blank', () => {
    const problems = draftProblems({ ...BLANK, name: '   ' });

    expect(problems).toEqual({
      name: "Enter the vendor's name.",
      category: 'Choose the category.',
    });
    expect(VW.toFix(fieldsToFix(problems))).toBe('2 fields need fixing, so nothing was sent.');
    expect(VW.toFix(1)).toBe('One field needs fixing, so nothing was sent.');
    expect(draftProblems({ ...BLANK, name: 'Bloom', category: 'flowers' })).toEqual({});
  });

  it('refuses over each limit, naming it', () => {
    const problems = draftProblems({
      ...BLANK,
      name: 'n'.repeat(101),
      category: 'other',
      contact: 'c'.repeat(101),
      address: 'a'.repeat(301),
      note: 'x'.repeat(1001),
    });

    expect(problems.name).toBe('Shorten the name to 100 characters or fewer.');
    expect(problems.contact).toBe('Shorten the contact name to 100 characters or fewer.');
    expect(problems.address).toBe('Shorten the address to 300 characters or fewer.');
    expect(problems.note).toBe('Shorten the note to 1,000 characters or fewer.');
    expect(draftProblems({ ...BLANK, name: 'n'.repeat(100), category: 'other' })).toEqual({});
  });

  it('checks the email, phone and website only when typed', () => {
    const base = { ...BLANK, name: 'Harbour', category: 'transport' as const };

    expect(draftProblems({ ...base, email: 'sam@harbourboats' }).email).toBe(
      'That does not look like an email address. Check it has an @ and a domain.',
    );
    expect(draftProblems({ ...base, phone: '7700 900877' }).country).toBe('Choose a country.');
    expect(draftProblems({ ...base, country: 'GB', phone: '77' }).phone).toBe(
      'That number looks too short for United Kingdom. Check it and try again.',
    );
    expect(draftProblems({ ...base, country: 'GB', phone: '7700 900877' })).toEqual({});
    expect(draftProblems({ ...base, website: 'ftp://harbourboats.co.uk' }).website).toBe(
      'Enter a web address that starts with https:// or http://, or leave that part off.',
    );
    expect(draftProblems({ ...base, website: 'http://harbourboats.co.uk' })).toEqual({});
    expect(fieldsToFix({ country: 'x', phone: 'y', email: 'z' })).toBe(2);
  });

  it('stands in for the API refusing a number the country does not use', () => {
    expect(refusedPhone({ ...BLANK, country: 'GB', phone: '000 000 0000' })).toEqual({
      phone: 'That is not a phone number for United Kingdom. Check it and try again.',
    });
    expect(refusedPhone({ ...BLANK, country: 'GB', phone: '20 7946 0958' })).toEqual({});
  });

  it('saves a website typed without a scheme with https://', () => {
    expect(savedWebsite(' bloom.co ')).toBe('https://bloom.co');
    expect(savedWebsite('http://bloom.co')).toBe('http://bloom.co');
    expect(savedWebsite('bloom.co:8080')).toBe('https://bloom.co:8080');
    expect(schemeOf('mailto:a@b.co')).toBe('mailto');
    expect(savedWebsite('')).toBe('');
  });

  it('opens each of the board’s states, every one linked from the demo’s home', () => {
    const links = VENDORS_PAGES.flatMap((page) => page.states).map((one) => one.to);
    const named = links.map((to) => new URL(to, 'http://demo').searchParams.get('state'));

    expect(links.every((to) => to.startsWith('/demo/settings/vendors'))).toBe(true);
    expect(STATES.filter((state) => !named.includes(state))).toEqual([]);
    expect(named).not.toContain('read_only');
    expect(named).not.toContain('archive_refused');

    expect(vendorsStart('empty').vendors).toEqual([]);
    expect(vendorsStart('searched')).toMatchObject({
      looking: { q: 'bloom' },
      searching: true,
    });
    expect(vendorsStart('no_match').looking).toEqual({
      view: 'inUse',
      q: 'eclat',
      category: 'catering',
    });
    expect(vendorsStart('category_menu').menu).toBe('category');
    expect(vendorsStart('archived').looking.view).toBe('archived');
    expect(vendorsStart('add_blank').dialog).toMatchObject({
      kind: 'add',
      problems: { name: "Enter the vendor's name.", category: 'Choose the category.' },
    });
    expect(vendorsStart('add_invalid').dialog?.problems).toEqual({
      email: 'That does not look like an email address. Check it has an @ and a domain.',
      phone: 'That is not a phone number for United Kingdom. Check it and try again.',
      website: 'Enter a web address that starts with https:// or http://, or leave that part off.',
    });
    expect(vendorsStart('edit').dialog).toMatchObject({
      kind: 'edit',
      id: 'v3',
      draft: { name: 'Bloom & Co', country: 'GB', website: 'https://bloomandco.co.uk' },
    });
    expect(vendorsStart('archived_toast')).toMatchObject({
      told: 'Bloom & Co is archived. It is under Archived.',
    });
    expect(vendorsStart('archived_toast').vendors.find((one) => one.id === 'v3')?.archivedOn).toBe(
      '2026-11-03',
    );
    expect(vendorsViewerKey(null, 'member')).toBe('ana');
    expect(vendorsViewerKey('julien', 'populated')).toBe('julien');
  });

  it('lights Savour Kitchen on its page when a Budget’s vendor name opens the directory', () => {
    const vendors = sampleVendors();

    expect(vendorsStart('from_event', SAVOUR)).toMatchObject({ lit: 'v4', page: 1 });
    expect(vendorsStart('from_event')).toMatchObject({ lit: 'v4' });
    expect(vendorsStart('', 'v27')).toMatchObject({ lit: 'v27', page: 2 });
    expect(vendorsStart('', 'v29').lit).toBeNull();
    expect(vendorsStart('', 'nobody').lit).toBeNull();
    expect(pageOf(vendors, 'v4')).toBe(1);
  });

  it('puts Vendors after Sign-in rules, for an owner or an admin only', () => {
    expect(groupsFor(VIEWERS.folake)[1]?.sections).toEqual([
      'general',
      'members',
      'signInRules',
      'vendors',
    ]);
    expect(groupsFor(VIEWERS.ana)[1]?.sections).toEqual(['general', 'signInRules']);
  });
});
