import { describe, expect, it } from 'vitest';

import {
  CANDIDATES,
  GENERAL_PAGES,
  GENERAL_STATES,
  SAMPLE_DETAILS,
  cardWords,
  changesThings,
  countsLine,
  discardTitle,
  domainProblem,
  domainRefusal,
  domainsFoot,
  generalStart,
  nameMatches,
  ownershipSteps,
  restoreDeadline,
  savedWords,
  shownChoices,
  transferProblems,
  transferRefusal,
} from './general.ts';
import { SAMPLE } from './rules.ts';
import { VIEWERS } from './settings.ts';

const owner = VIEWERS.folake;
const admin = VIEWERS.julien;
const member = VIEWERS.ana;
const listed = [{ name: 'ire.events', stopped: false }];

describe('General’s sample (sc-30063)', () => {
  it('opens a state only for a viewer who can reach it, and the page at rest otherwise', () => {
    expect(generalStart('edit', owner).dialog).toBe('details');
    expect(generalStart('edit', admin).dialog).toBe('details');
    expect(generalStart('edit', member)).toMatchObject({ role: 'Member', dialog: null });
    expect(generalStart('transfer', admin).dialog).toBeNull();
    expect(generalStart('delete', admin).dialog).toBeNull();
    expect(generalStart('heldTwoFactor', owner).hold).toBeNull();
    expect(generalStart('heldLinked', admin).hold).toBe('linking');
    expect(generalStart('rules', owner)).toMatchObject({ dialog: null, ask: null, said: null });
  });

  it('asks the only owner to hand over first, and anybody else whether to leave', () => {
    expect(generalStart('leave', owner).ask).toBe('onlyOwner');
    expect(generalStart('onlyOwner', owner).ask).toBe('onlyOwner');
    expect(generalStart('onlyOwner', member)).toMatchObject({ ask: null, dialog: null });
    expect(generalStart('onlyOwner', admin)).toMatchObject({ ask: null, dialog: null });
    expect(generalStart('leave', admin).ask).toBe('leave');
  });

  it('opens each of the app’s states on what it shows', () => {
    expect(generalStart('currency', owner).picking).toBe('currency');
    expect(generalStart('language', owner).picking).toBe('locale');
    expect(generalStart('contactError', owner).contactWrong).toBe(true);
    expect(generalStart('cardsLoading', owner)).toMatchObject({
      domainsLoading: true,
      link: 'failed',
    });
    expect(generalStart('domainStopped', owner).domains).toEqual([
      { name: 'ire.events', stopped: true },
    ]);
    expect(generalStart('transferred', owner)).toMatchObject({
      role: 'Admin',
      said: { kind: 'transferred', to: 'Priya Shah' },
    });
    expect(generalStart('deleteUncounted', owner)).toMatchObject({
      counted: false,
      deleteMistyped: false,
    });
  });

  it('gives a member the read-only line and no step, and a held admin the step that ends it', () => {
    expect(cardWords(SAMPLE_DETAILS, null, 'Member', null)).toEqual({
      says: 'Ire Events',
      line: 'hello@ire.events',
      said: false,
      lock: 'Your role, Member, can see these but not change them. Owners and admins can.',
      step: null,
    });
    expect(cardWords(SAMPLE_DETAILS, null, 'Admin', null)).toMatchObject({
      lock: null,
      step: 'Edit details',
    });
    expect(cardWords(SAMPLE_DETAILS, null, 'Admin', 'twoFactor')).toMatchObject({
      lock: 'Ire Events asks owners and admins to use two-factor. Until you turn it on, you can see these but not change them.',
      step: 'Turn on two-factor',
    });
    expect(changesThings('Admin', 'linking')).toBe(false);
  });

  it('gives transfer and delete to the owner alone', () => {
    expect(ownershipSteps('Owner')).toEqual(['transfer', 'leave', 'delete']);
    expect(ownershipSteps('Admin')).toEqual(['leave']);
    expect(ownershipSteps('Member')).toEqual(['leave']);
  });

  it('offers the owner’s place to the active members, in the three roles', () => {
    expect(CANDIDATES[0]).toEqual({ name: 'Julien Moreau', role: 'Admin' });
    expect(new Set(CANDIDATES.map((one) => one.role))).toEqual(new Set(['Admin', 'Member']));
  });

  it('checks a domain’s shape first, then what the server refuses', () => {
    expect(domainProblem(' ')).toBe('Enter a domain, like ire.events.');
    expect(domainProblem('ire events')).toBe(
      'Enter a domain with a dot and no spaces, like ire.events.',
    );
    expect(domainRefusal('IRE.events', listed)).toBe('ire.events is already on the list.');
    expect(domainRefusal('gmail.com', [])).toBe('You cannot use a public email domain.');
    expect(domainRefusal('other.com', [])).toBe('Add a domain your own address is at.');
    expect(domainRefusal('ire.events', [])).toBeNull();
    expect(domainsFoot(5)).toMatch(
      /That is 5 domains, the most the list can hold\. Remove one to add another\.$/u,
    );
  });

  it('asks for an owner, the password and a code, then checks the password before the code', () => {
    expect(transferProblems(null, '', ' ')).toEqual({
      owner: 'Choose who becomes the owner.',
      password: 'Enter your password.',
      code: 'Enter a code from your app, or a recovery code.',
    });
    expect(transferRefusal('wrong', '000000')).toEqual({
      password: 'That is not your password. Nothing was changed. Try again, or reset it by email.',
    });
    expect(transferRefusal(SAMPLE.password, '000000').code).toBe(
      'That code did not work. Check your app and try again.',
    );
    expect(transferRefusal(SAMPLE.password, SAMPLE.recovery.toUpperCase())).toEqual({});
  });

  it('says what saving did, and counts the changes Cancel would drop', () => {
    expect(savedWords('en', 'en')).toBe(
      'Saved. Everyone in Ire Events sees the new details on their next screen.',
    );
    expect(savedWords('fr', 'en')).toMatch(/^Saved. Invitation emails .* go out in French/u);
    expect(discardTitle(1)).toBe('Discard your change?');
    expect(discardTitle(2)).toBe('Discard your changes?');
  });

  it('counts what deleting takes, and dates the restore in Lagos time', () => {
    expect(countsLine('en-US')).toBe('4 events, 512 guests and 8 members are deleted with it.');
    expect(restoreDeadline(new Date('2026-11-05T10:33:00Z'), 'en-US')).toBe(
      'Saturday, Dec 5 at 11:33 WAT',
    );
    expect(nameMatches('Ire Events')).toBe(true);
    expect(nameMatches('Ire events')).toBe(false);
  });

  it('finds a choice by any part of its name', () => {
    expect(shownChoices('currency', 'naira').map((one) => one.code)).toEqual(['NGN']);
    expect(shownChoices('locale', '').length).toBeGreaterThan(1);
  });

  it('links every state from the demo home', () => {
    const linked = GENERAL_PAGES.flatMap((group) => group.states).map((state) =>
      new URL(state.to, 'https://demo.test').searchParams.get('state'),
    );

    expect(new Set(linked)).toEqual(new Set([null, ...GENERAL_STATES]));
  });
});
