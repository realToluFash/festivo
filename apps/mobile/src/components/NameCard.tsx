import { ApiError } from '@soirely/api-client';
import { ACCOUNT_NAME_MAXIMUM, nameToSave } from '@soirely/domain';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { focusBackMs } from '../kit/focusBack.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { Field, focusChecked, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import {
  SETTLED_MS,
  type StepClosed,
  type StepHidden,
  useAboveKeyboard,
  useFocusBackToOpener,
  useScrolledToTop,
  useStepClose,
  useStepOpen,
} from './Screen.tsx';
import { Text } from './Text.tsx';

/** Your account > Account, the person's own name, in the Time zone card's pattern (sc-22741). */
export function NameCard({
  name,
  kind,
  onSaved,
}: {
  name: string;
  kind: LayoutKind;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [savedFocused, setSavedFocused] = useState(false);
  const [closed, setClosed] = useState<StepClosed | undefined>(undefined);
  const opener = useFocusBackToOpener(editing ? undefined : closed);
  const {
    opener: changeOpener,
    closing,
    closer,
    hidden,
    close,
  } = useStepClose(opener, 'change', 'opener', (back) => {
    setClosed(back);
    setEditing(false);
  });
  const {
    opener: savedLine,
    holder: savedHolder,
    closing: savedClosing,
    closer: saveCloser,
    hidden: savedHidden,
    fieldHidden,
    close: closeSaved,
  } = useStepClose(opener, 'saved', 'holder', (back) => {
    setSavedFocused(back == null);
    setEditing(false);
  });
  const savedGiven = savedFocused || savedClosing;
  const changeShown = useRef<ViewInstance | null>(null);
  const change = useCallback(
    (view: ViewInstance | null) => {
      changeOpener(view);
      changeShown.current = view;
    },
    [changeOpener],
  );
  const { opening, open, fieldShown, fieldFocused, stop } = useStepOpen(
    () => {
      setClosed(undefined);
      setEditing(true);
    },
    () => {
      setSaved(null);
      setSavedFocused(false);
    },
  );
  const frame = cardFrame(kind);
  const offWhileSaving = savedClosing ? 'no-hide-descendants' : 'auto';

  return (
    <View style={frame}>
      <Text
        size={tokens.typeTitleSection.size}
        weight="bold"
        accessibilityRole="header"
        accessibilityElementsHidden={savedClosing}
        importantForAccessibility={offWhileSaving}
        accessible={savedClosing ? false : undefined}
      >
        {t('nameCard.title')}
      </Text>

      {(!editing || opening || closing || savedClosing) && (
        <View {...savedHidden}>
          <Text
            size={tokens.typeRowTitle.size}
            weight="semibold"
            accessible={savedClosing ? false : undefined}
          >
            {name}
          </Text>
        </View>
      )}
      {saved != null && (!editing || opening || savedClosing) && (
        <View style={editing && !savedClosing ? styles.gone : undefined}>
          {savedHolder}
          {(!editing || savedClosing) && (
            <Notice
              tone="done"
              mark={tokens.marks.done.glyph}
              body={t('nameCard.saved', { name: saved })}
              answer={savedGiven ? undefined : saved}
              takesFocus={!savedGiven}
              readMs={focusBackMs(Platform.OS, SETTLED_MS, 'step')}
              wordsRef={savedGiven ? savedLine : undefined}
            />
          )}
        </View>
      )}
      {(!editing || opening || closing) && (
        <SecondaryButton
          ref={change}
          label={t('nameCard.change')}
          onPress={open}
          testID="nameCard.change"
        />
      )}
      {editing && (
        <Editing
          name={name}
          closing={closing || savedClosing}
          onSaved={async (now, fromKeys) => {
            await onSaved();
            stop();
            setSaved(now);
            closeSaved(fromKeys);
          }}
          onCancel={() => {
            stop();
            close();
          }}
          opener={opening ? changeShown : null}
          onShown={fieldShown}
          onFocused={fieldFocused}
          closer={closer}
          saveCloser={saveCloser}
          hidden={hidden}
          fieldHidden={fieldHidden}
        />
      )}
    </View>
  );
}

/** The name as it is, to correct; the same name again closes with nothing sent. */
function Editing({
  name,
  closing,
  onSaved,
  onCancel,
  opener,
  onShown,
  onFocused,
  closer,
  saveCloser,
  hidden,
  fieldHidden,
}: {
  name: string;
  closing: boolean;
  onSaved: (now: string, fromKeys: boolean) => Promise<void>;
  onCancel: () => void;
  /** Change, while it shows above the step as the step opens. */
  opener: RefObject<ViewInstance | null> | null;
  onShown: (field: TextInputInstance | null) => void;
  onFocused: () => void;
  closer: RefObject<ViewInstance | null>;
  saveCloser: RefObject<ViewInstance | null>;
  /** Hides all but Cancel while Cancel closes the step. */
  hidden: StepHidden;
  /** Hides the field while Save, not the keys, closes the step. */
  fieldHidden: StepHidden;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<TextInputInstance>(null);
  const aboveKeyboard = useAboveKeyboard(closing);
  const top = useScrolledToTop(opener);
  useEffect(() => onShown(input.current), [onShown]);

  async function save(keys: boolean): Promise<void> {
    if (saving) return;

    const checked = nameToSave(typed, name);
    if (checked.kind === 'blank') {
      setError(t('nameCard.blank'));
      focusChecked(input);
      return;
    }

    if (checked.kind === 'unchanged') {
      onCancel();
      return;
    }

    const now = checked.name;

    setSaving(true);

    try {
      await api.setName(now);
      await onSaved(now, keys);
    } catch (refusal) {
      setSaving(false);
      setError(
        refusal instanceof ApiError && refusal.status === 422
          ? (refusal.problem.detail ?? t('nameCard.failed'))
          : t('nameCard.failed'),
      );
    }
  }

  return (
    <>
      <View {...aboveKeyboard} {...hidden}>
        <View ref={top} style={styles.editing}>
          <View {...fieldHidden}>
            <Field label={t('completeProfile.name')} error={error}>
              <TextField
                ref={input}
                wrong={error != null}
                submitting={saving}
                autoFocus={opener == null}
                onFocus={onFocused}
                value={typed}
                onChangeText={(text) => {
                  setTyped(text);
                  setError(null);
                }}
                autoComplete="name"
                textContentType="name"
                autoCapitalize="words"
                maxLength={ACCOUNT_NAME_MAXIMUM}
                returnKeyType="done"
                onSubmitEditing={() => void save(true)}
                submitBehavior="submit"
                accessibilityLabel={t('completeProfile.name')}
                testID="nameCard.field"
              />
            </Field>
          </View>

          <PrimaryButton
            label={saving ? t('nameCard.saving') : t('nameCard.save')}
            onPress={() => void save(false)}
            busy={saving}
            ref={saveCloser}
            testID="nameCard.save"
          />
        </View>
      </View>
      <QuietButton
        label={t('nameCard.cancel')}
        ref={closer}
        onPress={onCancel}
        off={saving}
        testID="nameCard.cancel"
      />
    </>
  );
}

const styles = StyleSheet.create({
  gone: { position: 'absolute' },
  editing: { gap: tokens.spaceLg },
});
