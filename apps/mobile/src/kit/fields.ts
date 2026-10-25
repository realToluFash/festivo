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

export interface FieldText {
  held: boolean;
  value: string | undefined;
  defaultValue: string | undefined;
  typed: string;
  pinned: string | undefined;
}

/** The text an uncontrolled field was last given, and the font scale it was given at: native puts that text back, telling nobody, whenever it changes and whenever the text size does. */
export function nextPin(
  field: FieldText,
  fontScale: number,
  scale: number,
): { pinned: string | undefined; scale: number } {
  const repin = (field.held || fontScale !== scale) && field.value === undefined;

  return { pinned: repin ? field.typed : field.pinned, scale: fontScale };
}

/** What a field hands TextInput as its text, held or not. */
export function fieldText(field: FieldText): { value?: string; defaultValue?: string } {
  if (field.value !== undefined) return { value: field.value };
  if (field.held) return { value: field.typed };
  const defaultValue = field.pinned ?? field.defaultValue;

  return defaultValue === undefined ? {} : { defaultValue };
}
