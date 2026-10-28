import { tokens } from '../theme/tokens.ts';

/** Every field in the kit starts from these: the caret in the text's colour, never the platform blue, and no guessing at what was typed. */
export const FIELD_DEFAULTS = {
  cursorColor: tokens.colorInk,
  selectionColor: tokens.colorInk,
  placeholderTextColor: tokens.colorInkTertiary,
  autoCorrect: false,
  spellCheck: false,
} as const;

export interface FieldName {
  accessibilityLabel?: string | undefined;
  accessibilityLabelledBy?: string | undefined;
}

/** On Android a field is named by the label it shows, or while empty by its placeholder and once filled by an unseen copy of it: TalkBack reads a content description in place of what the field holds, and again on every key, and reads no placeholder once there is text (sc-17281, sc-17333). */
export function fieldName(
  os: string,
  name: string | undefined,
  shown: {
    labelID?: string | undefined;
    placeholder?: string | undefined;
    filled?: { held: boolean; nameID: string } | undefined;
  },
): FieldName {
  if (os !== 'android') return { accessibilityLabel: name };
  if (shown.labelID != null)
    return { accessibilityLabel: undefined, accessibilityLabelledBy: shown.labelID };
  if (shown.placeholder == null || shown.placeholder === '') return { accessibilityLabel: name };

  return shown.filled?.held === true
    ? { accessibilityLabel: undefined, accessibilityLabelledBy: shown.filled.nameID }
    : { accessibilityLabel: undefined };
}

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
