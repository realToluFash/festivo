import {
  type Vendor,
  type VendorCategory,
  type VendorTyped,
  type Violation,
} from '@soirely/api-client';
import { emailProblem, phoneFields, phoneLengthProblem, visibleLength } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { phoneProblemMessage } from '../../../phoneProblem.ts';

/** The form as typed: Settings › Vendors' Add a vendor and Edit vendor (sc-82). */
export interface Draft {
  name: string;
  category: VendorCategory | '';
  contact: string;
  email: string;
  country: string;
  phone: string;
  website: string;
  address: string;
  note: string;
}

export const BLANK: Draft = {
  name: '',
  category: '',
  contact: '',
  email: '',
  country: '',
  phone: '',
  website: '',
  address: '',
  note: '',
};

export type DraftField = keyof Omit<Draft, 'country'>;
export type Problems = Partial<Record<keyof Draft, string>>;

type Limited = 'name' | 'contact' | 'email' | 'website' | 'address' | 'note';

/** The longest each field may be, in characters (decided 17 Oct); the API holds the same. */
export const LIMITS: Record<Limited, number> = {
  name: 100,
  contact: 100,
  email: 254,
  website: 2048,
  address: 300,
  note: 1000,
};

const TOO_LONG: Record<Limited, string> = {
  name: 'vendors.nameTooLong',
  contact: 'vendors.contactTooLong',
  email: 'vendors.emailTooLong',
  website: 'vendors.websiteTooLong',
  address: 'vendors.addressTooLong',
  note: 'vendors.noteTooLong',
};

/** The API's field for each of the form's. */
const SENT_AS: Record<keyof Draft, keyof VendorTyped> = {
  name: 'name',
  category: 'category',
  contact: 'contactName',
  email: 'emailAddress',
  country: 'phoneCountryCode',
  phone: 'phoneNumber',
  website: 'website',
  address: 'address',
  note: 'note',
};

export function draftOf(vendor: Vendor): Draft {
  const phone = vendor.phoneNumber == null ? null : phoneFields(vendor.phoneNumber);

  return {
    name: vendor.name,
    category: vendor.category,
    contact: vendor.contactName ?? '',
    email: vendor.emailAddress ?? '',
    country: phone?.country ?? vendor.phoneCountryCode ?? '',
    phone: phone?.number ?? vendor.phoneNumber ?? '',
    website: vendor.website ?? '',
    address: vendor.address ?? '',
    note: vendor.note ?? '',
  };
}

export function typedOf(draft: Draft): VendorTyped {
  return {
    name: draft.name,
    category: draft.category,
    contactName: draft.contact,
    emailAddress: draft.email,
    phoneCountryCode: draft.phone.trim() === '' ? '' : draft.country,
    phoneNumber: draft.phone,
    website: draft.website,
    address: draft.address,
    note: draft.note,
  };
}

export function schemeOf(typed: string): string | null {
  const found = /^([a-z][a-z0-9+.-]*):(\/\/|(?!\d))/i.exec(typed.trim());

  return found?.[1]?.toLowerCase() ?? null;
}

/** Each field checked as the form checks it before anything is sent; the API checks them again. */
export function draftProblems(draft: Draft, t: TFunction): Problems {
  const problems: Problems = {};

  if (draft.name.trim() === '') problems.name = t('vendors.nameBlank');
  if (draft.category === '') problems.category = t('vendors.categoryBlank');

  for (const field of Object.keys(LIMITS) as Limited[]) {
    if (problems[field] == null && visibleLength(draft[field].trim()) > LIMITS[field])
      problems[field] = t(TOO_LONG[field], { count: LIMITS[field] });
  }

  if (problems.email == null && draft.email.trim() !== '' && emailProblem(draft.email) != null)
    problems.email = t('forms.emailShape');

  if (draft.phone.trim() !== '') {
    const problem = phoneLengthProblem(draft.phone, draft.country);
    const line = phoneProblemMessage(problem, draft.country, t);
    if (problem === 'noCountry' && line != null) problems.country = line;
    else if (line != null) problems.phone = line;
  }

  const scheme = schemeOf(draft.website);
  if (problems.website == null && scheme != null && scheme !== 'http' && scheme !== 'https')
    problems.website = t('vendors.websiteScheme');

  return problems;
}

/** The API's refusals, each at the form's field; one the form has no field for is left to the caller. */
export function refusedAt(violations: readonly Violation[]): Problems {
  const problems: Problems = {};

  for (const violation of violations) {
    const field = (Object.keys(SENT_AS) as (keyof Draft)[]).find(
      (key) => SENT_AS[key] === violation.propertyPath,
    );
    if (field != null && problems[field] == null) problems[field] = violation.message;
  }

  return problems;
}

/** How many fields need fixing: the country and its number are one field. */
export function fieldsToFix(problems: Problems): number {
  return new Set(Object.keys(problems).map((key) => (key === 'country' ? 'phone' : key))).size;
}

export function changed(draft: Draft, from: Draft): boolean {
  return (Object.keys(from) as (keyof Draft)[]).some((key) => draft[key] !== from[key]);
}
