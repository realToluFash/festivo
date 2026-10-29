import { callingCode, countryChoices } from '@soirely/domain';
import { type Ref, type RefObject, useMemo } from 'react';
import { Keyboard, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { currentLocale } from '../i18n/index.ts';
import { ListPicker } from './ListPicker.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';

export function CountryPicker({
  label,
  value,
  onChange,
  disabled = false,
  withCallingCode = false,
  pickerRef,
  testID,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  /** For a phone: "+234 Nigeria", and only countries that can be dialled. */
  withCallingCode?: boolean;
  /** For moving screen-reader focus here when it is the field refused first. */
  pickerRef?: Ref<ViewInstance> | undefined;
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
      pickerRef={pickerRef}
      testID={testID}
    />
  );
}

/** A refused Country is no text field: the keyboard closes and the screen reader lands on the picker. */
export function focusPicker(picker: RefObject<ViewInstance | null>): void {
  Keyboard.dismiss();
  moveScreenReaderFocus(picker.current);
}
