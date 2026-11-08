import { describe, expect, it } from 'vitest';

import { matches, SEARCH_ABOVE, startsAWord } from '../OrgSwitcherModel.ts';
import { firstFew, type LedEvent, ledEvents, searches, soonestFirst } from './MembersHandover.ts';
import { handedLines, HANDOVER_WORDS as W } from './MembersHandoverWords.ts';
import {
  approved,
  handedOver,
  LEAVER,
  LONG_NAMED,
  MEMBERS_STATES,
  membersCard,
  membersSayIn,
  membersStart,
  offeredFor,
  type Person,
  SAMPLE_LEADS,
  samplePeople,
  standingOf,
  VIEWERS,
  withMorePeople,
} from './MembersSample.ts';
import { ORGANISATION_STATES, organisationStart } from './OrganisationModel.ts';

const people = samplePeople();
const id = (name: string) => {
  const found = people.find((one) => one.name === name);
  if (found == null) throw new Error(`The sample has ${name}.`);

  return found.id;
};
const PRIYA = id('Priya Shah');
const ANA = id('Ana Souza');
const MARTA = id('Marta Silva');
const JULIEN = id('Julien Moreau');
const FOLAKE = id('Folake Adeyemi');
const names = (events: readonly LedEvent[]) => events.map(({ name }) => name);
const named = (list: readonly Person[]) => list.map(({ name }) => name);

describe('the handover’s states, as the spec names them for the app (sc-31310)', () => {
  it('opens every Members and Leave state the spec lists', () => {
    expect(MEMBERS_STATES).toEqual(
      expect.arrayContaining([
        'handover',
        'handoverMenu',
        'handoverPicked',
        'handoverLong',
        'handoverSearch',
        'handoverSearchNobody',
        'removingNoWork',
        'handoverSending',
        'handoverFailed',
        'handoverDone',
        'marta',
        'handoverNow',
        'handoverNowSending',
        'handoverNowFailed',
        'handoverNowDone',
        'handoverReadOnly',
        'removing',
      ]),
    );
    expect(ORGANISATION_STATES).toEqual(
      expect.arrayContaining([
        'leave',
        'leaveMenu',
        'leavePicked',
        'leaveSending',
        'leaveFailed',
        'leaveNoWork',
      ]),
    );
  });

  it('removes Priya from her page, starting on you; removing is the same Ask', () => {
    const start = membersStart('handover');
    expect(start).toMatchObject({ open: PRIYA, step: 'removing', viewer: VIEWERS.folake });
    expect(start.handover).toEqual({ taker: null, menu: false, query: '', phase: 'asking' });
    expect(membersStart('removing')).toEqual(start);
    expect(membersStart('handoverMenu').handover?.menu).toBe(true);
    expect(membersStart('handoverPicked').handover?.taker).toBe(ANA);
    expect(membersStart('handoverSending').handover?.phase).toBe('sending');
    expect(membersStart('handoverFailed').handover?.phase).toBe('failed');
  });

  it('gives Julien eight in the long list, and the search state eleven more people', () => {
    const long = membersStart('handoverLong');
    expect(long.open).toBe(JULIEN);
    expect(long.leads[JULIEN]).toHaveLength(8);
    expect(membersStart('handoverSearch').handover).toMatchObject({ menu: true, query: 'jo' });
    expect(membersStart('handoverSearchNobody').handover).toMatchObject({ query: 'kemi' });
    expect(membersStart('handoverSearch').people).toHaveLength(people.length + 11);
  });

  it('opens Tom, who leads nothing, on today’s Ask', () => {
    const start = membersStart('removingNoWork');
    expect(start.open).toBe(VIEWERS.tom.id);
    expect(start.leads[VIEWERS.tom.id] ?? []).toEqual([]);
  });

  it('lands handoverDone on Members with Priya gone and Ana leading her three', () => {
    const start = membersStart('handoverDone');
    expect(start.open).toBeNull();
    expect(start.leads[PRIYA]).toEqual([]);
    expect(start.leads[ANA]).toEqual(expect.arrayContaining([...(SAMPLE_LEADS[PRIYA] ?? [])]));
    expect(start.gone?.handed).toEqual({ count: 3, to: 'Ana Souza', you: false });
  });

  it('opens Hand over now on Marta’s page, and Marta’s card once it is done', () => {
    expect(membersStart('handoverNow')).toMatchObject({ open: MARTA, step: 'handingOver' });
    expect(membersStart('handoverNowSending').handover?.phase).toBe('sending');
    expect(membersStart('handoverNowFailed').handover?.phase).toBe('failed');
    const done = membersStart('handoverNowDone');
    expect(done.leads[MARTA]).toEqual([]);
    expect(done.leads[FOLAKE]).toEqual(SAMPLE_LEADS[MARTA]);
    expect(done.said).toEqual([
      'Their 2 events are now led by you.',
      'Restoring Marta Silva won’t give them back.',
    ]);
  });

  it('shows Julien, an admin, Marta as an owner he can only read', () => {
    const start = membersStart('handoverReadOnly');
    const marta = start.people.find((one) => one.id === MARTA);
    if (marta == null) throw new Error('Marta is in the sample.');
    expect(start.viewer).toBe(VIEWERS.julien);
    expect(marta.role).toBe('Owner');
    expect(standingOf(marta, start.people, start.viewer)).toBe('ownerOnly');
  });

  it('opens Leave as Ana on Nobody, Julien picked, sending, failed, or leading nothing', () => {
    expect(LEAVER).toBe(ANA);
    expect(organisationStart('leave', 'Member')).toMatchObject({
      ask: 'leave',
      leaving: { taker: null, menu: false, phase: 'asking' },
      leadsAny: true,
    });
    expect(organisationStart('leaveMenu', 'Member').leaving?.menu).toBe(true);
    expect(organisationStart('leavePicked', 'Member').leaving?.taker).toBe(JULIEN);
    expect(organisationStart('leaveSending', 'Member').leaving?.phase).toBe('sending');
    expect(organisationStart('leaveFailed', 'Member').leaving?.phase).toBe('failed');
    expect(organisationStart('leaveNoWork', 'Member')).toMatchObject({
      ask: 'leave',
      leadsAny: false,
    });
    expect(organisationStart('leaveMenu', 'Owner').ask).toBe('onlyOwner');
  });
});

