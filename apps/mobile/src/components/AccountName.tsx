import { ACCOUNT_NAME_MAXIMUM, nameToSave } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type RefObject, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Field, focusChecked, focusRefused, keysStayDown, TextField } from './Field.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { type AskProps, FocusedScreen } from './Summary.tsx';

/** Cancel after a change: what stays, Keep editing first and Discard in red. */
export function discardAsk(
  asking: boolean,
  line: string,
  on: { keep: () => void; discard: () => void },
  testID: string,
  t: TFunction,
): AskProps | null {
  if (!asking) return null;

  return {
    title: t('account.discardTitle'),
    line,
    keep: { label: t('account.keepEditing'), testID: `${testID}.keep` },
    confirm: { label: t('account.discard'), testID: `${testID}.discard`, removes: true },
    onKeep: on.keep,
    onConfirm: on.discard,
  };
}

/** Saves the name; resolves to why it was not saved, or null once it is. */
export type Saving<T> = (value: T) => Promise<string | null>;

export function NameScreen({
  open,
  held,
  opener,
  onClose,
  onSave,
}: {
  open: boolean;
  held: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onSave: Saving<string>;
}) {
  const { t } = useTranslation();
  const typed = useRef(held);
  const field = useRef<TextInputInstance>(null);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    if (saving) return;
    const next = nameToSave(typed.current, held);
    if (next.kind === 'blank') {
      setError(t('nameCard.blank'));
      focusChecked(field);
      return;
    }
    if (next.kind !== 'changed') {
      onClose();
      return;
    }
    keysStayDown();
    setSaving(true);
    const refused = await onSave(next.name);
    setSaving(false);
    if (refused == null) return;
    setError(refused);
    focusRefused(field);
  }

  return (
    <FocusedScreen
      open={open}
      title={t('nameCard.title')}
      verb={{
        label: t('account.save'),
        on: changed,
        busy: saving,
        onPress: () => void save(),
        testID: 'account.name.save',
      }}
      waits={saving}
      onCancel={() => (changed ? setDiscarding(true) : onClose())}
      cancelTestID="account.name.cancel"
      opener={opener}
      ask={discardAsk(
        discarding,
        t('account.nameStays', { name: held }),
        { keep: () => setDiscarding(false), discard: onClose },
        'account.name',
        t,
      )}
      testID="account.name.screen"
    >
      <Field label={t('account.fullName')} error={error}>
        <TextField
          ref={field}
          defaultValue={held}
          wrong={error != null}
          submitting={saving}
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
          onSubmitEditing={() => void save()}
          submitBehavior="submit"
          accessibilityLabel={t('account.fullName')}
          testID="account.name.field"
        />
      </Field>
    </FocusedScreen>
  );
}
