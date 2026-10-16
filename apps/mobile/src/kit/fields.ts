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

/** A one-time code: digits, offered from the text or the email, never corrected. */
export const CODE_PROPS = {
  ...FIELD_DEFAULTS,
  keyboardType: 'number-pad',
  textContentType: 'oneTimeCode',
  autoCapitalize: 'none',
} as const;
