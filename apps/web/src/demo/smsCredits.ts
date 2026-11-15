/** A sample of sc-3928's unit-cost table: the credits one SMS part costs, by the country of the number it goes to (its dialling code). */
export const CREDITS_A_PART: Readonly<Record<string, number>> = {
  US: 2,
  GB: 9,
  FR: 13,
  ES: 14,
  PT: 8,
  BR: 10,
  MX: 29,
  NG: 62,
};

export interface Text {
  parts: number;
  /** The country of the number it goes to, never the guest's language or the event's. */
  country: string;
}

/** What one text costs (sc-3946): its parts × the credits a part for its number's country. */
export function textCredits(text: Text): number {
  const rate = CREDITS_A_PART[text.country];

  if (rate == null) throw new Error(`No sample rate for ${text.country}`);

  return text.parts * rate;
}

export function textsCredits(texts: readonly Text[]): number {
  return texts.reduce((sum, text) => sum + textCredits(text), 0);
}
