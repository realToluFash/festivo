import { describe, expect, it } from 'vitest';

import {
  CANDIDATES,
  domainRefusal,
  ORGANISATION_STATES,
  organisationStart,
  organisationStateOf,
  requestLink,
  restoreDeadline,
  TRANSFERRED_TO,
} from './OrganisationModel.ts';

const spaced = (words: string) => words.replace(/\s/gu, ' ');
const NOV_4 = new Date('2026-11-04T09:15:00Z');

describe('a state link', () => {
  it('opens a state it names, and the page at rest for anything else', () => {
    expect(organisationStateOf('delete')).toBe('delete');
    expect(organisationStateOf('planner')).toBeNull();
    expect(organisationStateOf(undefined)).toBeNull();
    expect(ORGANISATION_STATES).toEqual(
      expect.arrayContaining(['edit', 'addDomain', 'replaceLink', 'linkOff', 'transferred']),
    );
  });

  it('opens each screen, list and Ask the owner’s states name', () => {
    expect(organisationStart('edit', 'Owner')).toMatchObject({ screen: 'details', picking: null });
    expect(organisationStart('contactError', 'Owner')).toMatchObject({
      screen: 'details',
      contactWrong: true,
    });
    expect(organisationStart('currency', 'Owner').picking).toBe('currency');
    expect(organisationStart('currencyBlank', 'Owner')).toMatchObject({
      screen: 'details',
      currencyBlank: true,
      contactWrong: false,
    });
    expect(organisationStart('currencyBlank', 'Member').screen).toBeNull();
    expect(organisationStart('language', 'Owner').picking).toBe('locale');
    expect(organisationStart('addDomain', 'Owner').screen).toBe('addDomain');
    expect(organisationStart('removeDomain', 'Owner').ask).toBe('removeDomain');
    expect(organisationStart('replaceLink', 'Owner').ask).toBe('replaceLink');
    expect(organisationStart('linkOff', 'Owner').link).toBe('turnedOff');
    expect(organisationStart('cardsLoading', 'Owner')).toMatchObject({
      domainsLoading: true,
      link: 'failed',
    });
    expect(organisationStart('transfer', 'Owner')).toMatchObject({
      screen: 'transfer',
      transferPicked: true,
    });
    expect(organisationStart('delete', 'Owner')).toMatchObject({
      screen: 'delete',
      deleteMistyped: true,
    });
  });

  it('opens transferred with the viewer an Admin and the card saying who owns it', () => {
    const start = organisationStart('transferred', 'Owner');

    expect(start.role).toBe('Admin');
    expect(start.said).toEqual({ kind: 'transferred', to: 'Priya Shah' });
    expect(TRANSFERRED_TO).toBe('Priya Shah');
  });

  it('asks the only owner to hand over first, and lets a member leave', () => {
    expect(organisationStart('leave', 'Owner').ask).toBe('onlyOwner');
    expect(organisationStart('onlyOwner', 'Owner').ask).toBe('onlyOwner');
    expect(organisationStart('leave', 'Member').ask).toBe('leave');
  });

  it('opens an owner’s state on the page at rest for a member', () => {
    const rest = organisationStart(null, 'Member');

    expect(organisationStart('edit', 'Member')).toEqual(rest);
    expect(organisationStart('delete', 'Member')).toEqual(rest);
    expect(rest).toMatchObject({ role: 'Member', screen: null, ask: null, link: 'on' });
  });
});

describe('a company domain sent to the sample', () => {
  it('is refused as the API refuses it', () => {
    expect(domainRefusal('ire.events', ['ire.events'])).toBe('ire.events is already on the list.');
    expect(domainRefusal('gmail.com', [])).toBe('You cannot use a public email domain.');
    expect(domainRefusal('example.com', [])).toBe('Add a domain your own address is at.');
    expect(domainRefusal('a.com', ['b.com', 'c.com', 'd.com', 'e.com', 'f.com'])).toBe(
      'That is 5 domains, the most the list can hold. Remove one to add another.',
    );
    expect(domainRefusal(' IRE.events ', [])).toBeNull();
  });
});

describe('transferring ownership', () => {
  it('offers the active members other than the owner, each with one of the three roles', () => {
    expect(CANDIDATES.map((member) => [member.name, member.role])).toEqual([
      ['Julien Moreau', 'Admin'],
      ['Priya Shah', 'Member'],
      ['Ana Souza', 'Member'],
      ['Tom Becker', 'Member'],
      ['Kofi Mensah', 'Member'],
    ]);
  });
});

describe('deleting the organisation', () => {
  it('writes the restore deadline in Lagos’s zone, the day in the locale’s order and the time on the 24-hour clock', () => {
    expect(spaced(restoreDeadline(NOV_4, 'en-US'))).toBe('Friday, Dec 4 at 10:15 WAT');
    expect(spaced(restoreDeadline(NOV_4, 'en-GB'))).toBe('Friday 4 Dec at 10:15 WAT');
  });

  it('writes the time as the API’s H:i, with no AM or PM, whatever the hour or the locale', () => {
    const evening = new Date('2026-11-04T20:05:00Z');

    expect(spaced(restoreDeadline(evening, 'en-US'))).toBe('Friday, Dec 4 at 21:05 WAT');
    expect(spaced(restoreDeadline(evening, 'en'))).toBe('Friday, Dec 4 at 21:05 WAT');
    expect(restoreDeadline(NOV_4, 'en-US')).not.toMatch(/AM|PM/u);
  });
});

describe('the request link', () => {
  it('is new each time it is made', () => {
    expect(requestLink(0)).toBe('https://soirely.app/join/r/7f3k9q');
    expect(requestLink(1)).not.toBe(requestLink(0));
  });
});
