import { tokens } from '../theme/tokens.ts';

/** Every field in the kit starts from these: the caret in the text's colour, never the platform blue, and no guessing at what was typed. */
export const FIELD_DEFAULTS = {
  cursorColor: tokens.colorInk,
  selectionColor: tokens.colorInk,
  placeholderTextColor: tokens.colorInkTertiary,
  autoCorrect: false,
  spellCheck: false,
} as const;

/** Revealed or not, a password is never corrected, capitalised or kept from a paste. */
export function passwordProps(revealed: boolean) {
  return {
    ...FIELD_DEFAULTS,
    secureTextEntry: !revealed,
    autoCapitalize: 'none',
    contextMenuHidden: false,
  } as const;
}

/** A one-time code, never corrected. A recovery code has letters and a hyphen, so a field that takes one gets the full keyboard. */
export function codeProps(takesRecoveryCode: boolean) {
  return {
    ...FIELD_DEFAULTS,
    keyboardType: takesRecoveryCode ? 'default' : 'number-pad',
    textContentType: 'oneTimeCode',
    autoCapitalize: 'none',
  } as const;
}