describe('who leads what in the sample', () => {
  it('counts Priya three, Ana two, Marta two, and nobody else any', () => {
    expect(
      Object.fromEntries(people.map((one) => [one.name, (SAMPLE_LEADS[one.id] ?? []).length])),
    ).toEqual({
      'Folake Adeyemi': 0,
      'Julien Moreau': 0,
      'Priya Shah': 3,
      'Ana Souza': 2,
      'Tom Becker': 0,
      'Kofi Mensah': 0,
      'Marta Silva': 2,
      'Lucía Gómez': 0,
      'Daniel Kim': 0,
    });
  });

  it('lists them soonest first: not yet over by their start, then the ones over, the latest first', () => {
    expect(names(ledEvents(SAMPLE_LEADS[PRIYA] ?? []))).toEqual([
      'Adaeze & Tunde’s wedding',
      'Ireti at 40',
      'Team offsite',
    ]);
    expect(names(ledEvents(SAMPLE_LEADS[ANA] ?? []))).toEqual([
      'Gala Fundación Lucía',
      'Montréal launch',
    ]);
    expect(names(ledEvents(SAMPLE_LEADS[MARTA] ?? []))).toEqual([
      'Ire Events end-of-year party',
      'Cena benéfica Fundación Lucía',
    ]);
    expect(names(ledEvents(membersStart('handoverLong').leads[JULIEN] ?? []))).toEqual([
      'Adaeze & Tunde’s wedding',
      'Ireti at 40',
      'Gala Fundación Lucía',
      'Ire Events end-of-year party',
      'Cena benéfica Fundación Lucía',
      'Bisi & Kola’s engagement',
      'Team offsite',
      'Montréal launch',
    ]);
  });

  it('puts an event that is over after every one that is not, whatever their starts', () => {
    const at = (startsAt: string, over: boolean): LedEvent => ({
      id: startsAt,
      name: startsAt,
      mesh: 'rose',
      startsAt,
      over,
    });
    expect(
      [
        at('2026-12-01', true),
        at('2027-01-01', false),
        at('2026-11-20', false),
        at('2026-12-20', true),
      ]
        .sort(soonestFirst)
        .map(({ startsAt }) => startsAt),
    ).toEqual(['2026-11-20', '2027-01-01', '2026-12-20', '2026-12-01']);
  });

  it('shows the first five in the Ask, then how many more', () => {
    const eight = ledEvents(membersStart('handoverLong').leads[JULIEN] ?? []);
    expect(firstFew(eight).shown).toHaveLength(5);
    expect(firstFew(eight).more).toBe(3);
    expect(W.more(firstFew(eight).more)).toBe('and 3 more');
    expect(firstFew(eight.slice(0, 5)).more).toBe(0);
    expect(firstFew(eight.slice(0, 6)).more).toBe(1);
  });
});

