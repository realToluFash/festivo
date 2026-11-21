import type { SeatingGuest, SeatingPlan } from '@soirely/api-client';

/** Who a pick in Seat takes: a guest without a seat, and their companions still without one. */
export interface WaitingParty {
  lead: SeatingGuest;
  companions: SeatingGuest[];
}

export function waitingParties(guests: readonly SeatingGuest[]): WaitingParty[] {
  const byId = new Map(guests.map((guest) => [guest.id, guest]));
  const unseated = guests.filter((guest) => guest.seat == null);
  const parties: WaitingParty[] = [];

  for (const guest of [...unseated].sort((a, b) => a.position - b.position)) {
    if (guest.leadId == null) {
      parties.push({
        lead: guest,
        companions: unseated.filter((one) => one.leadId === guest.id),
      });
    } else if (byId.get(guest.leadId)?.seat != null && guest.fullName != null) {
      parties.push({ lead: guest, companions: [] });
    }
  }

  return parties;
}

export function peopleIn(party: WaitingParty): number {
  return 1 + party.companions.length;
}

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
}

export interface TrayFilter {
  unsure: boolean;
  search: string;
  groups: string[];
}

/** `null` is No group. */
export function groupOf(party: WaitingParty): string | null {
  return party.lead.groupName;
}

export function shownParties(parties: readonly WaitingParty[], filter: TrayFilter): WaitingParty[] {
  const q = plain(filter.search.trim());

  return parties.filter(
    (party) =>
      (filter.unsure || party.lead.reply === 'coming') &&
      (filter.groups.length === 0 || filter.groups.includes(groupOf(party) ?? '')) &&
      (q === '' ||
        [party.lead, ...party.companions].some((one) => plain(one.fullName ?? '').includes(q))),
  );
}

export function guestOf(plan: SeatingPlan, id: string | null): SeatingGuest | null {
  return id == null ? null : (plan.guests.find((guest) => guest.id === id) ?? null);
}

/** A pick takes a guest's party only while they are without a seat: picking a seated guest moves just them. */
export function pickedParty(plan: SeatingPlan, id: string | null): WaitingParty | null {
  const guest = guestOf(plan, id);

  if (guest == null) return null;
  if (guest.seat != null) return { lead: guest, companions: [] };

  return (
    waitingParties(plan.guests).find((party) => party.lead.id === id) ?? {
      lead: guest,
      companions: [],
    }
  );
}

export function seatedAt(plan: SeatingPlan, placeId: string, seat: number): SeatingGuest | null {
  return (
    plan.guests.find((guest) => guest.seat?.id === placeId && guest.seat.seat === seat) ?? null
  );
}

export type ChairState = 'taken' | 'held' | 'empty' | 'unusable';

/** A chair's state: Held is a companion with no name yet in it. */
export function chairStateOf(
  plan: SeatingPlan,
  placeId: string,
  seat: number,
  unusable: boolean,
): { state: ChairState; guest: SeatingGuest | null } {
  const guest = seatedAt(plan, placeId, seat);

  if (guest != null) return { state: guest.fullName == null ? 'held' : 'taken', guest };
  return { state: unusable ? 'unusable' : 'empty', guest: null };
}

export function takenAt(plan: SeatingPlan, placeId: string): number {
  return plan.guests.filter((guest) => guest.seat?.id === placeId).length;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0]?.toLocaleUpperCase() ?? '')
    .join('');
}

/** The chairs at a table or row nobody sits in and that can be used: its "{n} free" while a guest is picked (sc-5030). */
export function freeAt(
  plan: SeatingPlan,
  place: { id: string; seats: number; unusableSeats: readonly number[] },
): number {
  const taken = new Set(
    plan.guests.flatMap((guest) => (guest.seat?.id === place.id ? [guest.seat.seat] : [])),
  );

  return Array.from({ length: place.seats }, (_, index) => index + 1).filter(
    (seat) => !taken.has(seat) && !place.unusableSeats.includes(seat),
  ).length;
}
