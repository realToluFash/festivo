import type { ListedEvent } from '@soirely/api-client';
import { type EventPhase, eventsHome, nextUp, shownPhase } from '@soirely/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { TABS, type Tab, cardDate } from '../kit/eventsHome.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { SecondaryButton } from './Buttons.tsx';
import { EventCover } from './EventCover.tsx';
import { EventState } from './Events.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';

const TAB_WORD: Record<Tab, string> = {
  upcoming: 'eventsScreen.tabUpcoming',
  drafts: 'eventsScreen.tabDrafts',
  past: 'eventsScreen.tabPast',
};

const EMPTY: Record<Tab, { title: string; line: string }> = {
  upcoming: { title: 'eventsScreen.emptyUpcomingTitle', line: 'eventsScreen.emptyUpcoming' },
  drafts: { title: 'eventsScreen.emptyDraftsTitle', line: 'eventsScreen.emptyDrafts' },
  past: { title: 'eventsScreen.emptyPastTitle', line: 'eventsScreen.emptyPast' },
};

export interface HomeLoad {
  unfinished: ListedEvent[];
  past: ListedEvent[];
  pastTotal: number;
  pastPages: number;
  at: Date;
}

/** Events Home, `EventsHome-*` (sc-3594): Happening now above Upcoming, Drafts and Past, the same at every layout. */
export function EventsHome({
  kind,
  load,
  tab,
  onTab,
  open,
  onOpen,
  more,
  shown,
  onShowMore,
}: {
  kind: LayoutKind;
  load: HomeLoad;
  tab: Tab;
  onTab: (tab: Tab) => void;
  open: string | null;
  onOpen: (id: string) => void;
  more: 'idle' | 'loading' | 'failed';
  shown: string | null;
  onShowMore: () => void;
}) {
  const { t } = useTranslation();
  const now = useServerNow();
  const grouped = eventsHome(load, now, dateLocale());
  const counts: Record<Tab, number> = {
    upcoming: grouped.upcoming.length,
    drafts: grouped.drafts.length,
    past: grouped.pastCount,
  };
  const events =
    tab === 'upcoming' ? grouped.upcoming : tab === 'drafts' ? grouped.drafts : grouped.past;

  return (
    <View style={styles.stack}>
      {grouped.happeningNow.length > 0 && (
        <View style={styles.stack}>
          <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
            {t('eventsScreen.happeningNow')}
          </Text>
          {grouped.happeningNow.map((event) => (
            <View key={event.id} style={[cardFrame(kind), styles.now]}>
              <Card
                event={event}
                phase="happening_now"
                now={now}
                selected={event.id === open}
                onOpen={onOpen}
              />
            </View>
          ))}
        </View>
      )}
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((one) => {
          const selected = one === tab;

          return (
            <Pressable
              key={one}
              style={[styles.tab, selected && styles.tabSelected]}
              onPress={() => onTab(one)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t(TAB_WORD[one])}, ${counts[one]}`}
              testID={`events.tab.${one}`}
            >
              <Text size={tokens.typeSmall.size} weight="semibold" muted={!selected}>
                {t(TAB_WORD[one])}
              </Text>
              <View style={styles.count}>
                <Text size={tokens.typeSmall.size} muted>
                  {String(counts[one])}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
        {t(TAB_WORD[tab])}
      </Text>
      {events.length === 0 ? (
        <View style={cardFrame(kind)}>
          <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
            {t(EMPTY[tab].title)}
          </Text>
          <Text size={tokens.typeBody.size} muted>
            {t(EMPTY[tab].line)}
          </Text>
        </View>
      ) : (
        <View style={styles.rows}>
          {events.map((event, index) => (
            <View key={event.id} style={index > 0 && styles.rowDivider}>
              <Card
                event={event}
                phase={shownPhase(event, load.at, now)}
                now={now}
                selected={event.id === open}
                onOpen={onOpen}
              />
            </View>
          ))}
        </View>
      )}
      {tab === 'past' && grouped.past.length < grouped.pastCount && (
        <SecondaryButton
          label={more === 'loading' ? t('eventsScreen.showingMore') : t('eventsScreen.showMore')}
          onPress={more === 'loading' ? () => undefined : onShowMore}
          testID="events.past.more"
        />
      )}
      {tab === 'past' && more === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('eventsScreen.moreFailed')}
          announce
        />
      )}
      {tab === 'past' && shown != null && <ReadOut key={shown} words={shown} />}
    </View>
  );
}

/** One item read with its status: the card opens the event. A milestone's action is not shown, as nowhere in the app is yet. */
function Card({
  event,
  phase,
  now,
  selected,
  onOpen,
}: {
  event: ListedEvent;
  phase: EventPhase;
  now: Date;
  selected: boolean;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const next = nextUp(event.milestones, now);
  const place = event.venue?.name ?? event.venue?.address?.formatted ?? null;
  const type = t(`eventTypes.${event.type}`);

  return (
    <Pressable
      style={[styles.row, selected && styles.rowOpen]}
      onPress={() => onOpen(event.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={`events.row.${event.id}`}
    >
      <View style={styles.rowCover}>
        <EventCover cover={event.cover} type={event.type} radius={tokens.radiusSmall} />
      </View>
      <View style={styles.rowText}>
        <EventState phase={phase} />
        <Text size={tokens.typeRowTitle.size} weight="semibold">
          {event.name}
        </Text>
        <Text size={tokens.typeSmall.size} muted>
          {place == null ? type : t('eventsScreen.typeAndPlace', { type, place })}
        </Text>
        {next != null && (
          <Text size={tokens.typeSmall.size}>
            {t('eventsScreen.nextUp', { title: next.title })}
          </Text>
        )}
        <Text size={tokens.typeSmall.size} muted>
          {cardDate(event, phase, now, dateLocale(), t)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  now: { borderLeftWidth: 4, borderLeftColor: tokens.colorAttention },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spaceXs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorInsetBorder,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceMd,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabSelected: { borderBottomColor: tokens.colorAccent },
  count: {
    paddingHorizontal: tokens.spaceXs,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
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
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceSm,
    borderRadius: tokens.radiusField,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder },
  rowOpen: { backgroundColor: tokens.colorAccentTint },
  rowCover: { width: 96 },
  rowText: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
});
