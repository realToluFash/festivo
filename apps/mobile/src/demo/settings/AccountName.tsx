import { ACCOUNT_NAME_MAXIMUM, nameToSave } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import { Field, focusChecked, TextField } from '../../components/Field.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { nameStays, WORDS } from './AccountModel.ts';
import { type AskProps, FocusedScreen } from '../../components/Summary.tsx';

/** Cancel after a change: what stays, Keep editing first and Discard in red. */
export function discardAsk(
  asking: boolean,
  line: string,
  on: { keep: () => void; discard: () => void },
  testID: string,
): AskProps | null {
  if (!asking) return null;

  return {
    title: WORDS.discardTitle,
    line,
    keep: { label: WORDS.keepEditing, testID: `${testID}.keep` },
    confirm: { label: WORDS.discard, testID: `${testID}.discard`, removes: true },
    onKeep: on.keep,
    onConfirm: on.discard,
  };
}

export function NameScreen({
  open,
  held,
  opener,
  onClose,
  onSaved,
}: {
  open: boolean;
  held: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const typed = useRef(held);
  const field = useRef<TextInputInstance>(null);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);

  function save(): void {
    const next = nameToSave(typed.current, held);
    if (next.kind === 'blank') {
      setError(WORDS.nameBlank);
      focusChecked(field);
      return;
    }
    if (next.kind === 'changed') onSaved(next.name);
    else onClose();
  }

  return (
    <FocusedScreen
      open={open}
      title={WORDS.nameTitle}
      verb={{ label: WORDS.save, on: changed, onPress: save, testID: 'account.name.save' }}
      onCancel={() => (changed ? setDiscarding(true) : onClose())}
      cancelTestID="account.name.cancel"
      opener={opener}
      ask={discardAsk(
        discarding,
        nameStays(held),
        { keep: () => setDiscarding(false), discard: onClose },
        'account.name',
      )}
      testID="account.name.screen"
    >
      <Field label={WORDS.nameLabel} error={error}>
        <TextField
          ref={field}
          defaultValue={held}
          wrong={error != null}
          autoFocus
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          autoCorrect={false}
          spellCheck={false}
          maxLength={ACCOUNT_NAME_MAXIMUM}
          returnKeyType="done"
          onChangeText={(text) => {
            typed.current = text;
            setChanged(nameToSave(text, held).kind !== 'unchanged');
            if (error != null && text.trim() !== '') setError(null);
          }}
          onSubmitEditing={save}
          submitBehavior="submit"
          accessibilityLabel={WORDS.nameLabel}
          testID="account.name.field"
        />
      </Field>
    </FocusedScreen>
  );
}
