import { describe, expect, it } from 'vitest';

import {
  RUN_AT,
  asksOf,
  dataControlPath,
  dataControlViewerKey,
  hubCard,
  hubRows,
  hubStart,
  soonestAsk,
  when,
  zoneFor,
} from './dataControl.ts';
import { DATA_CONTROL_PAGES } from './dataControlPages.ts';
import { VIEWERS, groupsFor, settingsPath } from './settings.ts';

const LOCALE = 'en-US';
const LAGOS = 'Africa/Lagos';
const view = (state: string) => hubStart(state).view;

describe('Data and control, the hub (sc-560, enterprise-b-spec §4)', () => {
  it('is the organisation’s last row, after Vendors, for an owner or an admin only', () => {
    expect(groupsFor(VIEWERS.folake)[1]?.sections.at(-1)).toBe('data');
    expect(groupsFor(VIEWERS.julien)[1]?.sections).toContain('data');
    expect(groupsFor(VIEWERS.ana)[1]?.sections).not.toContain('data');
    expect(settingsPath('data', VIEWERS.folake)).toBe('/demo/settings/data-and-control');
  });

  it('names each page’s address, the person and the state', () => {
    expect(dataControlPath('emailDomains', VIEWERS.julien, 'ed_record')).toBe(
      '/demo/settings/data-and-control/email-domains?as=julien&state=ed_record',
    );
    expect(dataControlPath('deleteGuestData', VIEWERS.folake)).toBe(
      '/demo/settings/data-and-control/delete-guest-data',
    );
  });

  it('reads each instant in the reader’s own zone, the same instant in Lagos and London', () => {
    expect(when(RUN_AT, LOCALE, LAGOS)).toBe('Saturday, Oct 24 at 14:20 WAT');
    expect(when(RUN_AT, LOCALE, zoneFor(VIEWERS.julien))).toBe('Saturday, Oct 24 at 14:20 BST');
    expect(hubCard(view('hub'), VIEWERS.julien, LOCALE).line).toBe(
      'We check every hour until Friday, Oct 23 at 16:45 BST.',
    );
    expect(hubRows(view('hub'), VIEWERS.julien, LOCALE).data[1]?.line).toBe(
      'After 90 days · next run Saturday, Oct 24 at 14:20 BST, 2 events',
    );
  });

  it('puts the soonest instant asking the person something on the card', () => {
    expect(hubCard(view('hub'), VIEWERS.folake, LOCALE)).toEqual({
      says: 'Your export is ready',
      line: 'It downloads once, until Tuesday, Oct 20 at 09:52 WAT, and only for you, signed in.',
      step: 'download',
    });
    expect(hubCard(view('hub'), VIEWERS.julien, LOCALE)).toEqual({
      says: 'ireevents.com is waiting for its record',
      line: 'We check every hour until Friday, Oct 23 at 16:45 BST.',
      step: 'seeRecord',
    });
    expect(hubCard({ ...view('hub'), exported: 'used' }, VIEWERS.folake, LOCALE).step).toBe(
      'seeRecord',
    );
  });

  it('goes on to the run once nothing sooner asks, and to nothing after it', () => {
    const asks = asksOf(view('hub'));
    const run = asks.filter((ask) => ask.at === RUN_AT);

    expect(soonestAsk(run, VIEWERS.julien)?.card(LOCALE, LAGOS)).toEqual({
      says: 'Next run · Saturday, Oct 24 at 14:20 WAT',
      line: '2 events are in the next run.',
      step: 'checkRun',
    });
    expect(soonestAsk(asks, VIEWERS.ana)).toBeNull();
    expect(hubCard(view('quiet'), VIEWERS.folake, LOCALE)).toEqual({
      says: 'Nothing needs your attention',
      line: 'ire.events is proved. Deleting guest data is off.',
      step: null,
    });
  });

  it('starts a new organisation on its domain, and asks a free one to contact Soirely', () => {
    expect(hubCard(view('new'), VIEWERS.folake, LOCALE)).toMatchObject({
      says: 'Nothing is set up yet',
      line: 'Start by proving the email domain of Ire Events.',
      step: 'prove',
    });
    expect(hubCard(view('locked'), VIEWERS.folake, LOCALE)).toMatchObject({
      says: 'These come with Enterprise',
      step: 'contact',
    });
    expect(hubCard(view('downgraded'), VIEWERS.julien, LOCALE)).toMatchObject({
      says: 'Ire Events left Enterprise on Sunday, Oct 18',
      step: 'contact',
    });
  });

  it('says where each job stands, and opens its page in the same state', () => {
    const rows = hubRows(view('hub'), VIEWERS.folake, LOCALE);

    expect(rows.control.map((row) => [row.title, row.line])).toEqual([
      ['Email domains', 'ire.events proved · ireevents.com waiting for the record'],
      ['Audit log', 'Who did what, for 365 days'],
    ]);
    expect(rows.data.map((row) => [row.title, row.line, row.tag, row.state])).toEqual([
      ['Export all data', 'Ready until Tuesday, Oct 20 at 09:52 WAT', 'ready', 'ex_ready'],
      [
        'Delete guest data after an event',
        'After 90 days · next run Saturday, Oct 24 at 14:20 WAT, 2 events',
        null,
        'rt_held',
      ],
      ['A guest’s request', 'Export or erase everything held on one guest', null, undefined],
    ]);
    expect(hubRows(view('hub'), VIEWERS.julien, LOCALE).data[0]).toMatchObject({
      line: 'Ready · asked by Folake Adeyemi',
      state: 'ex_ready_other',
    });
    expect(
      hubRows({ ...view('hub'), exported: 'used' }, VIEWERS.folake, LOCALE).data[0],
    ).toMatchObject({ line: 'Downloaded', tag: null, state: 'ex_used' });
  });

  it('locks the three Enterprise jobs on the free plan, and keeps them as they were after it', () => {
    const locked = hubRows(view('locked'), VIEWERS.folake, LOCALE);
    const left = hubRows(view('downgraded'), VIEWERS.folake, LOCALE);
    const tags = (rows: typeof locked) =>
      [...rows.control, ...rows.data].map((row) => [row.page, row.tag]);

    expect(tags(locked)).toEqual([
      ['emailDomains', 'locked'],
      ['auditLog', 'locked'],
      ['export', null],
      ['deleteGuestData', 'locked'],
      ['guestRequest', null],
    ]);
    expect(locked.control[0]?.line).toBe('Prove your domain and limit its accounts to Ire Events');
    expect(left.control[0]).toMatchObject({
      line: 'ire.events kept as it was',
      state: 'ed_downgraded',
    });
    expect(left.data[1]?.line).toBe('90 days and 1 held event, kept as they were');
  });

  it('draws the states that imply an admin as Julien', () => {
    expect(dataControlViewerKey('emailDomains', null, 'oo_not_owner')).toBe('julien');
    expect(dataControlViewerKey('export', null, 'ex_ready_other')).toBe('julien');
    expect(dataControlViewerKey('deleteGuestData', null, 'not_owner')).toBe('julien');
    expect(dataControlViewerKey('hub', 'ana', 'hub')).toBe('ana');
  });

  it('lists a group per page on the demo’s home, each link once in its group', () => {
    for (const group of DATA_CONTROL_PAGES) {
      const links = group.states.map((state) => state.to);

      expect(new Set(links).size).toBe(links.length);
    }
    expect(DATA_CONTROL_PAGES.map((group) => group.name)).toContain('Email domains');
  });
});
