import { type EventDeletion, type OrganisationEvent } from '@soirely/api-client';
import { typedNameMatches } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { deleteEvent } from '../kit/eventDelete.ts';
import { refusalTitle } from '../kit/refusal.ts';
import { tokens } from '../theme/tokens.ts';
import { Field, focusChecked, focusRefused } from './Field.tsx';
import { BoxField } from './MomentPick.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut, useSendingWords } from './ReadOut.tsx';
import { type ScreenReaderTarget } from './screenReaderFocus.ts';
import { useShellLayout } from './settingsShell.ts';
import { Ask, ASK_WIDTH, FocusedScreen } from './Summary.tsx';
import { Text } from './Text.tsx';

type Asking = { kind: 'plain' } | { kind: 'named' };

/** sc-3592: Delete event from Manage, to a role with Create events; it reads what deleting removes before it asks. */
export function useDeleteEvent({
  event,
  onDeleted,
  opener,
}: {
  event: OrganisationEvent;
  onDeleted: (event: OrganisationEvent) => void;
  opener: RefObject<ScreenReaderTarget | null>;
}) {
  const { t } = useTranslation();
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState<string | null>(null);
  const [deletion, setDeletion] = useState<EventDeletion | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [pending, setPending] = useState(false);
  const [round, setRound] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  const open = () => {
    setOpening(true);
    setOpenFailed(null);
    api.eventDeletion(event.id).then(
      (asked) => {
        setOpening(false);
        setFailed(null);
        setDeletion(asked);
        setRound((was) => was + 1);
        setAsking({ kind: asked.needsName ? 'named' : 'plain' });
      },
      (error: unknown) => {
        setOpening(false);
        setOpenFailed(refusalTitle(error, t('eventDelete.failed')));
      },
    );
  };
  const close = () => {
    if (pending) return;
    setAsking(null);
  };
  const deleted = () => {
    setAsking(null);
    setDeletion(null);
    onDeleted(event);
  };

  const plain = async () => {
    if (pending) return;
    setPending(true);
    setFailed(null);
    const answered = await deleteEvent(api, event, false, '');
    setPending(false);
    if (answered.kind === 'deleted') deleted();
    else if (answered.kind === 'mismatch') open();
    else setFailed(refusalTitle(answered.error, t('eventDelete.failed')));
  };

  const sheet = (
    <>
      <Ask
        open={asking?.kind === 'plain'}
        opener={opener}
        width={ASK_WIDTH}
        title={t('eventDelete.title', { event: event.name })}
        line={t('eventDelete.draftBody')}
        keep={{ label: t('eventDelete.keep'), off: pending, testID: 'events.deleteKeep' }}
        confirm={{
          label: t('eventDelete.delete'),
          removes: true,
          busy: pending ? t('eventDelete.deleting') : undefined,
          testID: 'events.deleteGo',
        }}
        failed={failed}
        onKeep={close}
        onConfirm={() => void plain()}
        testID="events.deleteSheet"
      />
      {deletion != null && (
        <NamedDelete
          key={round}
          open={asking?.kind === 'named'}
          event={event}
          deletion={deletion}
          pending={pending}
          onPending={setPending}
          opener={opener}
          onCancel={close}
          onDeleted={deleted}
        />
      )}
    </>
  );

  return { open, opening, openFailed, sheet };
}

/** The typed-name question, for an event that has been live or has anybody on its list: its own screen, Delete off until the name matches. */
function NamedDelete({
  open,
  event,
  deletion,
  pending,
  onPending,
  opener,
  onCancel,
  onDeleted,
}: {
  open: boolean;
  event: OrganisationEvent;
  deletion: EventDeletion;
  pending: boolean;
  onPending: (pending: boolean) => void;
  opener: RefObject<ScreenReaderTarget | null>;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const name = event.name;
  useSendingWords(pending ? t('eventDelete.deleting') : undefined);
  const input = useRef<TextInputInstance>(null);
  const [typed, setTyped] = useState('');
  const [left, setLeft] = useState(false);
  const [refused, setRefused] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const matches = typedNameMatches(typed, name);
  const mismatch = refused || (left && typed !== '' && !matches);
  const gap = useShellLayout() === 'phone' ? tokens.spaceXl : tokens.spaceLg;

  async function submit(): Promise<void> {
    if (pending) return;

    const sends = matches;
    if (sends) {
      onPending(true);
      setRefused(false);
      setFailed(null);
    }

    const answered = await deleteEvent(api, event, true, typed);
    onPending(false);

    if (answered.kind === 'deleted') {
      onDeleted();
      return;
    }
    if (answered.kind === 'failed') {
      setFailed(refusalTitle(answered.error, t('eventDelete.failed')));
      return;
    }
    setLeft(true);
    setRefused(sends);
    if (sends) focusRefused(input);
    else focusChecked(input);
  }

  return (
    <FocusedScreen
      gap={gap}
      open={open}
      title={t('eventDelete.screen')}
      verb={{
        label: pending ? t('eventDelete.deleting') : t('eventDelete.delete'),
        on: matches && !pending,
        onPress: () => void submit(),
        removes: true,
        busy: pending,
        testID: 'events.deleteGo',
      }}
      waits={pending}
      onCancel={onCancel}
      cancelTestID="events.deleteKeep"
      opener={opener}
      testID="events.deleteSheet"
    >
      <Text size={22} weight="bold" accessibilityRole="header" style={styles.title}>
        {t('eventDelete.title', { event: name })}
      </Text>
      <View style={styles.tight}>
        <Text size={15} weight="semibold" style={styles.lines}>
          {t('eventDelete.removes')}
        </Text>
        <Text size={15} weight="medium" style={styles.lines}>
          {`• ${t('eventDelete.removesEvent')}`}
        </Text>
        {deletion.people > 0 && (
          <Text size={15} weight="medium" style={styles.lines} testID="event.delete.guests">
            {`• ${t('eventDelete.removesGuests', { count: deletion.people })}`}
          </Text>
        )}
      </View>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {t('eventDelete.guests')}
      </Text>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {t('eventDelete.window', { deadline: deletion.restoreCloses })}
      </Text>
      <Field
        label={t('eventDelete.type', { event: name })}
        error={mismatch ? t('eventDelete.mismatch', { event: name }) : null}
        help={mismatch ? undefined : t('eventDelete.typeHint')}
      >
        <BoxField
          ref={input}
          value={typed}
          wrong={mismatch}
          submitting={pending}
          autoFocus
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          onChangeText={(value) => {
            setTyped(value);
            setRefused(false);
          }}
          onBlur={() => setLeft(true)}
          accessibilityLabel={t('eventDelete.type', { event: name })}
          testID="events.deleteName"
        />
      </Field>
      {failed != null && (
        <ReadOut words={failed} interrupts accessibilityRole="alert">
          <Notice tone="broken" mark={tokens.marks.broken.glyph} body={failed} />
        </ReadOut>
      )}
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  title: { letterSpacing: 22 * -0.015, lineHeight: 22 * 1.2 },
  tight: { gap: tokens.spaceHair },
  lines: { lineHeight: 15 * 1.45 },
});
