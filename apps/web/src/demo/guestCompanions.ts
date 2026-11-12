import type { Answer, Visit } from './guest.ts';
import type { DemoLink } from './settings.ts';

export interface Companion {
  key: string;
  name: string;
  by: 'invitation' | 'you';
  coming: boolean;
}

/** sc-3779: the host decides how many places, the guest decides who fills them. */
export interface Party {
  places: number;
  people: readonly Companion[];
  adding: string | null;
  tried: boolean;
  renaming: string | null;
  draft: string;
}

export const NO_PLACES: Party = {
  places: 0,
  people: [],
  adding: null,
  tried: false,
  renaming: null,
  draft: '',
};

const CHIDI: Companion = {
  key: 'chidi',
  name: 'Chidi Okonkwo-Williams',
  by: 'invitation',
  coming: true,
};
const NNEKA: Companion = { key: 'you-1', name: 'Nneka Okonkwo-Williams', by: 'you', coming: true };

export const SAMPLE_PARTY: Party = { ...NO_PLACES, places: 2, people: [CHIDI] };

export function hasStep(party: Party): boolean {
  return party.places > 0;
}

export function placesLeft(party: Party): number {
  return Math.max(0, party.places - party.people.length);
}

export function toggled(party: Party, key: string): Party {
  return {
    ...party,
    people: party.people.map((one) => (one.key === key ? { ...one, coming: !one.coming } : one)),
  };
}

export function opened(party: Party): Party {
  return placesLeft(party) > 0 ? { ...party, adding: '', tried: false, renaming: null } : party;
}

/** A blank name is not added, and the button says why. */
export function added(party: Party): Party {
  const name = party.adding?.trim() ?? '';

  if (name === '') return { ...party, tried: true };
  if (placesLeft(party) === 0) return { ...party, adding: null, tried: false };

  return {
    ...party,
    people: [
      ...party.people,
      { key: `you-${String(party.people.length + 1)}`, name, by: 'you', coming: true },
    ],
    adding: null,
    tried: false,
  };
}

export function renaming(party: Party, key: string): Party {
  const one = party.people.find((each) => each.key === key);

  return one == null
    ? party
    : { ...party, renaming: key, draft: one.name, adding: null, tried: false };
}

export function renamed(party: Party): Party {
  const name = party.draft.trim();

  if (party.renaming == null) return party;
  if (name === '') return { ...party, tried: true };

  return {
    ...party,
    people: party.people.map((one) =>
      one.key === party.renaming ? { ...one, name, by: 'you' } : one,
    ),
    renaming: null,
    draft: '',
    tried: false,
  };
}

export function comingWith(party: Party): readonly Companion[] {
  return party.people.filter((one) => one.coming);
}

/** Derived, never stored: Held while the guest is not Coming, then what the guest last chose (sc-3779, 19 Oct). */
export function companionIs(
  guest: Answer | null,
  chosen: boolean,
): 'coming' | 'notComing' | 'held' {
  if (guest !== 'coming') return 'held';

  return chosen ? 'coming' : 'notComing';
}

export const PARTY_WORDS = {
  title: 'Who’s coming with you?',
  places: (hosts: string, places: number) =>
    `${hosts} have saved places for you and up to ${String(places)} ${places === 1 ? 'other' : 'others'}.`,
  you: 'That’s you',
  coming: 'Coming',
  notComing: 'Not coming',
  invitation: 'Named on your invitation',
  byYou: 'Named by you',
  add: (left: number) => `Add someone · ${String(left)} ${left === 1 ? 'place' : 'places'} left`,
  theirName: 'Their name',
  typeTheirName: 'Type their name',
  rename: (name: string) => `Change ${name}’s name`,
  done: 'Done',
  next: 'Next',
  row: 'Coming',
  people: (names: readonly string[]) =>
    names.length === 0
      ? 'You · 1 person'
      : `${new Intl.ListFormat('en', { type: 'conjunction' }).format(['You', ...names])} · ${String(names.length + 1)} people`,
  change: 'Change who is coming',
} as const;

