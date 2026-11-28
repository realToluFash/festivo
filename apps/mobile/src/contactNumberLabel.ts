import type { ContactNumber, NumberKind } from '@soirely/domain';

const NUMBER_KIND_WORDS = {
  mobile: 'fromContacts.numberType.mobile',
  home: 'fromContacts.numberType.home',
  work: 'fromContacts.numberType.work',
  other: 'fromContacts.numberType.other',
} as const satisfies Record<NumberKind, string>;

export function contactNumberLabel(one: ContactNumber, t: (key: string) => string): string {
  return one.label !== '' ? one.label : t(NUMBER_KIND_WORDS[one.kind]);
}
