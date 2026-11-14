import {
  type GroupPick,
  type GroupProblem,
  type GuestGroup,
  NOTE_MOST,
  NO_NEEDS,
  type Needs,
  WEDDING_GROUPS,
  fullGroups,
  needsOf,
  sameGroup,
  typedProblem,
} from './GuestNeeds.ts';
import { type AddState, type EditState, KWAME_SAVED } from './GuestsModel.ts';
import type { SampleGuest } from './GuestsSample.ts';

/** The group a colleague made while the form was open (groupTaken), and the name the form tried. */
export const THEIR_GROUP: GuestGroup = { id: 'g-family', name: 'Family', people: 4 };
export const NEW_GROUP = 'Family';
export const LONG_GROUP = 'The friends we met on the walking holiday in the Lake District';
export const LIMIT_TYPED = 'Cousins';

export const OTHER_LONG = 'Raw onion, raw garlic and anything pickled, which she says '.repeat(2);
export const NOTE_LONG = 'Seat her away from the speakers; she asked us twice. '
  .repeat(10)
  .slice(0, NOTE_MOST + 12);

export interface GroupNeedsStart {
  groups: GuestGroup[];
  pick: GroupPick;
  picking: boolean;
  typed: string;
  /** What return said, until the name changes: only blank waits for return; over 60 and 50 groups show as typed. */
  returned: GroupProblem | null;
  taken: string | null;
  needs: Needs;
  open: boolean;
  checked: boolean;
  companionNeeds: Needs[];
  companionOpen: number[];
}

export function pickOf(groups: readonly GuestGroup[], name: string | null | undefined): GroupPick {
  if (name == null) return null;
  const found = sameGroup(groups, name);

  return found == null ? { name } : { id: found.id };
}

/** Each Edit state's group and needs as the board draws it, on the guest guestOf opens. */
export function groupNeedsStart(state: EditState | null, g: SampleGuest): GroupNeedsStart {
  const base: GroupNeedsStart = {
    groups: [...WEDDING_GROUPS],
    pick: pickOf(WEDDING_GROUPS, g.group),
    picking: false,
    typed: '',
    returned: null,
    taken: null,
    needs: g.needs ?? NO_NEEDS,
    open: false,
    checked: false,
    companionNeeds: g.companions.map((c) => c.needs ?? NO_NEEDS),
    companionOpen: [],
  };

  switch (state) {
    case 'editGroup':
      return { ...base, picking: true };
    case 'groupBlank':
      return { ...base, picking: true, returned: 'blank' };
    case 'groupTooLong':
      return { ...base, picking: true, typed: LONG_GROUP };
    case 'groupNew':
      return { ...base, pick: { name: NEW_GROUP } };
    case 'groupTaken':
      return {
        ...base,
        groups: [...WEDDING_GROUPS, THEIR_GROUP],
        pick: { name: NEW_GROUP },
        taken: THEIR_GROUP.name,
      };
    case 'groupLimit':
      return { ...base, groups: fullGroups(), picking: true, typed: LIMIT_TYPED };
    case 'needsOpen':
      return { ...base, open: true };
    case 'needsFilled':
      return { ...base, needs: KWAME_SAVED };
    case 'otherBlank':
      return { ...base, needs: needsOf({ allergies: ['other'] }), open: true, checked: true };
    case 'otherTooLong':
      return {
        ...base,
        needs: needsOf({ diet: ['other'], otherDiet: OTHER_LONG }),
        open: true,
        checked: true,
      };
    case 'noteTooLong':
      return { ...base, needs: needsOf({ note: NOTE_LONG }), open: true, checked: true };
    case 'companionNeeds':
      return { ...base, companionOpen: [0] };
    case 'editOffline':
      return { ...base, pick: { name: NEW_GROUP }, needs: KWAME_SAVED };
    default:
      return base;
  }
}

/** The picker's line for what is typed: blank only once return was pressed; over 60 and 50 groups as soon as they are typed. */
export function shownProblem(
  groups: readonly GuestGroup[],
  typed: string,
  returned: GroupProblem | null,
): GroupProblem | null {
  if (returned != null) return returned;
  if (typed.trim() === '') return null;
  const problem = typedProblem(groups, typed);

  return problem === 'blank' ? null : problem;
}

/** Add guest's group and needs: empty, or Work with an allergy and a diet in addGroupNeeds. */
export function addNeedsStart(state: AddState | null): GroupNeedsStart {
  const empty: GroupNeedsStart = {
    groups: [...WEDDING_GROUPS],
    pick: null,
    picking: false,
    typed: '',
    returned: null,
    taken: null,
    needs: NO_NEEDS,
    open: false,
    checked: false,
    companionNeeds: [],
    companionOpen: [],
  };

  return state === 'addGroupNeeds'
    ? {
        ...empty,
        pick: { id: 'g-work' },
        needs: needsOf({ allergies: ['peanuts'], diet: ['vegan'] }),
      }
    : empty;
}
