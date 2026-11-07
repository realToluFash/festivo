import { describe, expect, it } from 'vitest';

import {
  BLANK,
  NOT_LOOKING,
  PAGE_SIZE,
  VENDORS_PAGES,
  archived,
  draftProblems,
  inNameOrder,
  nameMatches,
  noMatchLine,
  paged,
  reachOf,
  restored,
  sampleVendors,
  savedWebsite,
  schemeOf,
  shown,
  vendorsStart,
} from './vendors.ts';

describe('the vendor directory’s rules (sc-82)', () => {
  it('lists in name order, A to Z ignoring case, 25 a page', () => {
    const names = inNameOrder([
      { ...sampleVendors()[0]!, name: 'zest' },
      { ...sampleVendors()[0]!, name: 'Bloom' },
      { ...sampleVendors()[0]!, name: 'adire' },
    ]).map((one) => one.name);
    const inUse = shown(sampleVendors(), NOT_LOOKING);

    expect(names).toEqual(['adire', 'Bloom', 'zest']);
    expect(PAGE_SIZE).toBe(25);
    expect(inUse).toHaveLength(30);
    expect(paged(inUse, 1)).toMatchObject({ from: 1, to: 25, pages: 2, total: 30 });
    expect(paged(inUse, 2)).toMatchObject({ from: 26, to: 30, page: 2 });
    expect(paged(inUse, 9).page).toBe(2);
  });

  it('matches a name containing the typed text, ignoring case but not accents', () => {
    expect(nameMatches('Bloom & Co', '  BLOOM ')).toBe(true);
    expect(nameMatches('Petals by Tolu', 'by t')).toBe(true);
    expect(nameMatches('Éclat Catering', 'éclat')).toBe(true);
    expect(nameMatches('Éclat Catering', 'eclat')).toBe(false);
  });

  it('keeps archived vendors out of In use, and lists them under Archived', () => {
    const vendors = sampleVendors();
    const later = archived(vendors, 'v4', '2026-11-07');

    expect(shown(vendors, { ...NOT_LOOKING, view: 'archived' })).toHaveLength(3);
    expect(shown(later, NOT_LOOKING).map((one) => one.id)).not.toContain('v4');
    expect(later.find((one) => one.id === 'v4')?.archivedOn).toBe('2026-11-07');
    expect(shown(restored(later, 'v4'), NOT_LOOKING).map((one) => one.id)).toContain('v4');
  });

  it('shows the email address, or else the phone, or neither', () => {
    expect(reachOf({ email: 'a@b.ng', phone: '803 555 0142', country: 'NG' })).toBe('a@b.ng');
    expect(reachOf({ email: '', phone: '803 555 0142', country: 'NG' })).toBe('+234 803 555 0142');
    expect(reachOf({ email: '', phone: '', country: '' })).toBeNull();
  });

  it('says which search or category matched nothing', () => {
    expect(noMatchLine({ ...NOT_LOOKING, q: 'eclat' })).toBe(
      'No vendors have “eclat” in their name.',
    );
    expect(noMatchLine({ view: 'archived', q: 'x', category: 'flowers' })).toBe(
      'No archived vendors in flowers have “x” in their name.',
    );
    expect(noMatchLine({ ...NOT_LOOKING, category: 'music' })).toBe('No vendors in music.');
  });

  it('requires a name and a category, a name of spaces being blank', () => {
    expect(draftProblems({ ...BLANK, name: '   ' })).toEqual({
      name: 'Enter the vendor’s name.',
      category: 'Choose the category.',
    });
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

    expect(draftProblems({ ...base, email: 'bookings@harbour' }).email).toBe(
      'That does not look like an email address. Check it has an @ and a domain.',
    );
    expect(draftProblems({ ...base, phone: '803 555 0142' }).country).toBe('Choose a country.');
    expect(draftProblems({ ...base, country: 'NG', phone: '80' }).phone).toBe(
      'That number looks too short for Nigeria. Check it and try again.',
    );
    expect(draftProblems({ ...base, country: 'NG', phone: '803 555 0142' })).toEqual({});
    expect(draftProblems({ ...base, website: 'ftp://harbour.ng' }).website).toBe(
      'Enter a web address that starts with https:// or http://, or leave that part off.',
    );
    expect(draftProblems({ ...base, website: 'http://harbour.ng' })).toEqual({});
  });

  it('saves a website typed without a scheme with https://', () => {
    expect(savedWebsite(' bloom.co ')).toBe('https://bloom.co');
    expect(savedWebsite('http://bloom.co')).toBe('http://bloom.co');
    expect(savedWebsite('bloom.co:8080')).toBe('https://bloom.co:8080');
    expect(schemeOf('mailto:a@b.ng')).toBe('mailto');
    expect(savedWebsite('')).toBe('');
  });

  it('opens each state the demo’s home links to', () => {
    const states = VENDORS_PAGES.flatMap((page) => page.states);

    expect(vendorsStart('empty').vendors).toEqual([]);
    expect(vendorsStart('blank').dialog).toMatchObject({ kind: 'add' });
    expect(vendorsStart('invalid').dialog).toMatchObject({
      problems: {
        phone: 'That is not a phone number for Nigeria. Check it and try again.',
      },
    });
    expect(states.every((one) => one.to.startsWith('/demo/vendors'))).toBe(true);
  });
});
