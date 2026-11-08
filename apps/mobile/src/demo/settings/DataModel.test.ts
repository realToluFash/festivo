import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DATA_BOARDS } from './DataBoards.ts';
import {
  controlAsks,
  dataHref,
  dataViewerOf,
  domainFieldProblem,
  domainRefusal,
  domainRows,
  domainsCard,
  domainsOwns,
  domainsStart,
  type DomainsState,
  DOMAINS_STATES,
  hubCard,
  hubFor,
  hubRows,
  hubStart,
  HUB_STATES,
  hubStateOf,
  hubStepOpens,
  soonest,
  verifyFinds,
  withAdded,
  withOnly,
  withRemoved,
  withVerified,
} from './DataModel.ts';
import {
  AT,
  dataSayIn,
  zoneFor,
  DERIVED,
  type Domain,
  IRE_EVENTS,
  NOW,
  PROVED_IRE,
  WAITING_IRE_EVENTS,
} from './DataSample.ts';

const say = dataSayIn('en-US');
const card = (state: DomainsState, owns = true) =>
  domainsCard(domainsStart(state, owns), owns, say);
const rows = (state: DomainsState, owns = true) => domainRows(domainsStart(state, owns), owns, say);

describe('the sample’s instants, each derived and written as the server writes them in Lagos', () => {
  it('writes every instant of enterprise-b-spec.md §2 on the 24-hour clock, named WAT', () => {
    expect(say.at(NOW)).toBe('Monday, Oct 19 at 10:12 WAT');
    expect(say.at(AT.ireProved)).toBe('Tuesday, Oct 6 at 11:02 WAT');
    expect(say.at(AT.ireEventsAdded)).toBe('Friday, Oct 16 at 16:45 WAT');
    expect(say.at(DERIVED.checksUntil)).toBe('Friday, Oct 23 at 16:45 WAT');
    expect(say.at(DERIVED.onlyStarts)).toBe('Monday, Nov 2 at 10:12 WAT');
    expect(say.day(DERIVED.onlySince)).toBe('Saturday, Oct 3');
    expect(say.at(DERIVED.stopped)).toBe('Monday, Oct 12 at 09:30 WAT');
    expect(say.at(DERIVED.putBackBy)).toBe('Saturday, Oct 31 at 14:20 WAT');
    expect(say.day(AT.leftEnterprise)).toBe('Sunday, Oct 18');
    expect(say.exact('2026-10-17T08:12:44Z')).toBe('Saturday, Oct 17, 2026 at 09:12:44 WAT');
  });

  it('derives the checks from the add (+7 days), the grace from the first miss (+14) and the start from now (+14)', () => {
    expect(DERIVED.checksUntil).toBe('2026-10-23T15:45:00Z');
    expect(DERIVED.putBackBy).toBe('2026-10-31T13:20:00Z');
    expect(DERIVED.onlyStarts).toBe('2026-11-02T09:12:00Z');
    expect(DERIVED.onlySince).toBe('2026-10-03T10:05:00Z');
    expect(DERIVED.stopped).toBe('2026-10-12T08:30:00Z');
  });

  it('never writes AM or PM, in a 12-hour locale too', () => {
    const us = dataSayIn('en-US');
    for (const at of [NOW, DERIVED.checksUntil, DERIVED.putBackBy, '2026-10-16T17:05:27Z'])
      expect(`${us.at(at)} ${us.exact(at)} ${us.time(at)}`).not.toMatch(/\b(AM|PM)\b/u);
    expect(us.time('2026-10-16T17:05:27Z')).toBe('18:05');
  });
});

