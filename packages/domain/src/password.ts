/** The API's PasswordPolicy::MINIMUM_LENGTH. The breach check is the API's alone. */
export const PASSWORD_MINIMUM_LENGTH = 12;

/** Counted as the API counts: characters after NFKC, so "é" typed either way is one. */
export function meetsPasswordLength(password: string): boolean {
  return [...password.normalize('NFKC')].length >= PASSWORD_MINIMUM_LENGTH;
}
