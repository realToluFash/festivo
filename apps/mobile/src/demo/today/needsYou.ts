import { createInstance } from 'i18next';

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
