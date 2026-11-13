import { callingCode, countryChoices } from '@soirely/domain';
import { type RefObject, useMemo } from 'react';
import { Keyboard, Platform, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { currentLocale } from '../i18n/index.ts';
import { saidInFullMs } from '../kit/readOut.ts';
import { fieldChecked } from './focusedField.ts';
import { ListPicker } from './ListPicker.tsx';
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

/** A refused Country is no text field: the keyboard closes and the screen reader lands on the picker. With `field`, that Field comes wholly into view: on New event that is any refusal the form focuses, a server's as well as a client check's. With `saidFirst`, the words read out with the refusal, TalkBack's focus waits until they are said, as its move would cut them off (sc-43907); returns what cancels the move still to come. */
export function focusPicker(
  picker: RefObject<ViewInstance | null>,
  field?: RefObject<ViewInstance | null>,
  saidFirst?: string,
): () => void {
  Keyboard.dismiss();
  if (field != null) fieldChecked(true, field.current);
  const waitMs = saidFirst == null ? 0 : saidInFullMs(Platform.OS, saidFirst);
  if (waitMs === 0) {
    moveScreenReaderFocus(picker.current);
    return () => {};
  }

  const later = setTimeout(() => moveScreenReaderFocus(picker.current), waitMs);

  return () => clearTimeout(later);
}
