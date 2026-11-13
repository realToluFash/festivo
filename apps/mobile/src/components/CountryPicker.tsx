import { callingCode, countryChoices } from '@soirely/domain';
import { type RefObject, useMemo } from 'react';
import { Keyboard, Platform, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { currentLocale } from '../i18n/index.ts';
import { saidInFullMs } from '../kit/readOut.ts';
import { fieldChecked, watchMovedOn } from './focusedField.ts';
import { holdFocus } from './heldFocus.ts';
import { ListPicker } from './ListPicker.tsx';
import { SETTLED_MS } from './Screen.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';

export function CountryPicker({
  label,
  value,
  onChange,
  disabled = false,
  withCallingCode = false,
  compact = false,
  wrong = false,
  line,
  pickerRef,
  testID,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  /** For a phone: "+234 Nigeria", and only countries that can be dialled. */
  withCallingCode?: boolean;
  /** Only the flag and the calling code, "🇬🇧 +44", beside a number. */
  compact?: boolean;
  /** A line about it shows under it. */
  wrong?: boolean;
  /** The line about it, where it sits in no Field whose line that is. */
  line?: string | null | undefined;
  /** For moving screen-reader focus here when it is the field refused first. */
  pickerRef?: RefObject<ViewInstance | null> | undefined;
  testID: string;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const choices = useMemo(
    () =>
      countryChoices(locale).flatMap((choice) => {
        if (!withCallingCode) return [choice];
        const code = callingCode(choice.code);

        return code == null ? [] : [{ ...choice, name: `${code} ${choice.name}` }];
      }),
    [locale, withCallingCode],
  );

  return (
    <ListPicker
      label={label}
      searchLabel={t('countryPicker.search')}
      choices={choices}
      value={value}
      onChange={onChange}
      disabled={disabled}
      wrong={wrong}
      line={line}
      shown={compact ? `${flag(value)} ${callingCode(value) ?? ''}`.trim() : undefined}
      pickerRef={pickerRef}
      testID={testID}
    />
  );
}

/** A country's flag, from the regional indicator letters of its code. */
function flag(country: string): string {
  if (!/^[A-Z]{2}$/u.test(country)) return '';

  return String.fromCodePoint(...[...country].map((letter) => 0x1f1a5 + letter.charCodeAt(0)));
}

/** A refused Country is no text field: the keyboard closes and the screen reader lands on the picker. With `field`, that Field comes wholly into view: on New event that is any refusal the form focuses, a server's as well as a client check's, and the screen reader's move waits for the scroll to land. With `saidFirst`, the words read out with the refusal, on Android with a screen reader on the scroll waits until they are said: TalkBack's focus follows the scroll off the button onto whatever it lands on and reads that instead, and its move to the picker drops what was still queued (sc-43907). The move comes as the scroll lands, so TalkBack has no time to rest on what it lands on, or once it has settled when no Screen brings the Field, and is made again over the next second: TalkBack's own follow of the scroll can come after it and take its focus off the picker, and a move onto the picker it already holds says nothing. On iOS the Field scrolls at once and the move waits for both the scroll and the words, as VoiceOver keeps what it queued. A field focused or a control taken meanwhile cancels the scroll and the move, as does what this returns. */
export function focusPicker(
  picker: RefObject<ViewInstance | null>,
  field?: RefObject<ViewInstance | null>,
  saidFirst?: string,
): () => void {
  Keyboard.dismiss();
  if (field == null) {
    moveScreenReaderFocus(picker.current);
    return () => {};
  }

  const saidMs = saidFirst == null ? 0 : saidInFullMs(Platform.OS, saidFirst);
  const watch = watchMovedOn(() => cancel());
  watch.settled();
  let later: ReturnType<typeof setTimeout> | undefined;
  let moved = false;
  const held = holdFocus(() => moveScreenReaderFocus(picker.current), cancel);
  const move = () => {
    if (moved) return;
    cancel();
    moveScreenReaderFocus(picker.current);
  };
  if (Platform.OS !== 'android') {
    fieldChecked(true, field.current);
    later = setTimeout(move, Math.max(SETTLED_MS, saidMs));
    return cancel;
  }

  const scroll = () => {
    later = setTimeout(held.hold, SETTLED_MS);
    fieldChecked(true, field.current, held.hold);
  };
  if (saidMs === 0) scroll();
  else later = setTimeout(scroll, saidMs);
  function cancel(): void {
    moved = true;
    clearTimeout(later);
    held.stop();
    watch.stop();
  }

  return cancel;
}
