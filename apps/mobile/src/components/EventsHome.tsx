import type { ListedEvent } from '@soirely/api-client';
import {
  EVENTS_TABS,
  type EventPhase,
  type EventsTab,
  eventsHome,
  howSoonPhrase,
  nextStep,
  shownPhase,
} from '@soirely/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale, useShownLanguage } from '../i18n/index.ts';
import { eventDatesWords, nextStepWords, summaryWords } from '../kit/eventsHome.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { type WeightName } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { SecondaryButton } from './Buttons.tsx';
import { EventState } from './Events.tsx';
import { Notice } from './Notice.tsx';
import { Placeholder } from './Placeholder.tsx';
import { ReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';

const TAB_WORD: Record<EventsTab, string> = {
  upcoming: 'eventsScreen.tabUpcoming',
  drafts: 'eventsScreen.tabDrafts',
  past: 'eventsScreen.tabPast',
};

const EMPTY: Record<EventsTab, { title: string; line: string }> = {
  upcoming: { title: 'eventsScreen.emptyUpcomingTitle', line: 'eventsScreen.emptyUpcoming' },
  drafts: { title: 'eventsScreen.emptyDraftsTitle', line: 'eventsScreen.emptyDrafts' },
  past: { title: 'eventsScreen.emptyPastTitle', line: 'eventsScreen.emptyPast' },
};

const PLACEHOLDER_TILES = [
  'eventsScreen.tileGuestsInvited',
  'eventsScreen.tileRepliesIn',
  'eventsScreen.tileNeedAttention',
] as const;

const CARD_FIGURES = ['eventsScreen.columnGuests', 'eventsScreen.columnReplies'] as const;

const NOW_FIGURES = [
  'eventsScreen.arrived',
  'eventsScreen.course',
  'eventsScreen.nextCue',
] as const;

export interface HomeLoad {
  unfinished: ListedEvent[];
  past: ListedEvent[];
  pastTotal: number;
  pastPages: number;
  at: Date;
}

/** Events, [fd]'s `EventsHome-fd` (sc-22103): the summary, the tiles, Happening now on every tab, the tabs, the cards and the footer. */
export function EventsHome({
  kind,
  load,
  tab,
  onTab,
  onOpen,
  more,
  shown,
  onShowMore,
}: {
  kind: LayoutKind;
  load: HomeLoad;
  tab: EventsTab;
  onTab: (tab: EventsTab) => void;
  /** Opened from Happening now, Back returns to the tab that was showing. */
  onOpen: (id: string, fromHappeningNow: boolean) => void;
  more: 'idle' | 'loading' | 'failed';
  shown: string | null;
  onShowMore: () => void;
}) {
  const { t } = useTranslation();
  const now = useServerNow();
  const grouped = eventsHome(load, now, dateLocale());
  const counts: Record<EventsTab, number> = {
    upcoming: grouped.upcoming.length,
    drafts: grouped.drafts.length,
    past: grouped.pastCount,
  };
  const events =
    tab === 'upcoming' ? grouped.upcoming : tab === 'drafts' ? grouped.drafts : grouped.past;
  const summary = summaryWords(
    { happeningNow: grouped.happeningNow.length, upcoming: counts.upcoming, drafts: counts.drafts },
    t,
  );
  const phone = kind === 'phone';

  return (
    <View style={styles.stack}>
      {summary != null && (
        <Text size={tokens.typeBody.size} muted testID="events.summary">
          {summary}
        </Text>
      )}
      <View style={styles.tiles}>
        <View
          style={[styles.tile, phone && styles.tileHalf]}
          accessible
          accessibilityLabel={`${t('eventsScreen.tileUpcoming')}, ${counts.upcoming}`}
          testID="events.tile.upcoming"
        >
          <Text size={tokens.typeSmall.size} muted>
            {t('eventsScreen.tileUpcoming')}
          </Text>
          <Text size={tokens.typeNumberTile.size} weight="bold">
            {String(counts.upcoming)}
          </Text>
        </View>
        {PLACEHOLDER_TILES.map((label) => (
          <View key={label} style={[styles.tile, phone && styles.tileHalf]}>
            <Placeholder label={t(label)} />
          </View>
        ))}
      </View>
      {grouped.happeningNow.length > 0 && (
        <View style={styles.stack}>
          <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
            {t('eventsScreen.happeningNow')}
          </Text>
          {grouped.happeningNow.map((event) => (
            <HappeningNow
              key={event.id}
              kind={kind}
              event={event}
              now={now}
              onOpen={() => onOpen(event.id, true)}
            />
          ))}
        </View>
      )}
      <View style={styles.tabs} accessibilityRole="tablist">
        {EVENTS_TABS.map((one) => {
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
        <View style={[styles.cards, !phone && styles.grid]}>
          {events.map((event) => (
            <Card
              key={event.id}
              kind={kind}
              event={event}
              phase={shownPhase(event, load.at, now)}
              now={now}
              onOpen={() => onOpen(event.id, false)}
            />
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
      {counts[tab] > 0 && (
        <Text size={tokens.typeSmall.size} muted testID="events.footer">
          {t('eventsScreen.footer', { count: counts[tab] })}
        </Text>
      )}
    </View>
  );
}

/** The whole card opens the event, with nothing else to press in it; no cover (sc-22103). */
function Card({
  kind,
  event,
  phase,
  now,
  onOpen,
}: {
  kind: LayoutKind;
  event: ListedEvent;
  phase: EventPhase;
  now: Date;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const language = useShownLanguage();
  const dates = eventDatesWords(event, dateLocale(), t);
  const next = nextStepWords(nextStep(event, phase, now), t);

  return (
    <Pressable
      style={[cardFrame(kind), styles.card, kind !== 'phone' && styles.gridCard]}
      onPress={onOpen}
      accessibilityRole="button"
      testID={`events.row.${event.id}`}
    >
      <View style={styles.cardHead}>
        <Text size={tokens.typeRowTitle.size} weight="semibold">
          {event.name}
        </Text>
        <TypeAndPlace event={event} />
      </View>
      <View style={styles.cardDates}>
        <WithSoon
          line={dates.days}
          soon={howSoonPhrase(event, phase, now, language, (time) =>
            t('eventsScreen.endsIn', { time }),
          )}
          size={kind === 'phone' ? tokens.typeMeta.size : tokens.typeSmall.size}
          weight="medium"
          lineMuted={false}
        />
        {dates.time != null && (
          <Text size={tokens.typeSmall.size} muted>
            {dates.time}
          </Text>
        )}
      </View>
      <EventState phase={phase} />
      <View style={styles.figures}>
        {CARD_FIGURES.map((label) => (
          <Placeholder key={label} label={t(label)} />
        ))}
      </View>
      {next != null && <Text size={tokens.typeSmall.size}>{next}</Text>}
    </Pressable>
  );
}

function HappeningNow({
  kind,
  event,
  now,
  onOpen,
}: {
  kind: LayoutKind;
  event: ListedEvent;
  now: Date;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const language = useShownLanguage();
  const dates = eventDatesWords(event, dateLocale(), t);
  const step = nextStep(event, 'happening_now', now);

  return (
    <Pressable
      style={[cardFrame(kind), styles.card, styles.now]}
      onPress={onOpen}
      accessibilityRole="button"
      testID={`events.now.${event.id}`}
    >
      <View style={styles.nowWhen}>
        <Text size={tokens.typeSmall.size}>{dates.days}</Text>
        <EventState phase="happening_now" />
      </View>
      <View style={styles.cardHead}>
        <Text size={tokens.typeRowTitle.size} weight="semibold">
          {event.name}
        </Text>
        <TypeAndPlace event={event} />
      </View>
      {dates.time != null && (
        <WithSoon
          line={dates.time}
          soon={howSoonPhrase(event, 'happening_now', now, language, (time) =>
            t('eventsScreen.endsIn', { time }),
          )}
        />
      )}
      <View style={styles.figures}>
        {NOW_FIGURES.map((label) => (
          <Placeholder key={label} label={t(label)} />
        ))}
      </View>
      {step?.kind === 'nextUp' && (
        <Text size={tokens.typeSmall.size}>
          {t('eventsScreen.nextUp', { title: step.milestone.title })}
        </Text>
      )}
    </Pressable>
  );
}

/** The phrase goes to the next line whole rather than split, and the separator stays where the line before ends. */
function WithSoon({
  line,
  soon,
  size = tokens.typeSmall.size,
  weight = 'regular',
  lineMuted = true,
}: {
  line: string;
  soon: string | null;
  size?: number;
  weight?: WeightName;
  lineMuted?: boolean;
}) {
  const { t } = useTranslation();

  if (soon == null) {
    return (
      <Text size={size} weight={weight} muted={lineMuted}>
        {line}
      </Text>
    );
  }

  return (
    <View style={styles.withSoon}>
      <Text size={size} weight={weight} muted={lineMuted}>
        {t('eventsScreen.thenSoon', { when: line })}
      </Text>
      <Text size={size} weight={weight} muted>
        {soon}
      </Text>
    </View>
  );
}

function TypeAndPlace({ event }: { event: ListedEvent }) {
  const { t } = useTranslation();
  const place = event.venue?.name ?? event.venue?.address?.formatted ?? null;
  const type = t(`eventTypes.${event.type}`);

  return (
    <Text size={tokens.typeSmall.size} muted>
      {place == null ? type : t('eventsScreen.typeAndPlace', { type, place })}
    </Text>
  );
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 140,
    gap: tokens.spaceXs,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  tileHalf: { flexBasis: '40%' },
  now: { borderLeftWidth: 4, borderLeftColor: tokens.colorAttention },
  nowWhen: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
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
  cards: { gap: tokens.spaceMd },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { gap: tokens.spaceSm, alignItems: 'flex-start' },
  gridCard: { flexGrow: 1, flexBasis: 280 },
  cardHead: { gap: tokens.spaceHair, alignSelf: 'stretch' },
  cardDates: { gap: tokens.spaceHair },
  withSoon: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceXs },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceXl },
});
