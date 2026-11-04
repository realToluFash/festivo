import { describe, expect, it } from 'vitest';

import {
  CANDIDATES,
  countsLine,
  deleteBody,
  detailProblem,
  domainProblem,
  domainRefusal,
  MALFORMED_CONTACT,
  organisationStateOf,
  passwordRefused,
  requestLink,
  restoreDeadline,
  savedWords,
  transferProblems,
} from './OrganisationModel.ts';

const spaced = (words: string) => words.replace(/\s/gu, ' ');
const NOV_4 = new Date('2026-11-04T09:15:00Z');

describe('a state link', () => {
  it('opens a state it names, and the page at rest for anything else', () => {
    expect(organisationStateOf('delete')).toBe('delete');
    expect(organisationStateOf('planner')).toBeNull();
    expect(organisationStateOf(undefined)).toBeNull();
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

describe('transferring ownership', () => {
  it('offers the active members other than the owner', () => {
    expect(CANDIDATES.map((member) => member.name)).toEqual([
      'Julien Moreau',
      'Priya Shah',
      'Ana Souza',
      'Tom Becker',
      'Kofi Mensah',
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
