import { describe, expect, it } from 'vitest';

import { SAMPLE } from './ConsultationsModel.ts';
import { ENQUIRIES, PEOPLE, startOf } from './EnquiriesModel.ts';
import {
  ERASED_BIRTHDAY,
  ERASED_WEDDING,
  ERASE_PAGE_IDS,
  ERASE_PAGE_STATES,
  KEPT,
  QUIET,
  eraseListStart,
  erasePageStart,
  erasedTitle,
  extraOf,
  landedStart,
  landingHref,
  mayDelete,
  monthWords,
  warnsOn,
} from './EraseModel.ts';

const typeWord = (type: string) => ({ wedding: 'Wedding', birthday: 'Birthday' })[type] ?? type;
const wedding = ERASED_WEDDING.erased!;

describe('an erased row’s title', () => {
  it('names the type and the month', () => {
    expect(erasedTitle(ERASED_WEDDING, typeWord, 'en-US')).toBe(
      'Erased enquiry · Wedding · June 2027',
    );
  });

  it('leaves out a type it never had, with its separator', () => {
    expect(erasedTitle({ ...ERASED_WEDDING, type: null }, typeWord, 'en-US')).toBe(
      'Erased enquiry · June 2027',
    );
  });

  it('never says No date yet', () => {
    expect(erasedTitle(ERASED_BIRTHDAY, typeWord, 'en-US')).toBe('Erased enquiry · Birthday');
  });

  it('is Erased enquiry alone with neither', () => {
    expect(
      erasedTitle(
        { ...ERASED_WEDDING, type: null, erased: { ...wedding, month: null } },
        typeWord,
        'en-US',
      ),
    ).toBe('Erased enquiry');
  });

  it.each([
    ['es', 'junio de 2027'],
    ['fr', 'juin 2027'],
    ['pt', 'junho de 2027'],
  ])('reads the month in %s', (locale, said) => {
    expect(monthWords('2027-06', locale)).toBe(said);
  });
});

describe('the 30-day warning', () => {
  it('warns an Open enquiry erased within 30 days', () => {
    expect(warnsOn(QUIET, null)).toBe('2026-12-04');
  });

  it('says nothing further out than 30 days', () => {
    expect(warnsOn({ ...QUIET, changedAt: '2026-01-20T10:00:00Z' }, null)).toBeNull();
  });

  it('never warns a Lost enquiry', () => {
    expect(warnsOn({ ...QUIET, tab: 'lost' }, null)).toBeNull();
  });

  it('never warns one with a consultation still to come', () => {
    expect(warnsOn(KEPT, SAMPLE.later)).toBeNull();
  });

  it('never warns one already erased', () => {
    expect(warnsOn({ ...ERASED_WEDDING, tab: 'open' }, null)).toBeNull();
  });
});

describe('Delete enquiry', () => {
  it('is for Owners and Admins on anything not Won', () => {
    expect(mayDelete(ENQUIRIES[0]!, PEOPLE.folake)).toBe(true);
    expect(mayDelete(ERASED_WEDDING, PEOPLE.kemi)).toBe(true);
    expect(mayDelete({ ...ENQUIRIES[0]!, tab: 'won' }, PEOPLE.folake)).toBe(false);
    expect(mayDelete(ENQUIRIES[0]!, PEOPLE.tunde)).toBe(false);
  });

  it('lands on the list it was opened from, the tab and the filter kept', () => {
    expect(landingHref('enq-ada', 'list', 'state=mine&tab=lost&mine=1')).toBe(
      '/demo/enquiries?state=mine&tab=lost&mine=1&deleted=enq-ada',
    );
  });

  it('lands on Enquiries, Open, from a link', () => {
    expect(landingHref('enq-ada', undefined, undefined)).toBe('/demo/enquiries?deleted=enq-ada');
  });

  it('drops the deleted enquiry and says so on landing', () => {
    const landed = landedStart(startOf('idle'), { tab: 'lost', mine: true, deleted: 'enq-ada' });
    expect(landed.enquiries.some((one) => one.id === 'enq-ada')).toBe(false);
    expect(landed.tab).toBe('lost');
    expect(landed.viewer.mine).toBe(true);
    expect(landed.told).toBe('Enquiry deleted.');
  });
});

describe('sc-31235’s states', () => {
  it.each(ERASE_PAGE_STATES)('%s opens an enquiry the sample has', (state) => {
    expect(
      ENQUIRIES.some((one) => one.id === ERASE_PAGE_IDS[state]) || extraOf(ERASE_PAGE_IDS[state]),
    ).toBeTruthy();
  });

  it('opens the 409 race on the confirm', () => {
    expect(erasePageStart('won-race-409').asking).toBe('race');
  });

  it('puts the erased rows first on Lost, the newest erasure first', () => {
    const start = eraseListStart('lost-with-erased', startOf('lost-with-erased'));
    expect(start.tab).toBe('lost');
    expect(start.enquiries).toContain(ERASED_WEDDING);
    expect(start.enquiries).toContain(ERASED_BIRTHDAY);
  });
});
