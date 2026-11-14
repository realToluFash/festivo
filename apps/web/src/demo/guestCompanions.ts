import type { Answer, Lang, Visit } from './guest.ts';
import { demoWords } from './demoWords.ts';
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

const ENGLISH = {
  title: 'Who’s coming with you?',
  places_one: '{{hosts}} have saved places for you and up to {{count}} other.',
  places_other: '{{hosts}} have saved places for you and up to {{count}} others.',
  you: 'That’s you',
  coming: 'Coming',
  notComing: 'Not coming',
  invitation: 'Named on your invitation',
  byYou: 'Named by you',
  add_one: 'Add someone · {{count}} place left',
  add_other: 'Add someone · {{count}} places left',
  theirName: 'Their name',
  typeTheirName: 'Type their name',
  rename: 'Change {{name}}’s name',
  isComing: '{{name}} is coming',
  done: 'Done',
  next: 'Next',
  row: 'Coming',
  youWord: 'You',
  people_one: '{{names}} · {{count}} person',
  people_other: '{{names}} · {{count}} people',
  change: 'Change who is coming',
};

type Key = keyof typeof ENGLISH;

/** The board's English, and bracketed samples for l10n to settle: a fit test, not the translation. */
const SAMPLES: Record<Exclude<Lang, 'en'>, Record<Key, string>> = {
  fr: {
    title: '[Qui vient avec vous ?]',
    places_one:
      '[{{hosts}} vous ont réservé des places, pour vous et jusqu’à {{count}} autre personne.]',
    places_other:
      '[{{hosts}} vous ont réservé des places, pour vous et jusqu’à {{count}} autres personnes.]',
    you: '[C’est vous]',
    coming: '[Présent]',
    notComing: '[Absent]',
    invitation: '[Nommé sur votre invitation]',
    byYou: '[Nommé par vous]',
    add_one: '[Ajouter quelqu’un · {{count}} place restante]',
    add_other: '[Ajouter quelqu’un · {{count}} places restantes]',
    theirName: '[Son nom]',
    typeTheirName: '[Saisissez son nom]',
    rename: '[Modifier le nom de {{name}}]',
    isComing: '[{{name}} vient]',
    done: '[OK]',
    next: '[Suivant]',
    row: '[Présents]',
    youWord: '[Vous]',
    people_one: '[{{names}} · {{count}} personne]',
    people_other: '[{{names}} · {{count}} personnes]',
    change: '[Modifier qui vient]',
  },
  es: {
    title: '[¿Quién viene con usted?]',
    places_one: '[{{hosts}} le han reservado plazas, para usted y hasta {{count}} persona más.]',
    places_other: '[{{hosts}} le han reservado plazas, para usted y hasta {{count}} personas más.]',
    you: '[Es usted]',
    coming: '[Asistirá]',
    notComing: '[No asistirá]',
    invitation: '[Nombrado en su invitación]',
    byYou: '[Nombrado por usted]',
    add_one: '[Añadir a alguien · queda {{count}} plaza]',
    add_other: '[Añadir a alguien · quedan {{count}} plazas]',
    theirName: '[Su nombre]',
    typeTheirName: '[Escriba su nombre]',
    rename: '[Cambiar el nombre de {{name}}]',
    isComing: '[{{name}} asistirá]',
    done: '[Listo]',
    next: '[Siguiente]',
    row: '[Asistirán]',
    youWord: '[Usted]',
    people_one: '[{{names}} · {{count}} persona]',
    people_other: '[{{names}} · {{count}} personas]',
    change: '[Cambiar quién asiste]',
  },
  pt: {
    title: '[Quem vem consigo?]',
    places_one: '[{{hosts}} reservaram lugares para si e até mais {{count}} pessoa.]',
    places_other: '[{{hosts}} reservaram lugares para si e até mais {{count}} pessoas.]',
    you: '[É você]',
    coming: '[Vou]',
    notComing: '[Não vou]',
    invitation: '[Indicado no seu convite]',
    byYou: '[Indicado por si]',
    add_one: '[Adicionar alguém · resta {{count}} lugar]',
    add_other: '[Adicionar alguém · restam {{count}} lugares]',
    theirName: '[O nome]',
    typeTheirName: '[Escreva o nome]',
    rename: '[Alterar o nome de {{name}}]',
    isComing: '[{{name}} vem]',
    done: '[Concluído]',
    next: '[Seguinte]',
    row: '[Vêm]',
    youWord: '[Você]',
    people_one: '[{{names}} · {{count}} pessoa]',
    people_other: '[{{names}} · {{count}} pessoas]',
    change: '[Alterar quem vem]',
  },
};

const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT' };

export function partyWords(lang: Lang) {
  const table = lang === 'en' ? ENGLISH : SAMPLES[lang];
  const { filled, many, listed } = demoWords(table, { locale: LOCALES[lang] });

  return {
    title: table.title,
    places: (hosts: string, count: number) => many('places', count, { hosts }),
    you: table.you,
    coming: table.coming,
    notComing: table.notComing,
    invitation: table.invitation,
    byYou: table.byYou,
    add: (left: number) => many('add', left),
    theirName: table.theirName,
    typeTheirName: table.typeTheirName,
    rename: (name: string) => filled(table.rename, { name }),
    isComing: (name: string) => filled(table.isComing, { name }),
    done: table.done,
    next: table.next,
    row: table.row,
    people: (names: readonly string[]) =>
      many('people', names.length + 1, { names: listed([table.youWord, ...names]) }),
    change: table.change,
  };
}

export type PartyWords = ReturnType<typeof partyWords>;

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
    starts: { party: NO_PLACES, companionsComing: 0 },
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
  heldNotComing: {
    name: 'Not coming: companions not coming either',
    starts: {
      recorded: { answer: 'notComing', on: '2026-10-27' },
      view: { kind: 'recorded', same: false },
      party: { ...SAMPLE_PARTY, people: [CHIDI, NNEKA] },
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

export function partyLine(party: Party, lang: Lang): string {
  return partyWords(lang).people(comingWith(party).map((one) => one.name));
}

/** The held line under Not sure yet or Not coming: only when a companion is held by the guest's own answer. */
export function holdsCompanions(visit: Visit): boolean {
  const answer = visit.recorded?.answer ?? null;

  return hasStep(visit.party)
    ? visit.party.people.some((one) => companionIs(answer, one.coming) === 'held')
    : visit.companionsComing > 0;
}
