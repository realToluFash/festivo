/** A number before sign-in completes (sc-4235): its country and last four digits, which a page masks as "+351 ••• ••• 4512". */
export interface PhoneHint {
  countryCode: string | null;
  lastDigits: string;
}

export function asPhoneHint(raw: unknown): PhoneHint | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { countryCode, lastDigits } = raw as Record<string, unknown>;
  if (typeof lastDigits !== 'string') return null;

  return { countryCode: typeof countryCode === 'string' ? countryCode : null, lastDigits };
}