describe('the person menu', () => {
  it('offers active members only, never the one leaving and never Marta, suspended', () => {
    expect(named(offeredFor(people, PRIYA))).toEqual([
      'Folake Adeyemi',
      'Julien Moreau',
      'Ana Souza',
      'Tom Becker',
      'Kofi Mensah',
    ]);
    expect(named(offeredFor(people, ANA))).toEqual([
      'Folake Adeyemi',
      'Julien Moreau',
      'Priya Shah',
      'Tom Becker',
      'Kofi Mensah',
    ]);
  });

  it('searches above 15 people offered, the switcher’s one threshold', () => {
    expect(SEARCH_ABOVE).toBe(15);
    expect(searches(SEARCH_ABOVE)).toBe(false);
    expect(searches(SEARCH_ABOVE + 1)).toBe(true);
    expect(searches(offeredFor(people, PRIYA).length)).toBe(false);
    expect(searches(15)).toBe(false);
    expect(searches(16)).toBe(true);
    const many = membersStart('handoverSearch').people;
    expect(offeredFor(many, PRIYA)).toHaveLength(16);
    expect(searches(offeredFor(many, PRIYA).length)).toBe(true);
  });

  it('matches the start of any word in a name, case and accents aside', () => {
    const offered = offeredFor(withMorePeople(people), PRIYA);
    const found = (query: string) => named(offered.filter((one) => startsAWord(one.name, query)));
    expect(found('jo')).toEqual(['Joana Ferreira', 'Jonas Weber', 'João Pereira']);
    expect(found('JOAO')).toEqual(['João Pereira']);
    expect(found('sof')).toEqual(['Sofía Herrera']);
    expect(found('mensah')).toEqual(['Kofi Mensah']);
    expect(found('ona')).toEqual([]);
    expect(found('eira')).toEqual([]);
    expect(found('kemi')).toEqual([]);
    expect(found('  ')).toHaveLength(16);
  });

  it('differs from the organisations’ rule, which finds what a name contains', () => {
    const offered = offeredFor(withMorePeople(people), PRIYA);
    expect(named(offered.filter((one) => matches(one.name, 'eira')))).toEqual([
      'Joana Ferreira',
      'João Pereira',
    ]);
    expect(named(offered.filter((one) => matches(one.name, 'ona')))).toEqual(['Jonas Weber']);
  });
});

