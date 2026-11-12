import { OPEN, type Visit } from './guest.ts';
import { type Party, comingWith, hasStep } from './guestCompanions.ts';
import { partyPeople } from './guestKitchen.ts';
import { type GuestKitchenActions, freshKitchen } from './useGuestKitchen.ts';

type Go = (change: (was: Visit) => Partial<Visit>, want?: string) => void;

export interface PartyActions {
  change: (next: (party: Party) => Party, want?: string) => void;
  next: () => void;
  back: () => void;
  edit: () => void;
}

export function partyActions(go: Go, kitchen: GuestKitchenActions, visit: Visit): PartyActions {
  const from = visit.view.kind === 'withYou' ? visit.view.from : 'answer';

  return {
    change: (next, want) => go((was) => ({ party: next(was.party) }), want),
    next: () => {
      go((was) => {
        const coming = comingWith(was.party);
        const kitchen = was.kitchen;

        return {
          companionsComing: coming.length,
          kitchen:
            kitchen == null
              ? freshKitchen(from, was, coming)
              : {
                  ...kitchen,
                  people: partyPeople(kitchen.people, coming),
                  record: kitchen.record == null ? null : partyPeople(kitchen.record, coming),
                  from,
                },
        };
      });
      kitchen.open(from);
    },
    back: () =>
      go(
        (was) => ({
          view:
            was.view.kind === 'withYou' && was.view.from === 'changing'
              ? { kind: 'changing', busy: null }
              : OPEN,
        }),
        'row-coming',
      ),
    edit: () =>
      go(
        (was) => ({
          view: {
            kind: 'withYou',
            from: was.kitchen?.from === 'changing' ? 'changing' : 'answer',
          },
        }),
        'withYouHead',
      ),
  };
}

/** The kitchen step's own Back returns to Who's coming with you? when there is one, before the date only. */
export function withPartyBack(
  kitchen: GuestKitchenActions,
  visit: Visit,
  party: PartyActions,
): GuestKitchenActions {
  return hasStep(visit.party) && visit.view.kind === 'kitchen' && visit.kitchen?.from !== 'closed'
    ? { ...kitchen, back: party.edit }
    : kitchen;
}