describe('who looks, and where each page is', () => {
  it('reads as=julien as the Admin, as=ana as the Member and anything else as Folake', () => {
    expect(dataViewerOf('julien')).toBe('julien');
    expect(dataViewerOf('ana')).toBe('ana');
    expect(dataViewerOf('member')).toBe('folake');
    expect(dataViewerOf(undefined)).toBe('folake');
  });

  it('builds the spec’s routes with the state, who looks and the hub to go back to', () => {
    expect(dataHref('hub')).toBe('/demo/settings/data-and-control');
    expect(dataHref('emailDomains', { state: 'ed_record', as: 'julien' })).toBe(
      '/demo/settings/data-and-control/email-domains?state=ed_record&as=julien',
    );
    expect(dataHref('auditLog', { state: 'locked', from: 'downgraded' })).toBe(
      '/demo/settings/data-and-control/audit-log?state=locked&from=downgraded',
    );
    expect(hubFor('locked', 'downgraded')).toBe('downgraded');
    expect(hubFor('ed_locked', undefined)).toBe('locked');
    expect(hubFor('oo_off', undefined)).toBe('quiet');
    expect(hubFor('ed_record', undefined)).toBe('hub');
  });

  it('has a route file for each page, beside Settings’ own', () => {
    const dir = join('app', 'demo', 'settings', 'data-and-control');
    const files = [
      ['index.tsx', 'hub'],
      ['email-domains.tsx', 'emailDomains'],
      ['audit-log.tsx', 'auditLog'],
    ] as const;
    for (const [file, page] of files)
      expect(readFileSync(join(dir, file), 'utf8')).toContain(`data="${page}"`);
    expect(existsSync(join('app', 'demo', 'settings', '[section].tsx'))).toBe(true);
  });

  it('links every state from the demo’s home', () => {
    const hrefs = DATA_BOARDS.map(({ href }) => href);
    for (const state of HUB_STATES.filter((one) => one !== 'hub'))
      expect(hrefs).toContain(dataHref('hub', { state }));
    for (const state of DOMAINS_STATES.filter((one) => one !== 'domains'))
      expect(hrefs).toContain(dataHref('emailDomains', { state }));
    expect(hrefs).toContain('/demo/settings/organisation?state=domainBoth');
    expect(hrefs).toContain('/demo/today?create=managed');
    expect(hrefs).toContain('/demo/today?switcher=managed');
    expect(hrefs).toContain('/demo/join?state=managed');
    expect(hrefs).toContain('/demo/settings/members?state=alsoMember');
  });
});

describe('the hub in the app: Control only, its card the soonest instant that asks', () => {
  it('opens a state it names, and the hub for anything else', () => {
    expect(hubStateOf('quiet')).toBe('quiet');
    expect(hubStateOf('ex_ready')).toBe('hub');
  });

  it('says ireevents.com waits, with See the record opening it, for Folake and Julien alike', () => {
    expect(hubCard(hubStart('hub'), say)).toEqual({
      says: 'ireevents.com is waiting for its record',
      line: 'We check every hour until Friday, Oct 23 at 16:45 WAT.',
      step: { label: 'See the record', go: { kind: 'record', domain: IRE_EVENTS } },
    });
    expect(hubStepOpens('hub')).toBe('ed_record');
    expect(hubRows(hubStart('hub'), 'hub')).toEqual([
      {
        key: 'emailDomains',
        title: 'Email domains',
        line: 'ire.events proved · ireevents.com waiting for the record',
        locked: false,
        opens: 'domains',
      },
      {
        key: 'auditLog',
        title: 'Audit log',
        line: 'Who did what, for 365 days',
        locked: false,
        opens: 'list',
      },
    ]);
  });

  it('picks the soonest instant among Control’s items, a failed proof after any with an instant', () => {
    const missing: Domain = { ...PROVED_IRE, status: 'missing', deadline: DERIVED.putBackBy };
    const failed: Domain = { ...WAITING_IRE_EVENTS, name: 'ire.events.ng', status: 'failed' };
    const asks = controlAsks([missing, failed, WAITING_IRE_EVENTS], say);

    expect(soonest(asks)?.says).toBe('ireevents.com is waiting for its record');
    expect(soonest(controlAsks([missing, failed], say))?.says).toBe(
      'The record for ire.events is missing',
    );
    expect(soonest(controlAsks([failed], say))?.says).toBe('ire.events.ng was not proved');
    expect(soonest(controlAsks([PROVED_IRE], say))).toBeNull();
  });

  it('says nothing needs you once ire.events is proved alone', () => {
    expect(hubCard(hubStart('quiet'), say)).toEqual({
      says: 'Nothing needs you',
      line: 'ire.events is proved. Deleting guest data is off.',
      step: null,
    });
    expect(hubRows(hubStart('quiet'), 'quiet')[0]?.line).toBe('ire.events proved');
  });

  it('starts a new organisation on Prove a domain', () => {
    expect(hubCard(hubStart('new'), say)).toMatchObject({
      says: 'Nothing is set up yet',
      line: 'Start by proving Ire Events’ email domain.',
      step: { label: 'Prove a domain' },
    });
    expect(hubStepOpens('new')).toBe('ed_add');
    expect(hubRows(hubStart('new'), 'new')[0]?.line).toBe('No domains yet');
  });

  it('locks both rows on the free plan, each still opening its locked page', () => {
    expect(hubCard(hubStart('locked'), say)).toMatchObject({
      says: 'These come with Enterprise',
      line: 'Email domains and the audit log.',
      step: { label: 'Contact Soirely about Enterprise', go: { kind: 'contact' } },
    });
    expect(hubRows(hubStart('locked'), 'locked')).toMatchObject([
      {
        line: 'Prove your domain and keep its accounts to Ire Events',
        locked: true,
        opens: 'ed_locked',
      },
      { line: 'Who did what, for 365 days', locked: true, opens: 'locked' },
    ]);
  });

  it('keeps everything as it was once Ire Events has left Enterprise', () => {
    expect(hubCard(hubStart('downgraded'), say)).toMatchObject({
      says: 'Ire Events left Enterprise on Sunday, Oct 18',
      step: { label: 'Contact Soirely about Enterprise' },
    });
    expect(hubRows(hubStart('downgraded'), 'downgraded')).toMatchObject([
      { line: 'ire.events kept as it was', locked: true, opens: 'ed_downgraded' },
      { locked: true, opens: 'locked' },
    ]);
  });

  it('loads and fails as a page', () => {
    expect(hubStart('loading').load).toBe('loading');
    expect(hubStart('failed').load).toBe('failed');
  });
});

