import { OPEN, type Visit } from './guest.ts';
import { type Party, comingWith, hasStep } from './guestCompanions.ts';
import type { GuestKitchenActions } from './useGuestKitchen.ts';

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
        const count = comingWith(was.party).length;

        return {
          companionsComing: count,
          kitchen: count === was.companionsComing ? was.kitchen : null,
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
