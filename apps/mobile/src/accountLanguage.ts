import { type Account } from '@soirely/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from './api.ts';
import { setLanguage, storedLanguage } from './i18n/index.ts';
import { languageOnSignIn } from './kit/accountLanguage.ts';
import { tokens } from './tokens.ts';

const CHOSEN_SIGNED_OUT = 'soirely:language:chosen-signed-out';
const NOT_YET_SAVED = '1';

/** The switcher: signed in, the account keeps it for every device and email; signed out, this device does. */
export async function chooseLanguage(locale: string | null): Promise<void> {
  await setLanguage(locale);

  if (locale == null) return;

  if ((await tokens.access()) != null) {
    await api.setLocale(locale).catch(() => {});
    return;
  }

  await AsyncStorage.setItem(CHOSEN_SIGNED_OUT, NOT_YET_SAVED).catch(() => {});
}

/** On reaching the signed-in app: a choice made signed out is saved; otherwise this device follows the account. Never throws: a language is never what fails a sign-in. */
export async function followAccount(account: Account): Promise<void> {
  try {
    const owner = await AsyncStorage.getItem(CHOSEN_SIGNED_OUT);
    const chosen = owner === NOT_YET_SAVED || owner === account.id;
    const next = languageOnSignIn(account.locale, await storedLanguage(), chosen);

    // A failed save leaves the choice with this account alone, for its next follow to retry: another account signing in follows its own language (sc-8006).
    if (next != null && 'save' in next) {
      await AsyncStorage.setItem(CHOSEN_SIGNED_OUT, account.id);
      await api.setLocale(next.save);
    } else if (next != null) await setLanguage(next.apply);

    await AsyncStorage.removeItem(CHOSEN_SIGNED_OUT);
  } catch {
    return;
  }
}