describe('handing events over', () => {
  it('makes the one picked Lead, keeps someone already leading as they are, and empties the departing', () => {
    const leads = { a: ['e1', 'e2'], b: ['e2', 'e3'] };
    expect(handedOver(leads, 'a', ['b'])).toEqual({ a: [], b: ['e2', 'e3', 'e1'] });
    expect(handedOver(leads, 'a', ['c'])).toEqual({ a: [], b: ['e2', 'e3'], c: ['e1', 'e2'] });
    expect(handedOver(leads, 'a', ['b', 'c']).c).toEqual(['e1', 'e2']);
  });

  it('says on Members’ card who leads them now, and that nobody emails you what you did', () => {
    const say = membersSayIn('en-US');
    const priya = people.find((one) => one.id === PRIYA);
    if (priya == null) throw new Error('Priya is in the sample.');
    const card = (to: string, you: boolean) =>
      membersCard({
        people,
        viewer: VIEWERS.folake,
        request: 'resting',
        claim: null,
        say,
        gone: { person: priya, handed: { count: 3, to, you } },
      });
    expect(card('Ana Souza', false)).toMatchObject({
      says: 'Priya Shah was removed',
      line: 'Their 3 events are now led by Ana Souza, who is emailed the list. They are listed under Former, with everything they did kept.',
      step: { label: 'Answer Lucía Gómez', does: 'answer' },
    });
    expect(
      membersCard({
        people,
        viewer: VIEWERS.tom,
        request: 'resting',
        claim: null,
        say,
        gone: { person: priya, handed: null },
      }).step,
    ).toEqual({ label: 'See Former', does: 'seeFormer' });
    expect(card('Folake Adeyemi', true).line).toBe(
      'Their 3 events are now led by you. They are listed under Former, with everything they did kept.',
    );
  });

  it('offers who waits after removing someone who leads nothing, and See Former once nobody does', () => {
    const say = membersSayIn('en-US');
    const start = membersStart('removingNoWork');
    const tom = start.people.find((one) => one.id === start.open);
    if (tom == null) throw new Error('removingNoWork opens Tom.');
    const removal = (list: readonly Person[]) =>
      membersCard({
        people: list,
        viewer: start.viewer,
        request: 'resting',
        claim: null,
        say,
        gone: { person: tom, handed: null },
      });
    expect(start.viewer).toBe(VIEWERS.folake);
    expect(removal(start.people)).toMatchObject({
      says: 'Tom Becker was removed',
      line: 'Their events stay with Ire Events. They are listed under Former, with everything they did kept.',
      step: { label: 'Answer Lucía Gómez', does: 'answer' },
    });
    const answered = approved(start.people, 'lucia.gomez@outlook.com', 'Member');
    expect(removal(answered).step).toEqual({ label: 'See Former', does: 'seeFormer' });
  });

  it('says Hand over now’s outcome on the card, to you or to someone else', () => {
    expect(handedLines('Marta Silva', 2, 'Julien Moreau')).toEqual([
      'Their 2 events are now led by Julien Moreau, who is emailed the list.',
      'Restoring Marta Silva won’t give them back.',
    ]);
  });
});

