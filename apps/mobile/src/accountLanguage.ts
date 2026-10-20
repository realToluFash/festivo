import { type Account } from '@soirely/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from './api.ts';
import { setLanguage, storedLanguage } from './i18n/index.ts';
import { languageOnSignIn } from './kit/accountLanguage.ts';
import { tokens } from './tokens.ts';

const CHOSEN_SIGNED_OUT = 'soirely:language:chosen-signed-out';

/** The switcher: signed in, the account keeps it for every device and email; signed out, this device does. */
export async function chooseLanguage(locale: string | null): Promise<void> {
  await setLanguage(locale);

  if (locale == null) return;

  if ((await tokens.access()) != null) {
    await api.setLocale(locale).catch(() => {});
    return;
  }

  await AsyncStorage.setItem(CHOSEN_SIGNED_OUT, '1').catch(() => {});
}

/** On reaching the signed-in app: a choice made signed out is saved; otherwise this device follows the account. */
export async function followAccount(account: Account): Promise<void> {
  const chosen = (await AsyncStorage.getItem(CHOSEN_SIGNED_OUT).catch(() => null)) != null;
  await AsyncStorage.removeItem(CHOSEN_SIGNED_OUT).catch(() => {});

  const next = languageOnSignIn(account.locale, await storedLanguage(), chosen);

  if (next == null) return;
  if ('save' in next) await api.setLocale(next.save).catch(() => {});
  else await setLanguage(next.apply);
}
