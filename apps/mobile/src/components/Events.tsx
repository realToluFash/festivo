import type { OrganisationEvent } from '@soirely/api-client';
import { eventsInOrder, formatEventDate, formatEventRange } from '@soirely/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { SecondaryButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';

/** A word, never colour alone (WCAG 2.2 §1.4.1). Draft is the only state an event has yet (sc-1486). */
function EventState() {
  const { t } = useTranslation();

  return (
    <View style={styles.state}>
      <Text size={tokens.typeSmall.size} weight="semibold" style={styles.stateWord}>
        {t('eventsScreen.draft')}
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
            <View style={styles.rowText}>
              <Text size={tokens.typeRowTitle.size} weight="semibold">
                {event.name}
              </Text>
              <EventType event={event} size={tokens.typeSmall.size} />
              <Text size={tokens.typeSmall.size} muted>
                {date}
              </Text>
              <EventState />
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

/** The event's areas go under its times, each added by the story that builds it: none yet (sc-1454 adds Check-in). */
export function EventPage({ kind, event }: { kind: LayoutKind; event: OrganisationEvent }) {
  const { t } = useTranslation();

  return (
    <View style={cardFrame(kind)} testID="events.page">
      <View style={styles.pageHead}>
        <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
          {event.name}
        </Text>
        <EventState />
      </View>
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
});