describe('Email domains: each state’s card and rows (sc-560, sc-563)', () => {
  it('opens on ireevents.com waiting, ire.events proved with Only our organisation off', () => {
    expect(card('domains')).toMatchObject({
      says: 'ireevents.com is waiting for its record',
      line: 'We check every hour until Friday, Oct 23 at 16:45 WAT.',
      step: { label: 'See the record' },
    });
    expect(rows('domains')).toEqual([
      {
        name: 'ire.events',
        tag: { kind: 'yes', word: 'Proved' },
        line: 'Proved Tuesday, Oct 6 at 11:02 WAT',
        action: 'remove',
        only: {
          line: 'People at ire.events can still be members of other organisations.',
          control: 'switch',
          on: false,
        },
      },
      {
        name: 'ireevents.com',
        tag: { kind: 'waiting', word: 'Waiting for the record' },
        line: 'We check every hour until Friday, Oct 23 at 16:45 WAT',
        action: 'record',
        only: null,
      },
    ]);
  });

  it('gives an admin no control, and says only an owner can change it', () => {
    expect(domainsOwns('domains', 'julien')).toBe(false);
    expect(domainsOwns('oo_not_owner', 'folake')).toBe(false);
    expect(rows('domains', false)[0]?.only).toEqual({
      line: 'People at ire.events can still be members of other organisations. Only an owner can change this.',
      control: null,
      on: false,
    });
    expect(rows('oo_not_owner', false)[0]?.only?.line).toBe(
      'Starts Monday, Nov 2 at 10:12 WAT. Only an owner can change this.',
    );
    expect(card('oo_not_owner', false)).toEqual({
      says: 'Only our organisation starts on Monday, Nov 2 at 10:12 WAT',
      line: 'Only an owner can cancel it.',
      step: null,
    });
    expect(domainsStart('oo_confirm', false).ask).toBeNull();
  });

  it('asks to prove the domain when there is none, and opens Prove a domain empty', () => {
    expect(card('ed_empty')).toEqual({
      says: 'Prove Ire Events’ email domain',
      line: 'Add a DNS record where your domain is managed. Once it is proved, you can keep the accounts at it to Ire Events.',
      step: { label: 'Prove a domain', go: { kind: 'prove' } },
    });
    expect(domainsStart('ed_add', true).prove).toEqual({ typed: '', problem: null });
  });

  it('refuses each domain the spec names, in its words', () => {
    expect(domainsStart('ed_blank', true).prove?.problem).toBe('Enter a domain, like ire.events.');
    expect(domainsStart('ed_invalid', true).prove).toEqual({
      typed: 'ire events',
      problem: 'Enter a domain with a dot and no spaces, like ire.events.',
    });
    expect(domainsStart('ed_public', true).prove?.problem).toBe(
      'You cannot use a public email domain.',
    );
    expect(domainsStart('ed_taken', true).prove).toEqual({
      typed: 'lumenfeiras.pt',
      problem:
        'Another organisation has already proved this domain. Contact Soirely support if it is yours.',
    });
  });

  it('checks the field before sending: blank, then a hostname with a dot', () => {
    expect(domainFieldProblem('')).toBe('Enter a domain, like ire.events.');
    expect(domainFieldProblem('   ')).toBe('Enter a domain, like ire.events.');
    expect(domainFieldProblem('ireevents')).toBe(
      'Enter a domain with a dot and no spaces, like ire.events.',
    );
    expect(domainFieldProblem('ire events.com')).not.toBeNull();
    expect(domainFieldProblem('Events.Ire.Events')).toBeNull();
    expect(domainRefusal('GMAIL.com', [])).toBe('You cannot use a public email domain.');
    expect(domainRefusal('ireevents.com', ['ireevents.com'])).toBe(
      'ireevents.com is already on the list.',
    );
    expect(domainRefusal('ire.events.ng', [])).toBeNull();
  });

  it('opens the record, verifying, and not found yet', () => {
    expect(domainsStart('ed_record', true)).toMatchObject({ record: IRE_EVENTS, check: 'resting' });
    expect(domainsStart('ed_checking', true)).toMatchObject({
      record: IRE_EVENTS,
      check: 'checking',
    });
    expect(domainsStart('ed_not_found', true)).toMatchObject({
      record: IRE_EVENTS,
      check: 'notFound',
    });
  });

  it('says ireevents.com is proved, with the owner’s step to keep its accounts', () => {
    expect(card('ed_proved')).toEqual({
      says: 'ireevents.com is proved',
      line: 'Proved Monday, Oct 19 at 10:12 WAT.',
      step: { label: 'Keep its accounts to Ire Events', go: { kind: 'only', domain: IRE_EVENTS } },
    });
    expect(card('ed_proved', false).step).toBeNull();
    expect(rows('ed_proved').map(({ tag, only }) => [tag.word, only?.control])).toEqual([
      ['Proved', 'switch'],
      ['Proved', 'switch'],
    ]);
  });

  it('says a proof that failed, and a record gone missing, with See the record', () => {
    expect(card('ed_failed')).toMatchObject({
      says: 'ireevents.com was not proved',
      line: 'We stopped checking on Monday, Oct 12 at 09:30 WAT. Add the record, then Verify.',
      step: { label: 'See the record', go: { domain: IRE_EVENTS } },
    });
    expect(rows('ed_failed')[1]).toMatchObject({
      tag: { kind: 'no', word: 'Not proved' },
      line: 'We stopped checking on Monday, Oct 12 at 09:30 WAT. Verify still works.',
      action: 'record',
    });
    expect(card('ed_lapsing')).toMatchObject({
      says: 'The record for ire.events is missing',
      line: 'Put it back by Saturday, Oct 31 at 14:20 WAT, or ire.events stops being proved and Only our organisation stops with it.',
      step: { label: 'See the record', go: { domain: 'ire.events' } },
    });
    expect(rows('ed_lapsing')[0]).toMatchObject({
      tag: { kind: 'waiting', word: 'Record missing' },
      line: 'Put it back by Saturday, Oct 31 at 14:20 WAT',
      action: 'record',
    });
  });

  it('asks before removing a proved domain, and says it was removed', () => {
    expect(domainsStart('ed_remove', true).ask).toEqual({ kind: 'remove', domain: 'ire.events' });
    expect(card('ed_removed')).toMatchObject({
      says: 'ire.events was removed',
      line: 'It is no longer proved.',
      step: { label: 'See the record', go: { domain: IRE_EVENTS } },
    });
    expect(rows('ed_removed').map(({ name }) => name)).toEqual([IRE_EVENTS]);
  });

  it('locks the page on the free plan, and keeps ire.events read only once Ire Events left', () => {
    expect(card('ed_locked')).toMatchObject({
      says: 'Available on Enterprise',
      line: 'Prove that Ire Events owns its domain, then keep the accounts at it to Ire Events.',
      step: { label: 'Contact Soirely about Enterprise' },
    });
    expect(card('ed_downgraded')).toMatchObject({
      says: 'Switched off on Sunday, Oct 18',
      line: 'Ire Events left Enterprise. Its domains are kept as they were, and come back on with Enterprise.',
    });
    expect(rows('ed_downgraded')).toEqual([
      {
        name: 'ire.events',
        tag: { kind: 'kept', word: 'Kept' },
        line: 'Proved Tuesday, Oct 6 at 11:02 WAT',
        action: null,
        only: {
          line: 'Kept as it was. It comes back on with Enterprise.',
          control: null,
          on: false,
        },
      },
    ]);
  });

  it('draws each of Only our organisation’s states', () => {
    expect(card('oo_off')).toMatchObject({
      says: 'ire.events is proved',
      line: 'People at ire.events can still be members of other organisations.',
      step: { label: 'Keep its accounts to Ire Events' },
    });
    expect(domainsStart('oo_confirm', true).ask).toEqual({ kind: 'only', domain: 'ire.events' });
    expect(card('oo_scheduled')).toEqual({
      says: 'Only our organisation starts on Monday, Nov 2 at 10:12 WAT',
      line: 'Everyone at ire.events was emailed. You can cancel until then.',
      step: null,
    });
    expect(rows('oo_scheduled')[0]?.only).toEqual({
      line: 'Starts Monday, Nov 2 at 10:12 WAT',
      control: 'cancel',
      on: false,
    });
    expect(card('oo_cancelled')).toMatchObject({
      says: 'Only our organisation was cancelled',
      line: 'Nothing changes for the accounts at ire.events.',
    });
    expect(card('oo_on')).toEqual({
      says: 'Accounts at ire.events belong to Ire Events',
      line: 'They can still be given access to another organisation’s event.',
      step: null,
    });
    expect(rows('oo_on')[0]?.only).toEqual({
      line: 'On since Saturday, Oct 3',
      control: 'switch',
      on: true,
    });
    expect(card('oo_turned_off')).toMatchObject({
      says: 'Only our organisation is off',
      line: 'Accounts at ire.events can be members of other organisations again.',
    });
  });
});