const ANSWERED = { recorded: { answer: 'coming', on: '2026-10-27' } } as const;
const STEP = { view: { kind: 'withYou', from: 'answer' } } as const;

export const GUEST_PARTY_STATES = {
  withYou: {
    name: 'Coming, then Who’s coming with you?: one named, one place left',
    starts: { ...STEP, party: SAMPLE_PARTY, want: 'withYouHead' },
  },
  withYouToggle: {
    name: 'A companion marked Not coming',
    starts: { ...STEP, party: toggled(SAMPLE_PARTY, 'chidi') },
  },
  withYouAdd: {
    name: 'Add someone, a name typed',
    starts: {
      ...STEP,
      party: { ...SAMPLE_PARTY, adding: 'Nneka Okonkwo-Williams' },
      want: 'newName',
    },
  },
  withYouBlank: {
    name: 'Add someone with no name: Type their name',
    starts: { ...STEP, party: { ...SAMPLE_PARTY, adding: '', tried: true }, want: 'newName' },
  },
  withYouRename: {
    name: 'Renaming a companion the host named',
    starts: {
      ...STEP,
      party: { ...SAMPLE_PARTY, renaming: 'chidi', draft: 'Chidi Okonkwo' },
      want: 'renameField',
    },
  },
  withYouFull: {
    name: 'Every place named: no Add someone',
    starts: { ...STEP, party: { ...SAMPLE_PARTY, people: [CHIDI, NNEKA] } },
  },
  withYouNoPlaces: {
    name: 'No places: Coming goes straight on, with no step',
    starts: { party: NO_PLACES },
  },
  checkWithCompanions: {
    name: 'Check and send, listing who is coming',
    starts: {
      view: { kind: 'check', busy: false, failed: false, refused: false, from: 'answer' },
      party: { ...SAMPLE_PARTY, people: [CHIDI, NNEKA] },
      companionsComing: 2,
      want: 'checkHead',
    },
  },
  heldNotSure: {
    name: 'Not sure yet: every companion held',
    starts: {
      recorded: { answer: 'notSure', on: '2026-10-27' },
      view: { kind: 'recorded', same: false },
      party: { ...SAMPLE_PARTY, people: [CHIDI, { ...NNEKA, coming: false }] },
    },
  },
  heldThenBack: {
    name: 'Back to Coming from Not sure yet: each as last chosen',
    starts: {
      recorded: { answer: 'notSure', on: '2026-10-27' },
      view: { kind: 'withYou', from: 'changing' },
      party: { ...SAMPLE_PARTY, people: [CHIDI, { ...NNEKA, coming: false }] },
      want: 'withYouHead',
    },
  },
  comingWithCompanions: {
    name: 'Answered Coming with companions',
    starts: {
      ...ANSWERED,
      view: { kind: 'recorded', same: false },
      party: { ...SAMPLE_PARTY, people: [CHIDI, NNEKA] },
    },
  },
} satisfies Record<string, { name: string; starts: Partial<Visit> }>;

export type GuestPartyState = keyof typeof GUEST_PARTY_STATES;

export function isGuestPartyState(value: string | null): value is GuestPartyState {
  return value != null && Object.hasOwn(GUEST_PARTY_STATES, value);
}

export function guestPartyStarts(state: GuestPartyState): Partial<Visit> {
  return GUEST_PARTY_STATES[state].starts as Partial<Visit>;
}

export const GUEST_PARTY_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Who’s coming with you (sc-3779)',
    states: (Object.keys(GUEST_PARTY_STATES) as GuestPartyState[]).map((state) => ({
      to: `/demo/guest?state=${state}`,
      name: GUEST_PARTY_STATES[state].name,
    })),
  },
];

export function partyLine(party: Party): string {
  return PARTY_WORDS.people(comingWith(party).map((one) => one.name));
}
