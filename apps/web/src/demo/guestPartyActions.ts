import { type Visit, stepBack } from './guest.ts';
import { type Party, comingWith, hasStep, placeOf } from './guestCompanions.ts';
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
        const coming = comingWith(was.party).map((one) => ({
          key: one.key,
          name: one.name,
          place: one.name == null ? placeOf(was.party, one) : null,
        }));
        const kitchen = was.kitchen;

        return {
          companionsComing: coming.length,
          kitchen:
            kitchen == null
              ? freshKitchen(from, was, coming)
              : {
                  ...kitchen,
                  people: partyPeople(kitchen.people, coming, kitchen.record),
                  from,
                },
        };
      });
      kitchen.open(from);
    },
    back: () =>
      go(
        (was) => ({
          view: stepBack(was.view.kind === 'withYou' ? was.view.from : 'answer'),
        }),
        'row-coming',
      ),
    edit: () =>
      go(
        (was) => ({
          view: {
            kind: 'withYou',
            from:
              was.kitchen == null || was.kitchen.from === 'closed' ? 'answer' : was.kitchen.from,
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
