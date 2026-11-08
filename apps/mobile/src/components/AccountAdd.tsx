import { phoneLengthProblem, refusedPhoneField } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import type { TextInputInstance, ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { type ContactKind, KIND_KEYS } from '../kit/accountPage.ts';
import { emailMessage } from '../kit/formChecks.ts';
import { phoneProblemMessage } from '../phoneProblem.ts';
import { discardAsk } from './AccountName.tsx';
import { focusPicker } from './CountryPicker.tsx';
import { Field, focusChecked, focusRefused, keysStayDown, TextField } from './Field.tsx';
import { PhoneEntry } from './PhoneEntry.tsx';
import { SETTLED_MS } from './Screen.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { FocusedScreen } from './Summary.tsx';

/** What is added: the address, or the country and the number as typed. */
export interface Adding {
  typed: string;
  country: string;
}

/** Adding an address or a number; it joins unverified. `onAdd` resolves to why it was refused, or null once added. */
export function AddScreen({
  kind,
  open,
  startCountry,
  opener,
  onClose,
  onAdd,
}: {
  kind: ContactKind;
  open: boolean;
  startCountry: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onAdd: (adding: Adding) => Promise<string | null>;
}) {
  const { t } = useTranslation();
  const keys = KIND_KEYS[kind];
  const email = kind === 'email';
  const typed = useRef('');
  const field = useRef<TextInputInstance>(null);
  const picker = useRef<ViewInstance>(null);
  const [country, setCountry] = useState(startCountry);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorOn, setErrorOn] = useState<'country' | 'number'>('number');
  const [discarding, setDiscarding] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || email) return;
    const focus = setTimeout(() => focusChecked(field), SETTLED_MS);

    return () => clearTimeout(focus);
  }, [open, email]);

  function typing(text: string): void {
    typed.current = text;
    setChanged(text.trim() !== '');
    if (error != null) setError(null);
  }

  function check(): string | null {
    if (email) return emailMessage(typed.current, t);

    return phoneProblemMessage(phoneLengthProblem(typed.current, country), country, t);
  }

  async function add(): Promise<void> {
    if (sending) return;
    const checked = check();
    if (checked != null) {
      const on = email
        ? 'number'
        : (refusedPhoneField(phoneLengthProblem(typed.current, country)) ?? 'number');
      setError(checked);
      setErrorOn(on);
      if (on === 'country') focusPicker(picker);
      else focusChecked(field);
      return;
    }
    keysStayDown();
    setSending(true);
    const refused = await onAdd({ typed: typed.current.trim(), country });
    setSending(false);
    if (refused == null) return;
    setError(refused);
    setErrorOn('number');
    focusRefused(field);
  }

  return (
    <FocusedScreen
      open={open}
      title={t(keys.add)}
      verb={{
        label: t('account.add'),
        on: true,
        busy: sending,
        onPress: () => void add(),
        testID: `account.${kind}.add.submit`,
      }}
      waits={sending}
      onCancel={() => (changed ? setDiscarding(true) : onClose())}
      cancelTestID={`account.${kind}.add.cancel`}
      opener={opener}
      ask={discardAsk(
        discarding,
        t('account.nothingAdded'),
        { keep: () => setDiscarding(false), discard: onClose },
        `account.${kind}.add`,
        t,
      )}
      testID={`account.${kind}.add.screen`}
    >
      {email ? (
        <Field label={t(keys.label)} error={error} help={t(keys.help)}>
          <TextField
            ref={field}
            wrong={error != null}
            submitting={sending}
            autoFocus
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onChangeText={typing}
            onSubmitEditing={() => void add()}
            submitBehavior="submit"
            accessibilityLabel={t(keys.label)}
            testID="account.email.add.field"
          />
        </Field>
      ) : (
        <PhoneEntry
          ref={field}
          label={t(keys.label)}
          help={t(keys.help)}
          country={country}
          error={error}
          errorOn={errorOn}
          submitting={sending}
          pickerRef={picker}
          onCountry={(code) => {
            setCountry(code);
            setError(null);
          }}
          onNumber={typing}
          onSubmit={() => void add()}
          testID="account.phone.add"
        />
      )}
    </FocusedScreen>
  );
}
