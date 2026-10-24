import { LOCALE_CODES } from '@soirely/domain';

/** What sign-in does with a language (sc-852): save a choice made signed out, else follow the account. */
export function languageOnSignIn(
  account: string | null,
  device: string | null,
  chosenSignedOut: boolean,
): { save: string } | { apply: string } | null {
  if (chosenSignedOut && device != null) return { save: device };
  if (account != null && LOCALE_CODES.includes(account) && account !== device)
    return { apply: account };

  return null;
}
