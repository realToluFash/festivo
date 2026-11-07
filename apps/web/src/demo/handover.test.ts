import { describe, expect, it } from 'vitest';

import { GENERAL_PAGES, generalStart } from './general.ts';
import {
  askWords,
  counted,
  handedOver,
  ledBy,
  ledByLine,
  matching,
  noMatchLine,
  offeredFor,
  whoWords,
} from './handover.ts';
import {
  ANA,
  MARTA,
  MEMBERS_STATES,
  membersCard,
  membersStart,
  morePeople,
  PRIYA,
  personView,
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
    expect(counted('leads', 1, { name: 'Priya Shah' })).toBe(
      'Priya Shah leads 1 event. Hand it to:',
    );
    expect(counted('leads', 3, { name: 'Priya Shah' })).toBe(
      'Priya Shah leads 3 events. Hand them to:',
    );
    expect(counted('youLead', 2)).toBe('You lead 2 events. Hand them to:');
    expect(counted('leadsHead', 1)).toBe('Leads 1 event');
    expect(counted('more', 3)).toBe('and 3 more');
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
    expect(noMatchLine('kemi ')).toBe('Nobody in Ire Events matches “kemi”.');
  });

  it('asks each way in its own words, with Hand over in Violet as nothing is removed', () => {
    expect(askWords('remove', 'Priya Shah', 3)).toMatchObject({
      title: 'Remove Priya Shah from Ire Events?',
      last: 'They lose access on their next request.',
      keep: 'Keep Priya',
      go: 'Remove',
      red: true,
      busy: 'Removing…',
    });
    expect(askWords('leave', 'Ana Souza', 2)).toMatchObject({
      title: 'Leave Ire Events?',
      lead: 'You lead 2 events. Hand them to:',
      last: 'You lose access to Ire Events as soon as you leave.',
      keep: 'Stay',
      go: 'Leave Ire Events',
      busy: 'Leaving…',
    });
    expect(askWords('hand', 'Marta Silva', 2)).toMatchObject({
      title: 'Hand over Marta Silva’s events?',
      last: 'Restoring Marta Silva won’t give them back.',
      keep: 'Cancel',
      go: 'Hand over',
      red: false,
      failed: 'Handing over did not work. Nothing was changed. Try again in a moment.',
    });
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
    const start = membersStart('handoverDone', folake);

    expect(membersCard({ ...start, viewer: folake, say })).toMatchObject({
      says: 'Priya Shah was removed',
      lines: [
        'Their 3 events are now led by Ana Souza, who is emailed the list. They are listed under Former, with everything they did kept.',
      ],
      step: { label: 'Answer Lucía Gómez' },
    });
    expect(membersCard({ ...membersStart('removed', folake), viewer: folake, say }).lines).toEqual([
      'Their events stay with Ire Events. They are listed under Former, with everything they did kept.',
    ]);
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
        'If nobody answers by Wednesday, Nov 11 at 10:00 AM WAT, they are removed.',
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

  it('links every handover state from the demo home', () => {
    const linked = [...SETTINGS_PAGES, ...GENERAL_PAGES]
      .flatMap((page) => page.states)
      .map((state) => new URL(state.to, 'http://demo').searchParams.get('state'));
    const handover = MEMBERS_STATES.filter((state) => /^handover|NoWork$/u.test(state));

    for (const state of [...handover, 'marta', 'suspended', 'leave', 'leaveMenu', 'leaveNoWork'])
      expect(linked).toContain(state);
  });
});
