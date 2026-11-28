import { numberFormat } from './locales.ts';

export type MoneyLanguage = 'en' | 'es' | 'fr' | 'pt';

/** The marks for money in each interface language, as sc-3901's AC fixes them: fr groups with a space, es and pt with a dot. */
const MARKS: Record<MoneyLanguage, { group: string; decimal: string }> = {
  en: { group: ',', decimal: '.' },
  fr: { group: ' ', decimal: ',' },
  es: { group: '.', decimal: ',' },
  pt: { group: '.', decimal: ',' },
};

export function moneyLanguage(locale: string): MoneyLanguage {
  const base = locale.slice(0, 2);

  return base === 'es' || base === 'fr' || base === 'pt' ? base : 'en';
}

export function minorDigits(currency: string): number {
  try {
    return (
      numberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ??
      2
    );
  } catch {
    return 2;
  }
}

const escaped = (mark: string): string => mark.replace(/[.]/gu, '\\.');

/** A typed money amount as the API takes it ("4500.00"), or null: a grouping mark only between groups of three, and never more decimals than the currency's minor unit. */
export function readAmount(
  typed: string,
  language: MoneyLanguage,
  currency: string,
): string | null {
  const plain = typed.trim().replace(/[\u00a0\u202f]/gu, ' ');
  const { group, decimal } = MARKS[language];
  const found = new RegExp(
    `^(\\d{1,3}(?:${escaped(group)}\\d{3})+|\\d+)(?:${escaped(decimal)}(\\d+))?$`,
    'u',
  ).exec(plain);
  if (found == null) return null;
  const whole = (found[1] ?? '').split(group).join('');
  const fraction = found[2] ?? '';
  const digits = minorDigits(currency);
  if (fraction.length > digits || whole.length > 15) return null;

  return digits === 0 ? whole : `${whole}.${fraction.padEnd(digits, '0')}`;
}

function written(amount: number, language: MoneyLanguage, digits: number): string {
  const { group, decimal } = MARKS[language];
  const [whole = '0', fraction = ''] = amount.toFixed(digits).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, group);

  return fraction === '' ? grouped : `${grouped}${decimal}${fraction}`;
}

/** 12.50 written to the currency's minor unit in the language's format: en 12.50, fr 12,50, JPY 12, KWD 12.500. */
export function amountExample(language: MoneyLanguage, currency: string): string {
  const digits = minorDigits(currency);

  return written(digits === 0 ? 12 : 12.5, language, digits);
}

/** The API's amount as a form shows it to be typed again: "4,500.00" in en, "4 500,00" in fr. */
export function typedAmount(amount: string, language: MoneyLanguage, currency: string): string {
  const digits = minorDigits(currency);
  const [whole = '0', fraction = ''] = amount.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, MARKS[language].group);

  return digits === 0
    ? grouped
    : `${grouped}${MARKS[language].decimal}${fraction.padEnd(digits, '0')}`;
}
