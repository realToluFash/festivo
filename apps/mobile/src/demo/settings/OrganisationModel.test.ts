import { describe, expect, it } from 'vitest';

import {
  CANDIDATES,
  cardWords,
  countsLine,
  deleteBody,
  detailProblem,
  domainProblem,
  domainRefusal,
  domainsFoot,
  MALFORMED_CONTACT,
  ORGANISATION_STATES,
  organisationStart,
  organisationStateOf,
  ownershipSteps,
  passwordRefused,
  requestLink,
  restoreDeadline,
  SAMPLE_DETAILS,
  savedWords,
  TRANSFERRED_TO,
  transferProblems,
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

describe('the card', () => {
  it('names the organisation and its contact at rest', () => {
    expect(cardWords(SAMPLE_DETAILS, null)).toEqual({
      says: 'Ire Events',
      line: 'hello@ire.events',
      said: false,
    });
  });

  it('says what was saved, or who owns it now, until the page is left', () => {
    const saved = organisationStart('saved', 'Owner').said;

    expect(cardWords(SAMPLE_DETAILS, saved)).toEqual({
      says: 'Saved',
      line: 'Saved. Everyone in Ire Events sees the new details on their next screen.',
      said: true,
    });
    expect(cardWords(SAMPLE_DETAILS, { kind: 'transferred', to: TRANSFERRED_TO })).toEqual({
      says: 'Priya Shah is now the owner',
      line: 'You are an Admin. You both have an email saying so.',
      said: true,
    });
  });
});

describe('the details', () => {
  it('refuse a blank name and a contact with no domain, in en.json’s words', () => {
    expect(detailProblem('name', '  ')).toBe("Enter the organisation's name.");
    expect(detailProblem('contactAddress', MALFORMED_CONTACT)).toBe(
      'That does not look like an email address. Check it has an @ and a domain.',
    );
    expect(detailProblem('contactAddress', 'hello@ire.events')).toBeNull();
    expect(detailProblem('timezone', '')).toBeNull();
  });

  it('say a new language in its own words', () => {
    expect(savedWords('en', 'en')).toBe(
      'Saved. Everyone in Ire Events sees the new details on their next screen.',
    );
    expect(savedWords('fr', 'en')).toMatch(/^Saved\. Invitation emails .* go out in French /u);
  });
});

describe('adding a company domain', () => {
  it('is checked for blank and shape before it is sent', () => {
    expect(domainProblem(' ')).toBe('Enter a domain, like ire.events.');
    expect(domainProblem('ire events')).toBe(
      'Enter a domain with a dot and no spaces, like ire.events.',
    );
    expect(domainProblem('Ire.Events')).toBeNull();
  });

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

describe('company domain joining', () => {
  it('says the list is full under it once it holds 5', () => {
    expect(domainsFoot(1)).toBe(
      'People whose main email address is at a domain on this list can ask to join Ire Events when they sign up. Somebody who can manage members answers each one.',
    );
    expect(domainsFoot(5)).toMatch(/answers each one\. That is 5 domains, the most/u);
  });
});

describe('ownership and leaving', () => {
  it('offers an owner all three, and anybody else only leaving', () => {
    expect(ownershipSteps('Owner')).toEqual(['transfer', 'leave', 'delete']);
    expect(ownershipSteps('Admin')).toEqual(['leave']);
    expect(ownershipSteps('Member')).toEqual(['leave']);
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

  it('asks for a new owner and a password, and takes only the sample’s password', () => {
    expect(transferProblems(null, '')).toEqual({
      owner: 'Choose who becomes the owner.',
      password: 'Enter your password.',
    });
    expect(transferProblems('Julien Moreau', 'x')).toEqual({});
    expect(passwordRefused('correct horse battery')).toBeNull();
    expect(passwordRefused('correct horse')).toMatch(/^That is not your password\./u);
  });
});

describe('deleting the organisation', () => {
  it('counts what goes with it', () => {
    expect(countsLine('en')).toBe('4 events, 512 guests and 8 members are deleted with it.');
    expect(countsLine('en', { events: 1, guests: 1, members: 1 })).toBe(
      '1 event, 1 guest and 1 member are deleted with it.',
    );
  });

  it('writes the restore deadline in Lagos’s zone and the reader’s clock', () => {
    expect(spaced(restoreDeadline(NOV_4, 'en-US'))).toBe('Friday, Dec 4 at 10:15 AM WAT');
    expect(spaced(restoreDeadline(NOV_4, 'en-GB'))).toBe('Friday 4 Dec at 10:15 WAT');
    expect(spaced(deleteBody(NOV_4, 'en-US'))).toBe(
      '4 events, 512 guests and 8 members are deleted with it. This deletes it for everybody now. Soirely support can restore it until Friday, Dec 4 at 10:15 AM WAT; after that it is gone for good.',
    );
  });
});

describe('the request link', () => {
  it('is new each time it is made', () => {
    expect(requestLink(0)).toBe('https://soirely.app/join/r/7f3k9q');
    expect(requestLink(1)).not.toBe(requestLink(0));
  });
});
