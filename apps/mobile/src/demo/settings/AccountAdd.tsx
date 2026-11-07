import { type RefObject, useEffect, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import { Field, focusChecked, focusRefused, TextField } from '../../components/Field.tsx';
import { PhoneEntry } from '../../components/PhoneEntry.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { addCheck, addRefusal, type ContactKind, KIND_WORDS, WORDS } from './AccountModel.ts';
import { discardAsk } from './AccountName.tsx';
import { type Contact, PHONE_COUNTRY, phoneShown } from './AccountSample.ts';
import { FocusedScreen } from './Summary.tsx';

/** Adding an address or a number; it joins unverified, and only the account's own rows are known to be linked. */
export function AddScreen({
  kind,
  open,
  rows,
  opener,
  onClose,
  onAdded,
}: {
  kind: ContactKind;
  open: boolean;
  rows: readonly Contact[];
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onAdded: (row: Contact) => void;
}) {
  const words = KIND_WORDS[kind];
  const email = kind === 'email';
  const typed = useRef('');
  const field = useRef<TextInputInstance>(null);
  const [country, setCountry] = useState(PHONE_COUNTRY);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);

  useEffect(() => {
    if (!open || email) return;
    const focus = setTimeout(() => field.current?.focus(), SETTLED_MS);

    return () => clearTimeout(focus);
  }, [open, email]);

  function typing(text: string): void {
    typed.current = text;
    setChanged(text.trim() !== '');
    if (error != null) setError(null);
  }

  function add(): void {
    const checked = addCheck(kind, typed.current, country);
    if (checked != null) {
      setError(checked);
      focusChecked(field);
      return;
    }
    const shown = email ? typed.current.trim() : phoneShown(country, typed.current);
    const refused = addRefusal(kind, shown, rows);
    if (refused != null) {
      setError(refused);
      focusRefused(field);
      return;
    }
    onAdded({ id: `${kind}-${shown}`, shown, verified: false, primary: false });
  }

  return (
    <FocusedScreen
      open={open}
      title={words.addTitle}
      verb={{ label: WORDS.add, on: true, onPress: add, testID: `account.${kind}.add.submit` }}
      onCancel={() => (changed ? setDiscarding(true) : onClose())}
      cancelTestID={`account.${kind}.add.cancel`}
      opener={opener}
      ask={discardAsk(
        discarding,
        WORDS.nothingAdded,
        { keep: () => setDiscarding(false), discard: onClose },
        `account.${kind}.add`,
      )}
      testID={`account.${kind}.add.screen`}
    >
      {email ? (
        <Field label={words.label} error={error} help={words.help}>
          <TextField
            ref={field}
            wrong={error != null}
            autoFocus
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onChangeText={typing}
            onSubmitEditing={add}
            submitBehavior="submit"
            accessibilityLabel={words.label}
            testID="account.email.add.field"
          />
        </Field>
      ) : (
        <PhoneEntry
          ref={field}
          label={words.label}
          help={words.help}
          country={country}
          error={error}
          submitting={false}
          onCountry={(code) => {
            setCountry(code);
            setError(null);
          }}
          onNumber={typing}
          onSubmit={add}
          testID="account.phone.add"
        />
      )}
    </FocusedScreen>
  );
}
