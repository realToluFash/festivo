import { calledOff } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { GENERAL_PAGES, generalStart, leaveAsk } from './general.ts';
import {
  HANDOVER_WORDS as H,
  handedOver,
  ledBy,
  ledByLine,
  matching,
  offeredFor,
  whoWords,
} from './handover.ts';
import {
  ANA,
  handoverAsk,
  MARTA,
  MEMBERS_STATES,
  membersCard,
  membersStart,
  morePeople,
  PRIYA,
  personView,
  removeWords,
  sampleLeads,
  samplePeople,
  TOM,
} from './members.ts';
import { SETTINGS_PAGES, settingsSayIn, VIEWERS } from './settings.ts';

const say = settingsSayIn('en-US');
const folake = VIEWERS.folake;
const names = (events: readonly { name: string }[]) => events.map((event) => event.name);

function viewOf(state: string, viewer = folake) {
  const start = membersStart(state, viewer);
  const person = start.people.find((one) => one.id === start.open);
  if (person == null) throw new Error(`${state} opens nobody`);

  return personView({ ...start, person, viewer, say });
}

describe('handing over a departing member’s work (sc-31311)', () => {
  it('lists what someone leads soonest first: not yet over by start, then over, latest first', () => {
    const julien = membersStart('handoverLong', folake).leads[VIEWERS.julien.id] ?? [];

    expect(names(ledBy({ x: julien }, 'x'))).toEqual([
      'Adaeze & Tunde’s wedding',
      'Ireti at 40',
      'Gala Fundación Lucía',
      'Ire Events end-of-year party',
      'Cena benéfica Fundación Lucía',
      'Bisi & Kola’s engagement',
      'Team offsite',
      'Montréal launch',
    ]);
    expect(names(ledBy(sampleLeads(), PRIYA))).toEqual([
      'Adaeze & Tunde’s wedding',
      'Ireti at 40',
      'Team offsite',
    ]);
    expect(ledBy(sampleLeads(), TOM)).toEqual([]);
  });

  it('says every count in its plural family, singular included', () => {
    expect(H.leads('Priya Shah', 1)).toBe('Priya Shah leads 1 event. Hand it to:');
    expect(H.leads('Priya Shah', 3)).toBe('Priya Shah leads 3 events. Hand them to:');
    expect(H.youLead(2)).toBe('You lead 2 events. Hand them to:');
    expect(H.leadsHead(1)).toBe('Leads 1 event');
    expect(H.more(3)).toBe('and 3 more');
    expect(H.handTo(1, 'Ana Souza')).toBe('Hand it to: Ana Souza');
    expect(whoWords(null, folake.id, 1)).toBe('Nobody: the owners take it');
    expect(whoWords(null, folake.id, 2)).toBe('Nobody: the owners take them');
  });

  it('offers active members only, never the one leaving and never anyone suspended', () => {
    expect(offeredFor(samplePeople(), PRIYA).map((one) => one.name)).toEqual([
      'Folake Adeyemi',
      'Julien Moreau',
      'Ana Souza',
      'Tom Becker',
      'Kofi Mensah',
    ]);
    expect(offeredFor([...samplePeople(), ...morePeople()], PRIYA)).toHaveLength(16);
  });

  it('finds a person by the start of any word in their name, case and accents ignored', () => {
    const people = [...samplePeople(), ...morePeople()].map((one) => one.name);

    expect(people.filter((name) => matching(name, 'jo'))).toEqual([
      'Joana Ferreira',
      'Jonas Weber',
      'João Pereira',
    ]);
    expect(people.filter((name) => matching(name, 'JOAO P'))).toEqual(['João Pereira']);
    expect(people.filter((name) => matching(name, 'kemi'))).toEqual([]);
  });

  it('asks each way in its own words, with Hand over in Violet as nothing is removed', () => {
    expect(handoverAsk('remove', 'Priya Shah', 3)).toMatchObject({
      title: 'Remove Priya Shah from Ire Events?',
      last: 'They lose access on their next request.',
      keep: 'Keep Priya',
      go: 'Remove',
      red: true,
      busy: 'Removing…',
    });
    expect(leaveAsk(2)).toMatchObject({
      title: 'Leave Ire Events?',
      lead: 'You lead 2 events. Hand them to:',
      last: 'You lose access to Ire Events as soon as you leave.',
      keep: 'Stay',
      go: 'Leave Ire Events',
      busy: 'Leaving…',
    });
    expect(handoverAsk('hand', 'Marta Silva', 2)).toMatchObject({
      title: 'Hand over Marta Silva’s events?',
      last: 'Restoring Marta Silva won’t give them back.',
      keep: 'Cancel',
      go: 'Hand over',
      red: false,
      failed: 'Handing over did not work. Nothing was changed. Try again in a moment.',
    });
    expect(handoverAsk('remove', 'Tom Becker', 1)).toMatchObject(removeWords('Tom Becker'));
  });

  it('emails whoever takes them, but not you when you take them yourself', () => {
    expect(ledByLine({ to: ANA, count: 3 }, 'Ana Souza', folake.id)).toBe(
      'Their 3 events are now led by Ana Souza, who is emailed the list.',
    );
    expect(ledByLine({ to: folake.id, count: 1 }, 'Folake Adeyemi', folake.id)).toBe(
      'Their 1 event is now led by you.',
    );
  });

  it('moves every event to the one person picked', () => {
    const moved = handedOver(sampleLeads(), PRIYA, ANA);

    expect(moved[PRIYA]).toEqual([]);
    expect(moved[ANA]).toHaveLength(5);
  });

  it('opens each Remove state on Priya’s page, starting on you', () => {
    expect(membersStart('handover', folake)).toMatchObject({
      open: PRIYA,
      dialog: { kind: 'remove', id: PRIYA, hand: { to: folake.id, menu: false } },
    });
    expect(membersStart('handoverPicked', folake).dialog).toMatchObject({ hand: { to: ANA } });
    expect(membersStart('handoverSearch', folake)).toMatchObject({
      dialog: { hand: { menu: true, query: 'jo' } },
    });
    expect(membersStart('handoverSearch', folake).people).toHaveLength(20);
    expect(membersStart('removingNoWork', folake)).toMatchObject({ open: TOM });
    expect(membersStart('handoverSending', folake).dialog).toMatchObject({
      hand: { phase: 'held' },
    });
    expect(membersStart('handoverLong', VIEWERS.julien).dialog).toBeNull();
  });

  it('says on the card where the events went, and offers the next request', () => {
    const card = (state: string) =>
      membersCard({ ...membersStart(state, folake), viewer: folake, say });

    expect(card('removed')).toEqual(card('handoverDone'));
    expect(card('handoverDone')).toMatchObject({
      says: 'Priya Shah was removed',
      lines: [
        'Their 3 events are now led by Ana Souza, who is emailed the list. They are listed under Former, with everything they did kept.',
      ],
      step: { label: 'Answer Lucía Gómez' },
    });
  });

  it('offers Hand over now on a suspended member’s page, and only reads it to an admin on an owner', () => {
    expect(viewOf('marta')).toMatchObject({ handOver: true, step: { label: 'Restore' } });
    expect(viewOf('suspended')).toMatchObject({
      handOver: true,
      step: { label: 'Restore access' },
    });
    expect(viewOf('handoverReadOnly', VIEWERS.julien)).toMatchObject({
      handOver: false,
      step: null,
      remove: null,
      lines: [
        'Marta Silva’s ire.events address is no longer on their account.',
        'If nobody answers by Wednesday, Nov 11 at 10:00 WAT, they are removed.',
        'Only an owner can change an owner’s role or remove them.',
      ],
    });
    expect(viewOf('priya').handOver).toBe(false);
  });

  it('says on the card who leads them now, once handed over', () => {
    expect(viewOf('handoverNowDone').lines).toEqual([
      'Their 2 events are now led by you.',
      'Restoring Marta Silva won’t give them back.',
    ]);
    expect(membersStart('handoverNowDone', folake).leads[MARTA]).toEqual([]);
  });

  it('starts Leave on Nobody, and leaves today’s ask for someone who leads nothing', () => {
    const ana = VIEWERS.ana;

    expect(generalStart('leave', ana)).toMatchObject({
      ask: 'leave',
      hand: { to: null, menu: false },
      leads: sampleLeads()[ANA],
    });
    expect(generalStart('leavePicked', ana).hand.to).toBe(VIEWERS.julien.id);
    expect(generalStart('leaveFailed', ana).hand.phase).toBe('failed');
    expect(generalStart('leaveNoWork', ana).leads).toEqual([]);
    expect(generalStart('leave', VIEWERS.julien).leads).toEqual([]);
    expect(generalStart('leaveMenu', folake).ask).toBe('onlyOwner');
  });

  it('opens the states the work list and the refusal add (sc-614)', () => {
    const remove = (state: string) => membersStart(state, folake).dialog;

    expect(remove('handoverLoading')).toMatchObject({ kind: 'remove', id: PRIYA });
    expect(names(ledBy(membersStart('handoverOne', folake).leads, PRIYA))).toEqual(['Ireti at 40']);
    expect(ledBy(membersStart('handoverLongNames', folake).leads, PRIYA)).toHaveLength(3);
    expect(
      names(ledBy(membersStart('handoverLongNames', folake).leads, PRIYA).filter(calledOff)),
    ).toEqual(['Team offsite']);
    expect(remove('handoverRefused')).toMatchObject({ kind: 'remove', id: TOM });
    expect(ledBy(membersStart('handoverRefused', folake).leads, TOM)).toHaveLength(2);
    expect(ledBy(membersStart('martaOne', folake).leads, MARTA)).toHaveLength(1);
    expect(membersStart('martaLoading', folake).leadsLoad).toBe('loading');
    expect(membersStart('martaLoadFailed', folake).leadsLoad).toBe('failed');
    expect(membersStart('marta', folake).leadsLoad).toBe('loaded');
    expect(generalStart('leaveOne', VIEWERS.ana).leads).toHaveLength(1);
    expect(generalStart('leaveLoading', VIEWERS.ana).hand.phase).toBe('checking');
    expect(generalStart('leaveLoadFailed', VIEWERS.ana).hand.phase).toBe('notLoaded');
  });

  it('says what the work list is doing, for someone else and for the one leaving', () => {
    expect(H.checking('Priya Shah')).toBe('Checking what Priya Shah leads…');
    expect(H.checking(null)).toBe('Checking what you lead…');
    expect(H.notLoaded('Priya Shah')).toBe(
      'What Priya Shah leads did not load. Nothing was changed.',
    );
    expect(H.notLoaded(null)).toBe('What you lead did not load. Nothing was changed.');
    expect(H.chooseRecipient).toBe('Choose who takes over their events.');
  });

  it('links every handover state from the demo home', () => {
    const linked = [...SETTINGS_PAGES, ...GENERAL_PAGES]
      .flatMap((page) => page.states)
      .map((state) => new URL(state.to, 'http://demo').searchParams.get('state'));
    const handover = MEMBERS_STATES.filter((state) => /^handover|NoWork$/u.test(state));

    const also = ['marta', 'martaOne', 'martaLoading', 'martaLoadFailed', 'suspended'];
    const leave = [
      'leave',
      'leaveMenu',
      'leaveNoWork',
      'leaveOne',
      'leaveLoading',
      'leaveLoadFailed',
    ];

    for (const state of [...handover, ...also, ...leave]) expect(linked).toContain(state);
  });
});
