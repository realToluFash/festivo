import { minorDigits, numberFormat } from '@soirely/domain';

/** The API's money string in whole units at any size, rounded half up by Intl from the exact decimal; a change under one unit in the minor unit, so a rise never reads +£0 (pm, 7 Nov). */
export function wholeMoney(amount: string, currency: string, locale: string): string {
  const digits = underOneUnit(amount) ? minorDigits(currency) : 0;

  return (
    numberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
      // ECMA-402 formats a decimal string exactly; a Number holds only about 16 digits (sc-72618).
      .format(amount as unknown as number)
  );
}

function underOneUnit(amount: string): boolean {
  return /^[-+]?0*(?:\.\d*)?$/u.test(amount) && /[1-9]/u.test(amount);
}

/** A figure's digit groups, each ending after its group separator: a line may break between two, never inside one. */
export function figureGroups(figure: string): string[] {
  return figure.split(/(?<=\d[,.\u00a0\u202f ](?=\d{3}))/u);
}
