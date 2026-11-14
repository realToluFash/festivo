import type { GroupChoice, GuestDetails, GuestEdit, NewGuest } from '@soirely/api-client';
import {
  type NeedsTyped,
  type Typed,
  groupChanged,
  needsInputOf,
  needsTypedOf,
  newGuestOf,
  phoneFields,
} from '@soirely/domain';

import type { GroupPick } from './GuestGroup.tsx';

interface Companion {
  id: string | null;
  name: string;
  needs: NeedsTyped;
}

export interface Values {
  fullName: string;
  email: string;
  country: string;
  number: string;
  companions: readonly Companion[];
  language: string | null;
  /** sc-5519: a group by id, a name made on save, or none. */
  group: GroupPick;
  needs: NeedsTyped;
}

export function valuesOf(guest: GuestDetails | null, startCountry: string): Values {
  const phone = guest?.mobile == null ? null : phoneFields(guest.mobile);

  return {
    fullName: guest?.fullName ?? '',
    email: guest?.email ?? '',
    country: phone?.country ?? startCountry,
    number: phone?.number ?? '',
    companions: (guest?.companions ?? []).map((one) => ({
      id: one.id,
      name: one.fullName ?? '',
      needs: needsTypedOf(one.needs),
    })),
    language: guest?.language ?? null,
    group: guest?.group == null ? null : { id: guest.group.id },
    needs: needsTypedOf(guest?.needs),
  };
}

export function typedOf(values: Values): Typed {
  return {
    fullName: values.fullName,
    email: values.email,
    country: values.country,
    number: values.number,
    companions: values.companions.map((one) => one.name),
    language: values.language,
  };
}

/** A name to make goes with `create`, so one a colleague made meanwhile is refused rather than joined. */
function choiceOf(pick: GroupPick): GroupChoice {
  return pick == null || 'id' in pick ? pick : { name: pick.name, create: true };
}

export function addOf(values: Values, allowDuplicate: boolean): NewGuest {
  const sent = newGuestOf(typedOf(values), allowDuplicate);

  return {
    ...sent,
    companions: values.companions.map((one, at) => ({
      fullName: sent.companions?.[at]?.fullName ?? null,
      needs: needsInputOf(one.needs),
    })),
    needs: needsInputOf(values.needs),
    ...(values.group == null ? {} : { group: choiceOf(values.group) }),
  };
}

/** The group goes only when it changed, so a group a colleague renamed or emptied meanwhile stays as it is. */
export function editOf(
  values: Values,
  allowDuplicate: boolean,
  current: { id: string } | null = null,
): GuestEdit {
  const sent = newGuestOf(typedOf(values), allowDuplicate);
  const group = choiceOf(values.group);

  return {
    ...sent,
    companions: values.companions.map((one, at) => ({
      id: one.id,
      fullName: sent.companions?.[at]?.fullName ?? null,
      needs: needsInputOf(one.needs),
    })),
    needs: needsInputOf(values.needs),
    ...(groupChanged(current, group) ? { group } : {}),
  };
}
