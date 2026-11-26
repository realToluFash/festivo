import { createInstance } from 'i18next';

import type { Need } from '../../kit/today.ts';
import en from '../../i18n/locales/en.json';

const english = createInstance({
  resources: { en: { translation: en } },
  lng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});
void english.init();

/** The demos draw the due words in English, through the app's own function. */
export const demoT = english.t;

export function headLabel(count: number): string {
  return count === 1 ? 'Needs you, 1 thing' : `Needs you, ${count} things`;
}

export function rowLabel({ title, event, due }: Pick<Need, 'title' | 'event' | 'due'>): string {
  return `${title}, ${event.name}, ${due}`;
}
