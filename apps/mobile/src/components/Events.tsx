import type { OrganisationEvent } from '@soirely/api-client';
import {
  type EventPhase,
  calledOff,
  eventsInOrder,
  formatEventDate,
  formatEventRange,
  shownPhase,
} from '@soirely/domain';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { PHASE_WORD } from '../kit/makeLive.ts';
import { useLoadedAt, useServerNow } from '../kit/serverNow.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { DeleteEventSection } from './DeleteEvent.tsx';
import { EventCover } from './EventCover.tsx';
import { MuteEventCard } from './MuteEventCard.tsx';
import { EndRow } from './EndEvent.tsx';
import { DraftRow } from './MakeLive.tsx';
import { Notice } from './Notice.tsx';
import { readOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';

/** The phase the page shows: the server's, flipped by the corrected clock at the start and the end (sc-3585). */
function useShownPhase(event: OrganisationEvent, now: Date): EventPhase {
  return shownPhase(event, useLoadedAt(event), now);
}

/** A word and a shape, never colour alone (WCAG 2.2 §1.4.1); the pill grows with its word. */
function EventState({ phase }: { phase: EventPhase }) {
  const { t } = useTranslation();
  const live = phase === 'live';

  return (
    <View style={[styles.state, live && styles.stateLive]} testID={`events.phase.${phase}`}>
      <PhaseShape phase={phase} />
      <Text
        size={tokens.typeSmall.size}
        weight="semibold"
        style={live ? styles.stateWordLive : styles.stateWord}
      >
        {t(PHASE_WORD[phase])}
      </Text>
    </View>
  );
}

/** Draft an empty circle, Live a green dot, Happening now a half-filled circle, Paused two bars, Finished a tick. */
function PhaseShape({ phase }: { phase: EventPhase }) {
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const;

  switch (phase) {
    case 'draft':
      return <View style={styles.ring} {...hidden} />;
    case 'live':
      return <View style={styles.dot} {...hidden} />;
    case 'happening_now':
      return (
        <View style={[styles.ring, styles.ringNow]} {...hidden}>
          <View style={styles.halfNow} />
        </View>
      );
    case 'paused':
      return (
        <View style={styles.bars} {...hidden}>
          <View style={styles.bar} />
          <View style={styles.bar} />
        </View>
      );
    case 'finished':
      return (
        <Text
          size={tokens.typeSmall.size}
          weight="bold"
          style={styles.stateWord}
          accessible={false}
          {...hidden}
        >
          ✓
        </Text>
      );
  }
}

function RowState({ event, now }: { event: OrganisationEvent; now: Date }) {
  return <EventState phase={useShownPhase(event, now)} />;
}

function EventType({ event, size }: { event: OrganisationEvent; size: number }) {
  const { t } = useTranslation();

  return (
    <Text size={size} muted>
      {t(`eventTypes.${event.type}`)}
    </Text>
  );
}

export function EventList({
  events,
  open,
  onOpen,
}: {
  events: readonly OrganisationEvent[];
  open: string | null;
  onOpen: (id: string) => void;
}) {
  const locale = dateLocale();
  const now = useServerNow();

  return (
    <View style={styles.rows}>
      {eventsInOrder(events, locale).map((event, index) => {
        const date = formatEventDate(event.startsAt, event.timeZone, locale);
        const selected = event.id === open;

        return (
          <Pressable
            key={event.id}
            style={[styles.row, index > 0 && styles.rowDivider, selected && styles.rowOpen]}
            onPress={() => onOpen(event.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={`events.row.${event.id}`}
          >
            <View style={styles.rowCover}>
              <EventCover cover={event.cover} type={event.type} radius={tokens.radiusSmall} />
            </View>
            <View style={styles.rowText}>
              <Text size={tokens.typeRowTitle.size} weight="semibold">
                {event.name}
              </Text>
              <EventType event={event} size={tokens.typeSmall.size} />
              <Text size={tokens.typeSmall.size} muted>
                {date}
              </Text>
              <RowState event={event} now={now} />
            </View>
            <Text
              size={tokens.typeTitleDialog.size}
              muted
              accessibilityElementsHidden
              importantForAccessibility="no"
              accessible={false}
            >
              ›
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function NoEvents({
  kind,
  onCreate,
}: {
  kind: LayoutKind;
  /** Absent for a role without Create events, which reads where events will come from. */
  onCreate?: (() => void) | undefined;
}) {
  const { t } = useTranslation();

  return (
    <View style={cardFrame(kind)}>
      <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
        {t('eventsScreen.noneTitle')}
      </Text>
      <Text size={tokens.typeBody.size} muted>
        {onCreate == null ? t('eventsScreen.noneWillShow') : t('eventsScreen.noneCreate')}
      </Text>
      {onCreate != null && (
        <PrimaryButton
          label={t('eventsScreen.newEvent')}
          onPress={onCreate}
          testID="events.none.new"
        />
      )}
    </View>
  );
}

export function EventsFailed({ onRetry, testID }: { onRetry: () => void; testID: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.stack} accessibilityRole="alert">
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        body={t('eventsScreen.failedLoad')}
        announce
      />
      <SecondaryButton label={t('eventsScreen.retry')} onPress={onRetry} testID={testID} />
    </View>
  );
}

/** The event's areas go under its times, each added by the story that builds it: none yet (sc-1454 adds Check-in). A Draft's row says what it blocks. */
export function EventPage({
  kind,
  event,
  manages,
  onChange,
  onEdit,
  onDeleted,
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  manages: boolean;
  onChange: (event: OrganisationEvent) => void;
  /** Absent for a role without events.manage (sc-3595). */
  onEdit?: (() => void) | undefined;
  /** Absent for a role without events.create (sc-3592). */
  onDeleted?: ((event: OrganisationEvent) => void) | undefined;
}) {
  const { t } = useTranslation();
  const now = useServerNow();
  const phase = useShownPhase(event, now);
  const said = useRef({ id: event.id, phase });

  // A change of phase on an open page is said politely, never on arrival (WCAG 2.2 §4.1.3).
  useEffect(() => {
    if (said.current.id === event.id && said.current.phase !== phase) {
      readOut(t(PHASE_WORD[phase]));
    }
    said.current = { id: event.id, phase };
  }, [event.id, phase, t]);

  return (
    <View style={cardFrame(kind)} testID="events.page">
      <EventCover cover={event.cover} type={event.type} testID="events.page.cover" />
      <View style={styles.pageHead}>
        <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
          {event.name}
        </Text>
        <EventState phase={phase} />
      </View>
      {calledOff(event) && event.concludedAt != null && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          body={t('eventEnd.calledOffNotice', {
            date: formatEventDate(event.concludedAt, event.timeZone, dateLocale()),
          })}
        />
      )}
      <DraftRow kind={kind} event={event} manages={manages} now={now} onChange={onChange} />
      <EndRow
        kind={kind}
        event={event}
        phase={phase}
        manages={manages}
        now={now}
        onChange={onChange}
      />
      <EventType event={event} size={tokens.typeBody.size} />
      <Text size={tokens.typeBody.size}>
        {t('eventsScreen.when', {
          range: formatEventRange(event.startsAt, event.endsAt, event.timeZone, dateLocale()),
          timeZone: event.timeZone,
        })}
      </Text>
      {onEdit != null && (
        <SecondaryButton label={t('eventEdit.open')} onPress={onEdit} testID="events.page.edit" />
      )}
      <MuteEventCard kind={kind} eventId={event.id} />
      {onDeleted != null && <DeleteEventSection kind={kind} event={event} onDeleted={onDeleted} />}
    </View>
  );
}

/** The same for an event in another organisation and one that does not exist, so it says nothing of which. */
export function EventNotFound({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();

  return (
    <View style={styles.stack} testID="events.notFound">
      <Notice
        tone="quiet"
        mark={tokens.marks.info.glyph}
        title={t('eventsScreen.notFound')}
        heading
      />
      <SecondaryButton
        label={t('eventsScreen.backToEvents')}
        onPress={onBack}
        testID="events.backToEvents"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  rows: {
    paddingVertical: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceSm,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceSm,
    borderRadius: tokens.radiusField,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder },
  rowOpen: { backgroundColor: tokens.colorAccentTint },
  rowCover: { width: 96 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  pageHead: { gap: tokens.spaceXs },
  stateWord: { color: tokens.colorInkSecondary },
  stateLive: {
    borderColor: tokens.colorAccentTintBorder,
    backgroundColor: tokens.colorAccentTint,
  },
  stateWordLive: { color: tokens.colorAccentText },
  state: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusField,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorAccent,
  },
  ring: {
    width: 10,
    height: 10,
    borderRadius: tokens.radiusPill,
    borderWidth: 1.5,
    borderColor: tokens.colorMarkEmpty,
    overflow: 'hidden',
  },
  ringNow: { borderColor: tokens.colorAttention },
  halfNow: { width: '50%', height: '100%', backgroundColor: tokens.colorAttention },
  bars: { flexDirection: 'row', gap: 2 },
  bar: { width: 3, height: 10, borderRadius: 1, backgroundColor: tokens.colorAttention },
});
