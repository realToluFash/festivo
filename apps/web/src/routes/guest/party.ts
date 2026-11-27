import type { CompanionChoice, GuestPage, PageNeeds, PlaceChoice } from '@soirely/api-client';

/** One place on Who's coming with you? (sc-3779): a named companion, or a place nobody has named yet, `name` null (sc-48740). */
export interface PartyPerson {
  id: string;
  name: string | null;
  byGuest: boolean;
  coming: boolean;
}

/** The host decides how many places, the guest decides who fills them; every place is a row, and nothing is saved until Send my answer. */
export interface Party {
  places: number;
  people: readonly PartyPerson[];
  tried: boolean;
  renaming: string | null;
  draft: string;
}

/** Named companions first, then each place nobody has named, as the API lists them. */
export function partyOf(page: GuestPage): Party {
  return {
    places: page.guest.places,
    people: [
      ...page.guest.companions.map((one) => ({
        id: one.id,
        name: one.fullName,
        byGuest: one.namedByGuest,
        coming: one.coming,
      })),
      ...page.guest.unnamed.map((one) => ({
        id: one.id,
        name: null,
        byGuest: false,
        coming: one.coming,
      })),
    ],
    tried: false,
    renaming: null,
    draft: '',
  };
}

export function hasStep(party: Party): boolean {
  return party.places > 0;
}

/** 0 for "Your guest" (one place in all), else the place's position, named first; fixed for the visit, so naming or declining one renumbers none of the others. */
export function placeOf(party: Party, id: string): number {
  return party.places === 1 ? 0 : party.people.findIndex((one) => one.id === id) + 1;
}

export interface PlaceWords {
  yourGuest: string;
  yourGuestN: (n: number) => string;
}

export function labelOf(party: Party, one: PartyPerson, words: PlaceWords): string {
  if (one.name != null) return one.name;
  const place = placeOf(party, one.id);

  return place === 0 ? words.yourGuest : words.yourGuestN(place);
}

export function toggled(party: Party, id: string): Party {
  return {
    ...party,
    people: party.people.map((one) => (one.id === id ? { ...one, coming: !one.coming } : one)),
  };
}

export function renaming(party: Party, id: string): Party {
  const one = party.people.find((each) => each.id === id);

  return one == null ? party : { ...party, renaming: id, draft: one.name ?? '', tried: false };
}

/** A blank name is refused for a named companion; for an unnamed place it leaves the place unnamed (sc-48740). */
export function renamed(party: Party): Party {
  const name = party.draft.trim();
  const one = party.people.find((each) => each.id === party.renaming);

  if (one == null) return party;
  if (name === '' && one.name != null) return { ...party, tried: true };

  return {
    ...party,
    people: party.people.map((each) =>
      each === one && name !== '' && each.name !== name ? { ...each, name, byGuest: true } : each,
    ),
    renaming: null,
    draft: '',
    tried: false,
  };
}

/** What Send my answer sends with Coming: each named place with its name, and each place left unnamed Coming or Not coming, every one by its id with its needs when given. */
export function choices(
  party: Party,
  needsOf: (id: string) => PageNeeds | undefined,
): { companions: CompanionChoice[]; unnamed: PlaceChoice[] } {
  const companions: CompanionChoice[] = [];
  const unnamed: PlaceChoice[] = [];

  for (const one of party.people) {
    const needs = one.coming ? needsOf(one.id) : undefined;
    const given = needs == null ? {} : { needs };

    if (one.name == null) unnamed.push({ id: one.id, coming: one.coming, ...given });
    else companions.push({ id: one.id, fullName: one.name, coming: one.coming, ...given });
  }

  return { companions, unnamed };
}

export function comingWith(party: Party): PartyPerson[] {
  return party.people.filter((one) => one.coming);
}
