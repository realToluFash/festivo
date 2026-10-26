import { type EventDeletion, type OrganisationEvent } from '@soirely/api-client';
import { typedNameMatches } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type DeleteAnswer, deleteEvent } from '../kit/eventDelete.ts';
import { refusalTitle } from '../kit/refusal.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { Field, FieldError, TextField, focusChecked, focusRefused } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { SETTLED_MS } from './Screen.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Sheet } from './Sheet.tsx';
import { Text, type TextHandle } from './Text.tsx';

/** sc-3592: at the foot of the event page, apart from its everyday actions, to a role with Create events. */
export function DeleteEventSection({
  kind,
  event,
  onDeleted,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  onDeleted: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();
  const opener = useRef<View>(null);
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState<string | null>(null);
  const [deletion, setDeletion] = useState<EventDeletion | null>(null);
  const [pending, setPending] = useState(false);

  const open = () => {
    setOpening(true);
    setOpenFailed(null);
    api.eventDeletion(event.id).then(
      (asked) => {
        setOpening(false);
        setDeletion(asked);
      },
      (error: unknown) => {
        setOpening(false);
        setOpenFailed(refusalTitle(error, t('eventDelete.failed')));
      },
    );
  };
  const close = () => !pending && setDeletion(null);

  return (
    <View style={styles.section} testID="events.deleteSection">
      <Text size={tokens.typeButton.size} weight="semibold">
        {t('eventDelete.open')}
      </Text>
      <Text size={tokens.typeSmall.size} muted>
        {t('eventDelete.note')}
      </Text>
      {openFailed != null && <FieldError message={openFailed} />}
      <SecondaryButton
        ref={opener}
        label={t('eventDelete.open')}
        onPress={open}
        off={opening}
        testID="events.delete"
      />
      <Sheet open={deletion != null} onClose={close} opener={opener} testID="events.deleteSheet">
        {deletion != null && (
          <Confirm
            phone={kind === 'phone'}
            event={event}
            deletion={deletion}
            pending={pending}
            onPending={setPending}
            onKeep={close}
            onDeleted={() => {
              setDeletion(null);
              onDeleted(event);
            }}
          />
        )}
      </Sheet>
    </View>
  );
}

function Confirm({
  phone,
  event,
  deletion,
  pending,
  onPending,
  onKeep,
  onDeleted,
}: {
  phone: boolean;
  event: OrganisationEvent;
  deletion: EventDeletion;
  pending: boolean;
  onPending: (pending: boolean) => void;
  onKeep: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const name = event.name;
  const title = useRef<TextHandle>(null);
  const body = useRef<ScrollView>(null);
  const input = useRef<TextInput>(null);
  const typed = useRef('');
  const typing = useRef(false);
  const fieldShownByRefusal = useRef(false);
  const [needsName, setNeedsName] = useState(deletion.needsName);
  const [answer, setAnswer] = useState<Exclude<DeleteAnswer, { kind: 'deleted' }> | null>(null);
  const mismatch = answer?.kind === 'mismatch' ? t('eventDelete.mismatch', { event: name }) : null;
  const failed =
    answer?.kind === 'failed' ? refusalTitle(answer.error, t('eventDelete.failed')) : null;

  useEffect(() => {
    const focus = setTimeout(() => moveScreenReaderFocus(title.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, []);

  useEffect(() => {
    if (!needsName || !fieldShownByRefusal.current) return;
    fieldShownByRefusal.current = false;
    focusRefused(input);
  }, [needsName]);

  const fieldInSight = () => {
    if (typing.current) body.current?.scrollToEnd({ animated: true });
  };

  async function submit(): Promise<void> {
    if (pending) return;

    const sends = !needsName || typedNameMatches(typed.current, name);
    if (sends) {
      onPending(true);
      setAnswer(null);
    }

    const answered = await deleteEvent(api, event, needsName, typed.current);
    onPending(false);

    if (answered.kind === 'deleted') {
      onDeleted();
      return;
    }

    setAnswer(answered);
    if (answered.kind === 'mismatch') {
      if (!needsName) {
        fieldShownByRefusal.current = true;
        setNeedsName(true);
      } else if (sends) focusRefused(input);
      else focusChecked(input);
    }
  }

  const keep = (
    <SecondaryButton
      label={t('eventDelete.keep')}
      onPress={onKeep}
      off={pending}
      stacked={phone}
      testID="events.deleteKeep"
    />
  );
  const go = (
    <PrimaryButton
      label={t('eventDelete.delete')}
      onPress={() => void submit()}
      busy={pending}
      testID="events.deleteGo"
    />
  );

  return (
    <>
      <ScrollView
        ref={body}
        style={styles.body}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onLayout={fieldInSight}
        onContentSizeChange={fieldInSight}
      >
        <Text
          ref={title}
          size={tokens.typeTitleSection.size}
          weight="bold"
          accessibilityRole="header"
        >
          {t('eventDelete.title', { event: name })}
        </Text>
        {needsName ? (
          <>
            <View style={styles.list}>
              <Text size={tokens.typeBodyPhone.size}>{t('eventDelete.removes')}</Text>
              <View style={styles.item}>
                <Text
                  size={tokens.typeBodyPhone.size}
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  •
                </Text>
                <Text size={tokens.typeBodyPhone.size} style={styles.itemWords}>
                  {t('eventDelete.removesEvent')}
                </Text>
              </View>
            </View>
            <Text size={tokens.typeBodyPhone.size} muted>
              {t('eventDelete.guests')}
            </Text>
            <Text size={tokens.typeBodyPhone.size} muted>
              {t('eventDelete.window', { deadline: deletion.restoreCloses })}
            </Text>
            <Field
              label={t('eventDelete.type', { event: name })}
              error={mismatch}
              help={t('eventDelete.typeHint')}
            >
              <TextField
                ref={input}
                accessibilityLabel={t('eventDelete.type', { event: name })}
                wrong={mismatch != null}
                submitting={pending}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
                onFocus={() => {
                  typing.current = true;
                  fieldInSight();
                }}
                onBlur={() => {
                  typing.current = false;
                }}
                onChangeText={(value) => {
                  typed.current = value;
                  if (answer?.kind === 'mismatch' && typedNameMatches(value, name)) setAnswer(null);
                }}
                testID="events.deleteName"
              />
            </Field>
          </>
        ) : (
          <Text size={tokens.typeBodyPhone.size} muted>
            {t('eventDelete.draftBody')}
          </Text>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {failed != null && (
          <ReadOut words={failed} interrupts accessibilityRole="alert">
            <Notice tone="broken" mark={tokens.marks.broken.glyph} body={failed} />
          </ReadOut>
        )}
        {phone ? (
          <View style={styles.stacked}>
            {go}
            {keep}
          </View>
        ) : (
          <View style={styles.actions}>
            {keep}
            {go}
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: tokens.spaceSm,
    marginTop: tokens.spaceLg,
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  body: { flexShrink: 1 },
  content: {
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.space3xl,
    paddingBottom: tokens.spaceLg,
  },
  list: { gap: tokens.spaceXs },
  item: { flexDirection: 'row', gap: tokens.spaceSm },
  itemWords: { flex: 1 },
  footer: {
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.spaceSm,
    paddingBottom: tokens.space3xl,
  },
  stacked: { gap: tokens.spaceSm },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spaceMd,
  },
});
