import { type Account } from '@soirely/api-client';

import { api } from './api.ts';
import { setLanguage, storedLanguage } from './i18n/index.ts';

/** A choice made signed out, which the next sign-in saves to the account (sc-852). */
const CHOSEN_SIGNED_OUT = 'soirely:language:chosen-signed-out';

/** The switcher: signed in, the account keeps it for every device and email; signed out, this device does. */
export async function chooseLanguage(locale: string | null, signedIn: boolean): Promise<void> {
  await setLanguage(locale);

  if (locale == null) return;

  if (signedIn) {
    await api.setLocale(locale).catch(() => {});
    return;
  }

  try {
    localStorage.setItem(CHOSEN_SIGNED_OUT, '1');
  } catch {
    // Without storage the choice still holds for this page.
  }
}

/** On sign-in or restore: a choice made signed out is saved; otherwise this device opens in the account's. */
export async function followAccount(account: Account): Promise<void> {
  let chosen = false;

  try {
    chosen = localStorage.getItem(CHOSEN_SIGNED_OUT) != null;
    localStorage.removeItem(CHOSEN_SIGNED_OUT);
  } catch {
    chosen = false;
  }

  const device = storedLanguage();

  if (chosen && device != null) {
    await api.setLocale(device).catch(() => {});
    return;
  }

  if (account.locale != null && account.locale !== device) await setLanguage(account.locale);
}
