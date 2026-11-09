import { CONTACTS_MOST, contactsLeft, firstUnverified } from '@soirely/domain';
import type { TFunction } from 'i18next';

export type ContactKind = 'email' | 'phone';

/** An address or a number as Your account lists it. */
export interface ContactRow {
  id: string;
  shown: string;
  verified: boolean;
  primary: boolean;
}

/** The one line under you: what just happened until the page is left, else what is not verified yet. */
export function cardLine(
  emails: readonly ContactRow[],
  phones: readonly ContactRow[],
  said: string | null,
  t: TFunction,
): { text: string; done: boolean } | null {
  if (said != null) return { text: said, done: true };
  const waiting = firstUnverified(emails, phones);

  return waiting == null
    ? null
    : { text: t('account.notVerifiedYet', { shown: waiting.row.shown }), done: false };
}

export const KIND_KEYS = {
  email: {
    section: 'contacts.emailsTitle',
    add: 'contacts.addEmail',
    label: 'contacts.emailLabel',
    help: 'contacts.emailHelp',
    makePrimary: 'contacts.makePrimary',
    removeTitle: 'contacts.removeTitle',
    removeConfirm: 'contacts.removeConfirm',
    removeKeep: 'contacts.removeKeep',
    primaryLine: 'account.emailPrimaryLine',
    otherLine: 'account.emailOtherLine',
  },
  phone: {
    section: 'contacts.phonesTitle',
    add: 'contacts.addPhone',
    label: 'contacts.phoneLabel',
    help: 'contacts.phoneHelp',
    makePrimary: 'contacts.makePrimaryPhone',
    removeTitle: 'contacts.removeTitlePhone',
    removeConfirm: 'contacts.removeConfirmPhone',
    removeKeep: 'contacts.removeKeepPhone',
    primaryLine: 'account.phonePrimaryLine',
    otherLine: 'account.phoneOtherLine',
  },
} as const satisfies Record<ContactKind, Record<string, string>>;

export function contactLine(kind: ContactKind, row: ContactRow, t: TFunction): string {
  return t(row.primary ? KIND_KEYS[kind].primaryLine : KIND_KEYS[kind].otherLine);
}

export function contactsFoot(kind: ContactKind, rows: readonly ContactRow[], t: TFunction): string {
  const left = contactsLeft(rows);
  const email = kind === 'email';
  if (left === 0)
    return t(email ? 'contacts.capFullEmails' : 'contacts.capFullPhones', { most: CONTACTS_MOST });

  return t(email ? 'contacts.capEmails' : 'contacts.capPhones', {
    count: left,
    most: CONTACTS_MOST,
  });
}

/** What the card says once a code is in: a primary was the one awaited, any other stays an alternative. */
export function verifiedWords(row: ContactRow, kind: ContactKind, t: TFunction): string {
  if (kind === 'email')
    return row.primary
      ? t('contacts.verifiedDone', { address: row.shown })
      : t('account.verifiedAlternative', { address: row.shown });

  return row.primary
    ? t('contacts.verifiedPrimaryPhone', { number: row.shown })
    : t('account.verifiedAlternativePhone', { number: row.shown });
}

export function promotedWords(kind: ContactKind, shown: string, t: TFunction): string {
  return kind === 'email'
    ? t('contacts.promoted', { address: shown })
    : t('contacts.promotedPhone', { number: shown });
}

/** How a code reached the person: by email, or a phone's route as `codeWording` names it. */
export type CodeLine = 'email' | 'whatsapp' | 'fallback' | 'chosen' | 'texted';

export interface VerifyWords {
  title: string;
  lead: string;
  codeLabel: string;
  blank: string;
  short: string;
  wrong: string;
  expired: { title: string; line: string };
  exhausted: { title: string; line: string };
}

/** Check your email or your messages, in the words of the way the code went. */
export function verifyWords(line: CodeLine, shown: string, t: TFunction): VerifyWords {
  if (line === 'email')
    return {
      title: t('verifyEmail.title'),
      lead: t('verifyEmail.intro', { address: shown }),
      codeLabel: t('verifyEmail.codeLabel'),
      blank: t('verifyEmail.codeBlank'),
      short: t('verifyEmail.codeShort'),
      wrong: t('verifyEmail.wrong'),
      expired: { title: t('verifyEmail.expiredTitle'), line: t('verifyEmail.expiredBody') },
      exhausted: { title: t('verifyEmail.exhaustedTitle'), line: t('verifyEmail.exhaustedBody') },
    };
  const whatsApp = line === 'whatsapp';
  const lead = {
    whatsapp: 'verifyPhone.introWhatsApp',
    fallback: 'verifyPhone.introFallback',
    chosen: 'verifyPhone.introChosen',
    texted: 'verifyPhone.intro',
  }[line];

  return {
    title: t('verifyPhone.title'),
    lead: t(lead, { number: shown }),
    codeLabel: t(whatsApp ? 'verifyPhone.codeLabelWhatsApp' : 'verifyPhone.codeLabel'),
    blank: t(whatsApp ? 'verifyPhone.codeBlankWhatsApp' : 'verifyPhone.codeBlank'),
    short: t('verifyPhone.codeShort'),
    wrong: t(whatsApp ? 'verifyPhone.wrongWhatsApp' : 'verifyPhone.wrong'),
    expired: { title: t('verifyPhone.expiredTitle'), line: t('verifyPhone.expiredBody') },
    exhausted: { title: t('verifyPhone.exhaustedTitle'), line: t('verifyPhone.exhaustedBody') },
  };
}

/** The About you row's second line for a zone: its IANA id, read as words. */
export function zoneLine(id: string | null, t: TFunction): string {
  return id == null ? t('timeZone.title') : t('account.zoneLine', { id: id.replace(/_/gu, ' ') });
}
