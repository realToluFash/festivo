import { type Account } from '@soirely/api-client';
import { LOCALE_CODES } from '@soirely/domain';

import { api } from './api.ts';
import { setLanguage, storedLanguage } from './i18n/index.ts';

/** A choice made signed out, which the next sign-in saves to the account (sc-852). */
const CHOSEN_SIGNED_OUT = 'soirely:language:chosen-signed-out';

/** The signed-in account's language, as last read or saved; null when it has none of the four. */
let saved: string | null = null;

/** The latest pick still being saved, which entering the app waits on rather than undoes, however many follow it. */
let saving: Promise<void> | null = null;

/** The switcher: signed in, the account keeps it for every device and email; signed out, this device does. */
export async function chooseLanguage(locale: string | null, signedIn: boolean): Promise<void> {
  const shown = setLanguage(locale);

  if (locale == null) return shown;

  if (signedIn) {
    const save = api.setLocale(locale).then(
      () => {
        saved = locale;
      },
      () => {},
    );
    saving = save;
    try {
      await shown;
      await save;
    } finally {
      if (saving === save) saving = null;
    }
    return;
  }

  await shown;

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
  saved = account.locale != null && LOCALE_CODES.includes(account.locale) ? account.locale : null;

  if (chosen && device != null) {
    await api.setLocale(device).then(
      () => {
        saved = device;
      },
      () => {},
    );
    return;
  }

  if (saved != null && saved !== device) await setLanguage(saved);
}

/** Entering the signed-in app: Automatic, or a failed save, picked elsewhere gives way to the account's language (sc-9797). */
export async function followSavedLanguage(): Promise<void> {
  while (saving != null) await saving;

  if (saved != null && saved !== storedLanguage()) await setLanguage(saved);
}
