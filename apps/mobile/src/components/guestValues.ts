import type { GuestDetails, GuestEdit } from '@soirely/api-client';
import { type Typed, newGuestOf, phoneFields } from '@soirely/domain';

interface Companion {
  id: string | null;
  name: string;
}

export interface Values {
  fullName: string;
  email: string;
  country: string;
  number: string;
  companions: readonly Companion[];
  language: string | null;
}

export function valuesOf(guest: GuestDetails | null, startCountry: string): Values {
  const phone = guest?.mobile == null ? null : phoneFields(guest.mobile);

  return {
    fullName: guest?.fullName ?? '',
    email: guest?.email ?? '',
    country: phone?.country ?? startCountry,
    number: phone?.number ?? '',
    companions: (guest?.companions ?? []).map((one) => ({ id: one.id, name: one.fullName ?? '' })),
    language: guest?.language ?? null,
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

export function editOf(values: Values, allowDuplicate: boolean): GuestEdit {
  const sent = newGuestOf(typedOf(values), allowDuplicate);

  return {
    ...sent,
    companions: values.companions.map((one, at) => ({
      id: one.id,
      fullName: sent.companions?.[at]?.fullName ?? null,
    })),
  };
}
