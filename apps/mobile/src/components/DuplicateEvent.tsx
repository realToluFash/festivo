import type { OrganisationEvent } from '@soirely/api-client';
import { copyEndsLine, roleHolds } from '@soirely/domain';
import { Redirect, router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { duplicateEvent } from '../kit/eventDuplicate.ts';
import { type Opened, openedOf } from '../kit/eventsOpen.ts';
import { goUpToEvent } from '../kit/upToEvent.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { focusPicker } from './CountryPicker.tsx';
import { InSight, Moment } from './EventForm.tsx';
import { FormFrame, formGap } from './EventFormScreen.tsx';
import { EventState } from './Events.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { useSystemBack } from './useSystemBack.ts';
import { Arrived, Skeleton } from './Skeleton.tsx';

const OPENING_AFTER = 700;

const COPIED = [
  'copiedName',
  'copiedType',
  'copiedVenue',
  'copiedCover',
  'copiedTimeZone',
  'copiedCurrency',
  'copiedLength',
] as const;

const NOT_COPIED = [
  'notCopiedHosts',
  'notCopiedGuests',
  'notCopiedReplies',
  'notCopiedHappened',
] as const;

/** An event's page > Duplicate, `AppDuplicate` (sc-22145): the web's Duplicate (sc-3593) as a screen of its own. */
export function DuplicateEventScreen({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const creates = organisation != null && roleHolds(organisation, 'events.create');
  const navigation = useNavigation();
  const [held, setHeld] = useState<Opened>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const toOriginal = useCallback(
    () => goUpToEvent(navigation, router, eventId),
    [navigation, eventId],
  );

  useEffect(() => {
    if (organisationId == null || !creates) return;
    let live = true;

    api.event(eventId).then(
      (event) => live && setHeld(openedOf({ event }, organisationId)),
      (error: unknown) => live && setHeld(openedOf({ error }, organisationId)),
    );

    return () => {
      live = false;
    };
  }, [eventId, organisationId, creates, attempt]);

  if (organisation != null && !creates)
    return <Redirect href={`/events/${encodeURIComponent(eventId)}`} />;

  const name = held.kind === 'loaded' ? held.event.name : null;

  return (
    <FormFrame
      kind={kind}
      title={name == null ? t('eventDuplicate.open') : t('eventDuplicate.title', { event: name })}
      shortTitle={t('eventDuplicate.open')}
      onCancel={toOriginal}
      cancelOff={busy}
    >
      {held.kind === 'loading' && (
        <Skeleton
          words={t('eventsScreen.loadingEvent')}
          shape="cards"
          cards={[
            { lines: 0, fields: 2 },
            { lines: 0, fields: 2 },
            { lines: 1, options: 1 },
          ]}
        />
      )}
      {held.kind === 'failed' && (
        <View style={styles.stack} accessibilityRole="alert">
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            body={t('eventsScreen.failedLoad')}
            announce
          />
          <SecondaryButton
            label={t('eventsScreen.retry')}
            onPress={() => {
              setHeld({ kind: 'loading' });
              setAttempt((n) => n + 1);
            }}
            testID="eventDuplicate.retry"
          />
        </View>
      )}
      {held.kind === 'notFound' && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          title={t('eventsScreen.notFound')}
          heading
        />
      )}
      {held.kind === 'loaded' && (
        <Arrived style={formGap(kind)}>
          <DuplicateForm kind={kind} event={held.event} onBusy={setBusy} />
        </Arrived>
      )}
    </FormFrame>
  );
}

function DuplicateForm({
  kind,
  event,
  onBusy,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'editing' | 'creating' | 'failed' | 'created'>('editing');
  const [landing, setLanding] = useState<`/events/${string}` | null>(null);
  const [focusOn, setFocusOn] = useState<{ half: 'date' | 'time' } | null>(null);
  const datePicker = useRef<ViewInstance>(null);
  const timePicker = useRef<ViewInstance>(null);
  const startField = useRef<ViewInstance>(null);
  const busy = status === 'creating' || status === 'created';
  const phone = kind === 'phone';
  const endsLine = copyEndsLine(date, time, event, locale, t);

  useSystemBack(busy, () => {});

  useEffect(() => onBusy(busy), [busy, onBusy]);

  useEffect(() => {
    if (focusOn == null) return;
    focusPicker(focusOn.half === 'date' ? datePicker : timePicker, startField);
  }, [focusOn]);

  useEffect(() => {
    if (landing == null) return;
    const id = setTimeout(() => router.replace(landing), OPENING_AFTER);

    return () => clearTimeout(id);
  }, [landing]);

  async function create(): Promise<void> {
    if (busy) return;

    if (date !== '' && time !== '') setStatus('creating');
    const answer = await duplicateEvent(api, event.id, date, time, t);

    if (answer.kind === 'refused') {
      setStatus('editing');
      setError(answer.message);
      setFocusOn({ half: answer.focus });
    } else if (answer.kind === 'failed') {
      setStatus('failed');
    } else {
      setStatus('created');
      setLanding(answer.href);
    }
  }

  return (
    <>
      {status === 'failed' && (
        <InSight>
          <ReadOut words={t('eventDuplicate.notCreated')} interrupts accessibilityRole="alert">
            <Notice
              tone="broken"
              mark={tokens.marks.broken.glyph}
              body={t('eventDuplicate.notCreated')}
            />
          </ReadOut>
        </InSight>
      )}
      {status === 'created' && (
        <InSight>
          <ReadOut words={t('eventDuplicate.created')} interrupts style={styles.created}>
            <EventState phase="draft" />
            <Text size={tokens.typeBodyPhone.size} style={styles.fill}>
              {t('eventDuplicate.created')}
            </Text>
          </ReadOut>
        </InSight>
      )}

      <View style={cardFrame(kind)}>
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('eventDuplicate.body')}
        </Text>

        <View style={[styles.inset, !phone && styles.insetBeside]}>
          <Listed
            heading={t('eventDuplicate.copied')}
            items={COPIED.map((key) => t(`eventDuplicate.${key}`))}
            beside={!phone}
          />
          <Listed
            heading={t('eventDuplicate.notCopied')}
            items={NOT_COPIED.map((key) => t(`eventDuplicate.${key}`))}
            beside={!phone}
          />
        </View>

        <Moment
          label={t('eventDuplicate.starts')}
          help={endsLine}
          hint={endsLine}
          date={date}
          time={time}
          timeZone={event.timeZone}
          error={error}
          disabled={busy}
          readOnly={false}
          pickerRef={datePicker}
          timePickerRef={timePicker}
          fieldRef={startField}
          testID="eventDuplicate.start"
          onPick={(pickedDate, pickedTime) => {
            setDate(pickedDate);
            setTime(pickedTime);
            if (pickedDate !== '' && pickedTime !== '') setError(undefined);
            if (status === 'failed') setStatus('editing');
          }}
        />

        <PrimaryButton
          label={t('eventDuplicate.create')}
          onPress={() => void create()}
          busy={busy}
          testID="eventDuplicate.create"
        />
      </View>
    </>
  );
}

function Listed({ heading, items, beside }: { heading: string; items: string[]; beside: boolean }) {
  return (
    <View style={[styles.listed, beside && styles.fill]}>
      <Text size={tokens.typeBody.size} weight="semibold" accessibilityRole="header">
        {heading}
      </Text>
      {items.map((item) => (
        <Text key={item} size={tokens.typeBody.size} style={styles.secondary}>
          {`• ${item}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  fill: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  created: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  inset: {
    gap: tokens.spaceLg,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  insetBeside: { flexDirection: 'row' },
  listed: { gap: tokens.spaceXxs },
});