describe('the words, each count in its plural family (sc-614, Settled 7 Nov)', () => {
  it('says one event and several', () => {
    expect(W.leads('Priya Shah', 3)).toBe('Priya Shah leads 3 events. Hand them to:');
    expect(W.leads('Priya Shah', 1)).toBe('Priya Shah leads 1 event. Hand it to:');
    expect(W.youLead(2)).toBe('You lead 2 events. Hand them to:');
    expect(W.youLead(1)).toBe('You lead 1 event. Hand it to:');
    expect(W.leadsHead(2)).toBe('Leads 2 events');
    expect(W.leadsHead(1)).toBe('Leads 1 event');
    expect(W.nobody(2)).toBe('Nobody: the owners take them');
    expect(W.nobody(1)).toBe('Nobody: the owners take it');
    expect(W.more(1)).toBe('and 1 more');
    expect(W.willMove(3)).toBe('What will move, 3 events');
    expect(W.willMove(1)).toBe('What will move, 1 event');
    expect(W.handTo(3, 'Folake Adeyemi, you')).toBe('Hand them to: Folake Adeyemi, you');
    expect(W.handTo(1, 'Ana Souza')).toBe('Hand it to: Ana Souza');
    expect(W.matches(3)).toBe('3 members match');
    expect(W.matches(1)).toBe('1 member matches');
    expect(W.ledBy(1, null)).toBe('Their 1 event is now led by you.');
  });

  it('writes the Ask’s verbs and lines as the spec does', () => {
    expect(W.handTitle('Marta Silva', 2)).toBe('Hand over Marta Silva’s events?');
    expect(W.handTail('Marta Silva', 2)).toBe('Restoring Marta Silva won’t give them back.');
    expect(W.busy).toEqual({ remove: 'Removing…', leave: 'Leaving…', hand: 'Handing over…' });
    expect(W.failed.remove).toBe(
      'Removing did not work. Nothing was changed. Try again in a moment.',
    );
    expect(W.noMatch('kemi')).toBe('Nobody in Ire Events matches “kemi”.');
    expect(W.yours('Folake Adeyemi')).toBe('Folake Adeyemi · you');
  });

  it('says what the work list is doing, for someone else and for the one leaving', () => {
    expect(W.checking('Priya Shah')).toBe('Checking what Priya Shah leads…');
    expect(W.checking(null)).toBe('Checking what you lead…');
    expect(W.notLoaded('Priya Shah')).toBe(
      'What Priya Shah leads did not load. Nothing was changed.',
    );
    expect(W.notLoaded(null)).toBe('What you lead did not load. Nothing was changed.');
    expect(W.chooseRecipient).toBe('Choose who takes over their events.');
  });
});

describe('the states the work list and the refusal add (sc-614)', () => {
  const PRIYA = id('Priya Shah');
  const TOM = id('Tom Becker');
  const MARTA = id('Marta Silva');

  it('opens Remove in the words for 1', () => {
    const start = membersStart('handoverOne');

    expect(start).toMatchObject({ open: PRIYA, step: 'removing' });
    expect(start.leads[PRIYA]).toHaveLength(1);
  });

  it('carries the long name beside a called-off event', () => {
    const led = ledEvents(membersStart('handoverLongNames').leads[PRIYA] ?? []);

    expect(led.map(({ id: event }) => event)).toContain(LONG_NAMED);
    expect(names(led).at(-1)).toBe('Team offsite');
  });

  it('holds Remove and Leave on the work list', () => {
    expect(membersStart('handoverLoading').handover?.phase).toBe('checking');
    expect(membersStart('handoverLoadFailed').handover?.phase).toBe('notLoaded');
    expect(organisationStart('leaveLoading', 'Member').leaving?.phase).toBe('checking');
    expect(organisationStart('leaveLoadFailed', 'Member').leaving?.phase).toBe('notLoaded');
    expect(organisationStart('leaveOne', 'Member')).toMatchObject({
      ask: 'leave',
      leadsAny: true,
      leadsOne: true,
    });
  });

  it('refuses a removal that named nobody, once Tom has come to lead two events', () => {
    const start = membersStart('handoverRefused');

    expect(start.handover?.phase).toBe('refused');
    expect(start).toMatchObject({ open: TOM, step: 'removing' });
    expect(start.leads[TOM]).toHaveLength(2);
  });

  it('holds a suspended member’s block on the work list', () => {
    expect(membersStart('martaOne').leads[MARTA]).toHaveLength(1);
    expect(membersStart('martaLoading')).toMatchObject({ open: MARTA, leadsLoad: 'loading' });
    expect(membersStart('martaLoadFailed')).toMatchObject({ open: MARTA, leadsLoad: 'failed' });
    expect(membersStart('marta').leadsLoad).toBe('loaded');
  });
});
