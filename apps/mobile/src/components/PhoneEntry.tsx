import { type Ref, type RefObject, useContext, useEffect, useRef } from 'react';
import { type TextInputInstance, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAccessibilitySizes } from '../layout/useLayout.ts';
import { CountryPicker } from './CountryPicker.tsx';
import { Field, focusChecked, TextField } from './Field.tsx';
import { PhoneCountryRow } from './PhoneCountryRow.tsx';
import { settledFocus, WindowArriving } from './openedFocus.ts';
import { bothRefs, SETTLED_MS } from './Screen.tsx';

/** The code and the number side by side, as Verify phone draws them; the code over the number, each the field's full width, once its name no longer fits beside it on one line and always from the accessibility sizes on (sc-78438, sc-7579). */
export function PhoneEntry({
  label,
  pill,
  help,
  country,
  number,
  error,
  errorOn = 'number',
  submitting,
  opensFocused = false,
  ref,
  pickerRef,
  onCountry,
  onNumber,
  onSubmit,
  testID,
}: {
  label: string;
  pill?: string | undefined;
  help: string;
  country: string;
  number: string;
  error: string | null | undefined;
  /** The control the line names takes the red edge: "Choose a country." is about the code (sc-30447). */
  errorOn?: 'country' | 'number';
  /** A submit runs: the picker is off and the number held. */
  submitting: boolean;
  /** The number takes focus once the screen has settled. */
  opensFocused?: boolean;
  ref?: Ref<TextInputInstance> | undefined;
  pickerRef?: RefObject<ViewInstance | null> | undefined;
  onCountry: (code: string) => void;
  onNumber: (typed: string) => void;
  onSubmit: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const atAccessibilitySizes = useAccessibilitySizes();
  const input = useRef<TextInputInstance>(null);
  const focus = settledFocus(opensFocused, useContext(WindowArriving));

  useEffect(() => {
    if (focus !== 'timer') return undefined;
    const settled = setTimeout(() => focusChecked(input), SETTLED_MS);

    return () => clearTimeout(settled);
  }, [focus]);

  return (
    <Field label={label} pill={pill} error={error} help={help}>
      <PhoneCountryRow
        country={country}
        atAccessibilitySizes={atAccessibilitySizes}
        testID={testID}
        picker={
          <CountryPicker
            label={t('verifyPhone.countryLabel')}
            value={country}
            onChange={onCountry}
            disabled={submitting}
            withCallingCode
            wrong={error != null && errorOn === 'country'}
            pickerRef={pickerRef}
            testID={`${testID}.country`}
          />
        }
        field={
          <TextField
            ref={bothRefs(input, ref)}
            value={number}
            wrong={error != null && errorOn === 'number'}
            submitting={submitting}
            autoFocus={focus === 'arrival'}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            returnKeyType="done"
            onChangeText={onNumber}
            onSubmitEditing={onSubmit}
            submitBehavior="submit"
            accessibilityLabel={label}
            testID={`${testID}.number`}
          />
        }
      />
    </Field>
  );
}
