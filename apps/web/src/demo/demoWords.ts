type Slots = Readonly<Record<string, string | number>>;

export type PluralBase<W> = {
  [K in keyof W]: K extends `${infer Base}_one` ? Base : never;
}[keyof W];

/** The demos' one way to say their boards' English: {{slots}} filled, plural families ("_one", "_other") chosen, lists joined, each in the locale given. */
export function demoWords<W extends Readonly<Record<string, string>>>(
  words: W,
  { locale = 'en-US', listLocale = locale }: { locale?: string; listLocale?: string } = {},
) {
  const number = new Intl.NumberFormat(locale);
  const plural = new Intl.PluralRules(locale);
  const list = new Intl.ListFormat(listLocale, { style: 'long', type: 'conjunction' });

  function filled(text: string, slots: Slots = {}): string {
    return text.replaceAll(/\{\{(\w+)(?:, number)?\}\}/gu, (whole, slot: string) => {
      const value = slots[slot];

      if (value == null) return whole;

      return typeof value === 'number' ? number.format(value) : value;
    });
  }

  function many(base: PluralBase<W>, count: number, slots: Slots = {}): string {
    const form = plural.select(count) === 'one' ? 'one' : 'other';

    return filled(words[`${String(base)}_${form}` as keyof W] as string, { count, ...slots });
  }

  function listed(items: readonly string[]): string {
    return list.format(items);
  }

  return { filled, many, listed };
}
