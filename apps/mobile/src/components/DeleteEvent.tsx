import { type EventDeletion, type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, typedNameMatches } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { deleteEvent, refusedVerb } from '../kit/eventDelete.ts';
import { refusalTitle } from '../kit/refusal.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { Field, focusChecked, focusRefused } from './Field.tsx';
import { BoxField } from './MomentPick.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut, useSendingWords } from './ReadOut.tsx';
import { type ScreenReaderTarget } from './screenReaderFocus.ts';
import { useShellLayout } from './settingsShell.ts';
import { Ask, ASK_WIDTH, FocusedScreen } from './Summary.tsx';
import { Text } from './Text.tsx';

type Asking = { kind: 'plain' } | { kind: 'named' } | { kind: 'refused' };

type Verb = 'callOff' | 'endNow';

/** sc-3592: Delete event from Manage, to a role with Create events; it reads what deleting removes before it asks. With a guest Invited it opens on the refusal instead (sc-14445), whose verb is the page's own Call off or End now. */
export function useDeleteEvent({
  event,
  phase,
  now,
  manages,
  onDeleted,
  onVerb,
  opener,
}: {
  event: OrganisationEvent;
  phase: EventPhase;
  now: Date;
  /** Events at Change: the page shows Call off and End now, so the refusal offers them (sc-3585). */
  manages: boolean;
  onDeleted: (event: OrganisationEvent) => void;
  onVerb: (verb: Verb) => void;
  opener: RefObject<ScreenReaderTarget | null>;
}) {
  const { t } = useTranslation();
  const { organisation } = useSignedIn();
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState<string | null>(null);
  const [deletion, setDeletion] = useState<EventDeletion | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [pending, setPending] = useState(false);
  const [round, setRound] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [named, setNamed] = useState(event.name);

  const open = (name = event.name) => {
    setOpening(true);
    setOpenFailed(null);
    api.eventDeletion(event.id).then(
      (asked) => {
        setOpening(false);
        setFailed(null);
        setDeletion(asked);
        setNamed(name);
        setRound((was) => was + 1);
        setAsking(
          refusedVerb(event, phase, now, asked.deleteRefusedBecause != null) != null
            ? { kind: 'refused' }
            : { kind: asked.needsName ? 'named' : 'plain' },
        );
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
  const deleted = (name: string) => {
    setAsking(null);
    setDeletion(null);
    onDeleted({ ...event, name });
  };

  const raced = () => {
    setFailed(null);
    setAsking({ kind: 'refused' });
  };
  const verb = refusedVerb(event, phase, now, true);

  const plain = async () => {
    if (pending) return;
    setPending(true);
    setFailed(null);
    const answered = await deleteEvent(api, event, false, '');
    setPending(false);
    if (answered.kind === 'deleted') deleted(event.name);
    else if (answered.kind === 'refused') raced();
    else if (answered.kind === 'mismatch') open(answered.current);
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
      {verb != null && (
        <RefusedAsk
          open={asking?.kind === 'refused'}
          verb={verb}
          name={event.name}
          organisation={organisation?.name ?? ''}
          manages={manages}
          opener={opener}
          onKeep={close}
          onVerb={() => {
            setAsking(null);
            onVerb(verb);
          }}
        />
      )}
      {deletion != null && (
        <NamedDelete
          key={round}
          open={asking?.kind === 'named'}
          event={event}
          named={named}
          deletion={deletion}
          pending={pending}
          onPending={setPending}
          opener={opener}
          onCancel={close}
          onDeleted={deleted}
          onRefused={raced}
        />
      )}
    </>
  );

  return { open: () => open(), opening, openFailed, sheet };
}

/** The typed-name question, for an event that has been live or has anybody on its list: its own screen, Delete off until the name matches. */
function NamedDelete({
  open,
  event,
  named,
  deletion,
  pending,
  onPending,
  opener,
  onCancel,
  onDeleted,
  onRefused,
}: {
  open: boolean;
  event: OrganisationEvent;
  named: string;
  deletion: EventDeletion;
  pending: boolean;
  onPending: (pending: boolean) => void;
  opener: RefObject<ScreenReaderTarget | null>;
  onCancel: () => void;
  onDeleted: (name: string) => void;
  /** A guest made Invited since it opened: the screen closes and the refusal shows over the page. */
  onRefused: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(named);
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

    const answered = await deleteEvent(api, { id: event.id, name }, true, typed);
    onPending(false);

    if (answered.kind === 'deleted') {
      onDeleted(name);
      return;
    }
    if (answered.kind === 'refused') {
      onRefused();
      return;
    }
    if (answered.kind === 'failed') {
      setFailed(refusalTitle(answered.error, t('eventDelete.failed')));
      return;
    }
    if (answered.current != null) setName(answered.current);
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
            if (typedNameMatches(value, name)) setLeft(false);
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

/** Before the start, Call off {event} first?; from it, End {event} first?. Without Events at Change, the line saying who can, and Keep it alone. */
function RefusedAsk({
  open,
  verb,
  name,
  organisation,
  manages,
  opener,
  onKeep,
  onVerb,
}: {
  open: boolean;
  verb: Verb;
  name: string;
  organisation: string;
  manages: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onKeep: () => void;
  onVerb: () => void;
}) {
  const { t } = useTranslation();
  const before = verb === 'callOff';
  const ask = { area: t('eventsScreen.title'), organisation };

  return (
    <Ask
      open={open}
      opener={opener}
      width={ASK_WIDTH}
      title={t(before ? 'eventDelete.refusedCallOffTitle' : 'eventDelete.refusedEndTitle', {
        event: name,
      })}
      line={t(before ? 'eventDelete.refusedCallOffBody' : 'eventDelete.refusedEndBody')}
      body={
        manages ? undefined : (
          <Text size={15} weight="medium" style={styles.lines} testID="events.deleteRefusedWho">
            {t(before ? 'eventDelete.refusedAskCallOff' : 'eventDelete.refusedAskEnd', ask)}
          </Text>
        )
      }
      keep={{ label: t('eventDelete.keep'), testID: 'events.deleteRefusedKeep' }}
      confirm={
        manages
          ? {
              label: t(before ? 'eventEnd.callOff' : 'eventEnd.endNow'),
              removes: true,
              testID: 'events.deleteRefusedGo',
            }
          : null
      }
      onKeep={onKeep}
      onConfirm={onVerb}
      testID="events.deleteRefused"
    />
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  title: { letterSpacing: 22 * -0.015, lineHeight: 22 * 1.2 },
  tight: { gap: tokens.spaceHair },
  lines: { lineHeight: 15 * 1.45 },
});
