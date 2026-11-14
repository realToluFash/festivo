import { describe, expect, it } from 'vitest';

import { DATA_CONTROL_PAGES } from './dataControlPages.ts';
import {
  DOMAIN_STATES,
  type Domain,
  confirmWords,
  domainFault,
  domainLine,
  domainRefusal,
  domainsCard,
  domainsStart,
  onlyLine,
  removed,
  verified,
} from './emailDomains.ts';
import { VIEWERS } from './settings.ts';

const LOCALE = 'en-US';
const LAGOS = 'Africa/Lagos';
const view = (state: string) => domainsStart(state).view;
const card = (state: string, viewer = VIEWERS.folake) => domainsCard(view(state), viewer, LOCALE);
const named = (state: string, name: string): Domain => {
  const found = view(state).domains.find((one) => one.name === name);
  if (found == null) throw new Error(`${name} is not in ${state}`);

  return found;
};

describe('Email domains (sc-560, sc-563)', () => {
  it('checks a domain before it is sent: blank, then a hostname with a dot', () => {
    expect(domainFault('  ')).toBe('Enter a domain, like ire.events.');
    expect(domainFault('ire events')).toBe(
      'Enter a domain with a dot and no spaces, like ire.events.',
    );
    expect(domainFault('ireevents')).toBe(
      'Enter a domain with a dot and no spaces, like ire.events.',
    );
    expect(domainFault(' IreEvents.com ')).toBeNull();
  });

  it('answers as the server does: public, proved by another organisation, or listed already', () => {
    expect(domainRefusal('Gmail.com', [])).toBe('You cannot use a public email domain.');
    expect(domainRefusal('lumenfeiras.pt', [])).toBe(
      'Another organisation has already proved this domain. Contact Soirely support if it is yours.',
    );
    expect(domainRefusal('ire.events', view('domains').domains)).toBe(
      'ire.events is already on the list.',
    );
    expect(domainRefusal('acme.org', [])).toBeNull();
  });

  it('says where each domain stands, from its own instant', () => {
    expect(domainLine(named('domains', 'ire.events'), LOCALE, LAGOS)).toBe(
      'Proved Tuesday, Oct 6 at 11:02 WAT',
    );
    expect(domainLine(named('domains', 'ireevents.com'), LOCALE, LAGOS)).toBe(
      'We check every hour until Friday, Oct 23 at 16:45 WAT',
    );
    expect(domainLine(named('ed_failed', 'ireevents.com'), LOCALE, LAGOS)).toBe(
      'We stopped checking on Monday, Oct 12 at 09:30 WAT. Verify still works.',
    );
    expect(domainLine(named('ed_lapsing', 'ire.events'), LOCALE, LAGOS)).toBe(
      'Put it back by Saturday, Oct 31 at 14:20 WAT',
    );
  });

  it('shows the lapse instant in a Lagos and a London admin’s own zones as the same instant', () => {
    expect(card('ed_lapsing').line).toContain('Put it back by Saturday, Oct 31 at 14:20 WAT,');
    expect(card('ed_lapsing', VIEWERS.julien).line).toContain(
      'Put it back by Saturday, Oct 31 at 13:20 GMT,',
    );
    expect(domainLine(named('ed_lapsing', 'ire.events'), LOCALE, 'Europe/London')).toBe(
      'Put it back by Saturday, Oct 31 at 13:20 GMT',
    );
  });

  it('says Only our organisation’s standing, and tells an admin only an owner changes it', () => {
    const plan = 'enterprise';

    expect(onlyLine(named('oo_off', 'ire.events'), VIEWERS.folake, plan, LOCALE)).toBe(
      'People at ire.events can still be members of other organisations.',
    );
    expect(onlyLine(named('oo_scheduled', 'ire.events'), VIEWERS.folake, plan, LOCALE)).toBe(
      'Starts Monday, Nov 2 at 10:12 WAT',
    );
    expect(onlyLine(named('oo_on', 'ire.events'), VIEWERS.folake, plan, LOCALE)).toBe(
      'On since Saturday, Oct 3',
    );
    expect(onlyLine(named('oo_scheduled', 'ire.events'), VIEWERS.julien, plan, LOCALE)).toBe(
      'Starts Monday, Nov 2 at 09:12 GMT. Only an owner can change this.',
    );
    expect(onlyLine(named('oo_off', 'ire.events'), VIEWERS.julien, plan, LOCALE)).toBe(
      'People at ire.events can still be members of other organisations. Only an owner can change this.',
    );
    expect(onlyLine(named('ed_downgraded', 'ire.events'), VIEWERS.folake, 'left', LOCALE)).toBe(
      'Kept as it was. It comes back on with Enterprise.',
    );
  });

  it('puts the domain most at risk on the card, with its one step', () => {
    expect(card('domains')).toEqual({
      says: 'ireevents.com is waiting for its record',
      line: 'We check every hour until Friday, Oct 23 at 16:45 WAT.',
      step: { does: 'record', domain: 'ireevents.com' },
    });
    expect(card('ed_empty')).toEqual({
      says: 'Prove the email domain of Ire Events',
      line: 'Add a DNS record where your domain is managed. Once it is proved, you can limit the accounts at it to Ire Events.',
      step: { does: 'prove' },
    });
    expect(card('ed_failed')).toMatchObject({
      says: 'ireevents.com was not proved',
      line: 'We stopped checking on Monday, Oct 12 at 09:30 WAT. Add the record, then Verify.',
    });
    expect(card('ed_lapsing')).toEqual({
      says: 'The record for ire.events is missing',
      line: 'Put it back by Saturday, Oct 31 at 14:20 WAT, or ire.events stops being proved and Only our organisation stops with it.',
      step: { does: 'record', domain: 'ire.events' },
    });
  });

  it('says what was just done: proved, removed', () => {
    expect(card('ed_proved')).toEqual({
      says: 'ireevents.com is proved',
      line: 'Proved Monday, Oct 19 at 10:12 WAT.',
      step: { does: 'keep', domain: 'ireevents.com' },
    });
    expect(card('ed_proved', VIEWERS.julien).step).toBeNull();
    expect(view('ed_proved').domains.map((one) => [one.status, one.only])).toEqual([
      ['proved', 'off'],
      ['proved', 'off'],
    ]);
    expect(card('ed_removed')).toEqual({
      says: 'ire.events was removed',
      line: 'It is no longer proved.',
      step: { does: 'record', domain: 'ireevents.com' },
    });
    expect(view('ed_removed').domains.map((one) => one.name)).toEqual(['ireevents.com']);
  });

  it('keeps accounts to Ire Events from 14 days on, cancelled or turned off at once', () => {
    expect(confirmWords('ire.events', LOCALE, LAGOS)).toEqual({
      title: 'Limit ire.events accounts to Ire Events?',
      lines: [
        'From Monday, Nov 2 at 10:12 WAT, 14 days from now, an account whose main email address is at ire.events can only be a member of Ire Events.',
        'Everyone at ire.events is emailed now. Access to a single event still works. You can cancel until then.',
      ],
    });
    expect(card('oo_off')).toMatchObject({
      says: 'ire.events is proved',
      step: { does: 'keep', domain: 'ire.events' },
    });
    expect(card('oo_scheduled')).toEqual({
      says: 'Only our organisation starts on Monday, Nov 2 at 10:12 WAT',
      line: 'Everyone at ire.events was emailed. You can cancel until then.',
      step: null,
    });
    expect(card('oo_not_owner', VIEWERS.julien).line).toBe('Only an owner can cancel it.');
    expect(card('oo_cancelled')).toMatchObject({
      says: 'Only our organisation was cancelled',
      line: 'Nothing changes for the accounts at ire.events.',
    });
    expect(card('oo_on')).toMatchObject({
      says: 'Accounts at ire.events belong to Ire Events',
      line: 'They can still be given access to another organisation’s event.',
    });
    expect(card('oo_turned_off')).toMatchObject({
      says: 'Only our organisation is off',
      line: 'Accounts at ire.events can be members of other organisations again.',
    });
  });

  it('locks the page on the free plan, and keeps it read only after Enterprise', () => {
    expect(card('ed_locked')).toMatchObject({
      says: 'Available on Enterprise',
      step: { does: 'contact' },
    });
    expect(card('ed_downgraded')).toEqual({
      says: 'Switched off on Sunday, Oct 18',
      line: 'Ire Events left Enterprise. Its domains are kept as they were, and come back on with Enterprise.',
      step: { does: 'contact' },
    });
  });

  it('proves a missing record again as it was, and a waiting one now', () => {
    const again = verified(view('ed_lapsing'), 'ire.events');

    expect(again.domains[0]).toMatchObject({ status: 'proved', at: '2026-10-06T11:02:00+01:00' });
    expect(removed(view('domains'), 'ireevents.com', false).said).toBeNull();
  });

  it('links every state from the demo’s home', () => {
    const linked = DATA_CONTROL_PAGES.flatMap((one) => one.states.map((state) => state.to)).filter(
      (to) => to.includes('/email-domains'),
    );

    for (const state of DOMAIN_STATES)
      expect(linked.some((to) => to.endsWith(`state=${state}`))).toBe(true);
  });
});
