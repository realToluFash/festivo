import type { CompanionChoice, GuestPage } from '@soirely/api-client';

/** One named companion on Who's coming with you? (sc-3779); `id` is null for one the guest added and has not sent yet. */
export interface PartyPerson {
  key: string;
  id: string | null;
  name: string;
  byGuest: boolean;
  coming: boolean;
}

/** The host decides how many places, the guest decides who fills them; nothing is saved until Send my answer. */
export interface Party {
  places: number;
  people: readonly PartyPerson[];
  adding: string | null;
  tried: boolean;
  renaming: string | null;
  draft: string;
}

export function partyOf(page: GuestPage): Party {
  return {
    places: page.guest.places,
    people: page.guest.companions.map((one) => ({
      key: one.id,
      id: one.id,
      name: one.fullName,
      byGuest: one.namedByGuest,
      coming: one.coming,
    })),
    adding: null,
    tried: false,
    renaming: null,
    draft: '',
  };
}

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
      {
        key: `new-${String(party.people.length + 1)}`,
        id: null,
        name,
        byGuest: true,
        coming: true,
      },
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
      one.key === party.renaming && one.name !== name ? { ...one, name, byGuest: true } : one,
    ),
    renaming: null,
    draft: '',
    tried: false,
  };
}

/** What Send my answer sends with Coming: every named companion, and each added one for an unnamed place. */
export function choices(party: Party): CompanionChoice[] {
  return party.people.map((one) => ({ id: one.id, fullName: one.name, coming: one.coming }));
}

export function comingNames(party: Party): string[] {
  return party.people.filter((one) => one.coming).map((one) => one.name);
}
