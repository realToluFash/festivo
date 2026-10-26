import type { OrganisationEvent } from '@soirely/api-client';
import { eventsInOrder, formatEventDate, formatEventRange } from '@soirely/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { STATUS_WORD } from '../kit/makeLive.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { SecondaryButton } from './Buttons.tsx';
import { EventCover } from './EventCover.tsx';
import { DraftRow } from './MakeLive.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';

/** A word, never colour alone (WCAG 2.2 §1.4.1); a Live event's has a green dot beside it (sc-3584). */
function EventState({ status }: { status: OrganisationEvent['status'] }) {
  const { t } = useTranslation();
  const live = status === 'live';

  return (
    <View style={[styles.state, live && styles.stateLive]}>
      {live && <View style={styles.dot} />}
      <Text
        size={tokens.typeSmall.size}
        weight="semibold"
        style={live ? styles.stateWordLive : styles.stateWord}
      >
        {t(STATUS_WORD[status])}
      </Text>
    </View>
  );
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
              <EventState status={event.status} />
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

export function NoEvents({ kind, creates }: { kind: LayoutKind; creates: boolean }) {
  const { t } = useTranslation();

  return (
    <View style={cardFrame(kind)}>
      <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
        {t('eventsScreen.noneTitle')}
      </Text>
      <Text size={tokens.typeBody.size} muted>
        {creates ? t('eventsScreen.noneCreateOnWeb') : t('eventsScreen.noneWillShow')}
      </Text>
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
}: {
  kind: LayoutKind;
  event: OrganisationEvent;
  manages: boolean;
  onChange: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={cardFrame(kind)} testID="events.page">
      <EventCover cover={event.cover} type={event.type} testID="events.page.cover" />
      <View style={styles.pageHead}>
        <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
          {event.name}
        </Text>
        <EventState status={event.status} />
      </View>
      <DraftRow kind={kind} event={event} manages={manages} onChange={onChange} />
      <EventType event={event} size={tokens.typeBody.size} />
      <Text size={tokens.typeBody.size}>
        {t('eventsScreen.when', {
          range: formatEventRange(event.startsAt, event.endsAt, event.timeZone, dateLocale()),
          timeZone: event.timeZone,
        })}
      </Text>
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
  state: {
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusField,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  stateWord: { color: tokens.colorInkSecondary },
  stateLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    borderColor: tokens.colorAccentTintBorder,
    backgroundColor: tokens.colorAccentTint,
  },
  stateWordLive: { color: tokens.colorAccentText },
  dot: {
    width: 8,
    height: 8,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorAccent,
  },
});