describe('Email domains in Play', () => {
  it('answers Verify not found the first time, then proves it and closes the record', () => {
    const waiting = WAITING_IRE_EVENTS;
    expect(verifyFinds(waiting, 0)).toBe(false);
    expect(verifyFinds(waiting, 1)).toBe(true);
    expect(verifyFinds({ ...PROVED_IRE, status: 'missing' }, 0)).toBe(true);
    const proved = withVerified(domainsStart('ed_not_found', true), IRE_EVENTS);
    expect(proved.record).toBeNull();
    expect(domainsCard(proved, true, say)).toEqual(card('ed_proved'));
  });

  it('adds a good domain as waiting for a week and opens its record', () => {
    const added = withAdded(domainsStart('ed_add', true), ' IRE.events.NG ');
    expect(added.prove).toBeNull();
    expect(added.record).toBe('ire.events.ng');
    expect(domainsCard(added, true, say)).toMatchObject({
      says: 'ire.events.ng is waiting for its record',
      line: 'We check every hour until Monday, Oct 26 at 10:12 WAT.',
    });
  });

  it('removes a proved domain after the Ask, and a waiting one at once', () => {
    const asked = withRemoved(domainsStart('ed_remove', true), 'ire.events', true);
    expect(domainsCard(asked, true, say)).toEqual(card('ed_removed'));
    const waiting = withRemoved(domainsStart('domains', true), IRE_EVENTS, false);
    expect(waiting.said).toBeNull();
    expect(domainsCard(waiting, true, say)).toEqual(card('oo_off'));
  });

  it('schedules Only our organisation, cancels it, and turns it off at once', () => {
    const scheduled = withOnly(domainsStart('oo_confirm', true), 'ire.events', 'scheduled');
    expect(scheduled.ask).toBeNull();
    expect(domainsCard(scheduled, true, say)).toEqual(card('oo_scheduled'));
    expect(domainsCard(withOnly(scheduled, 'ire.events', 'off'), true, say)).toEqual(
      card('oo_cancelled'),
    );
    expect(
      domainsCard(withOnly(domainsStart('oo_on', true), 'ire.events', 'off'), true, say),
    ).toEqual(card('oo_turned_off'));
  });
});

describe('each reader in their own zone (sc-868)', () => {
  it('shows the lapse instant in a Lagos and a London admin’s zones as the same instant', () => {
    const lapse = '2026-10-31T13:20:00Z';

    expect(dataSayIn('en-US', zoneFor('folake')).at(lapse)).toBe('Saturday, Oct 31 at 14:20 WAT');
    expect(dataSayIn('en-US', zoneFor('julien')).at(lapse)).toBe('Saturday, Oct 31 at 13:20 GMT');
    expect(dataSayIn('en-US', zoneFor('julien')).at('2026-10-23T15:45:00Z')).toBe(
      'Friday, Oct 23 at 16:45 BST',
    );
  });
});
