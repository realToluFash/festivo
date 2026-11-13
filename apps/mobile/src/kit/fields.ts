import { tokens } from '../theme/tokens.ts';

/** Every field in the kit starts from these: the caret in the text's colour, never the platform blue, no guessing at what was typed, and on an Android phone on its side the form stays in sight rather than giving way to the keyboard's full-screen box (sc-35256). */
export const FIELD_DEFAULTS = {
  disableFullscreenUI: true,
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

/** A control a line under it refuses: the word a screen reader says with its name, the line, and on Android the unseen name that carries the word. */
export interface Refused {
  word: string;
  line: string | null | undefined;
  nameID?: string | undefined;
}

/** "Invalid" goes with the name, never in the hint, so it is said with hints off (sc-31323). On Android a field named by a label it shows is named by an unseen copy of that label with the word, as a label takes one view. */
export function refusedName(
  os: string,
  named: FieldName,
  refused: Refused | null,
  shownName?: string | undefined,
): FieldName {
  if (refused == null) return named;
  if (os === 'android' && named.accessibilityLabelledBy != null && refused.nameID != null)
    return { accessibilityLabel: undefined, accessibilityLabelledBy: refused.nameID };

  return {
    accessibilityLabel: withInvalid(named.accessibilityLabel ?? shownName, refused.word),
    accessibilityLabelledBy: undefined,
  };
}

/** A name and the word, as the screen reader says them. */
export function withInvalid(name: string | undefined, word: string): string {
  return name == null || name === '' ? word : `${name}, ${word}`;
}

/** The line first, then any hint the control says of its own. */
export function refusedHint(refused: Refused | null, own: string | undefined): string | undefined {
  const line = refused?.line;
  if (line == null || line === '') return own;

  return own == null || own === '' ? line : `${line} ${own}`;
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
  /** Held, the field is handed its text: on Android only once a key lands, as handing it the text it shows has TalkBack read it again as replaced (sc-23943). */
  handsHeld: boolean;
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
  const repin =
    ((field.held && field.handsHeld) || fontScale !== scale) && field.value === undefined;

  return { pinned: repin ? field.typed : field.pinned, scale: fontScale };
}

export interface Typing {
  typed: string;
  pinned: string | undefined;
  /** The value handed to an Android field until its next key. */
  given: string | undefined;
}

/** On Android a field is handed its value only where that is not what was typed: React Native puts a changed value back over the whole text, and TalkBack reads the whole field again, as a replacement, on every key (sc-18648). */
export function nextGiven(os: string, value: string | undefined, typing: Typing): Typing {
  if (os !== 'android' || value === undefined || value === typing.typed) return typing;

  return { typed: value, pinned: value, given: value };
}

/** A key leaves an Android field uncontrolled again, whatever it was last handed. */
export function keyTyped(last: Typing, text: string): Typing {
  return { ...last, typed: text, given: undefined };
}

/** Whether a held field is handed its text: off Android always, on Android only to undo a key that landed while held. */
export function handsHeld(os: string, strayed: boolean): boolean {
  return os !== 'android' || strayed;
}

/** Whether a key has landed in this hold: one landing marks it, and a release clears it, so the next hold starts unhanded. */
export function nextStrayed(held: boolean, strayed: boolean, keyed: boolean): boolean {
  return held && (strayed || keyed);
}

/** The value TextInput is handed: on Android only one not yet typed, so typing leaves the field uncontrolled. */
export function valueHanded(
  os: string,
  value: string | undefined,
  given: string | undefined,
): string | undefined {
  return os === 'android' ? given : value;
}

/** What a field hands TextInput as its text, held or not. */
export function fieldText(field: FieldText): { value?: string; defaultValue?: string } {
  if (field.value !== undefined) return { value: field.value };
  if (field.held && field.handsHeld) return { value: field.typed };
  const defaultValue = field.pinned ?? field.defaultValue;

  return defaultValue === undefined ? {} : { defaultValue };
}
