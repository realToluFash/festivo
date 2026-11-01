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
import { tracking } from '../theme/tracking.ts';
import { SecondaryButton } from './Buttons.tsx';
import { EventState } from './Events.tsx';
import { Notice } from './Notice.tsx';
import { Placeholder } from './Placeholder.tsx';
import { ReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

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

const NOW_FIGURES = ['eventsScreen.arrived', 'eventsScreen.course'] as const;

export interface HomeLoad {
  unfinished: ListedEvent[];
  past: ListedEvent[];
  pastTotal: number;
  pastPages: number;
  at: Date;
}

/** Events' summary and its tabs group the events in one place (sc-22103). */
function useEventsHome(load: HomeLoad) {
  const now = useServerNow();

  return { grouped: eventsHome(load, now, dateLocale()), now };
}

/** The line under Events' title: only the counts that are not 0, and none on a first visit (sc-22103). */
export function EventsSummary({ load }: { load: HomeLoad }) {
  const { t } = useTranslation();
  const { grouped } = useEventsHome(load);
  const summary = summaryWords(
    {
      happeningNow: grouped.happeningNow.length,
      upcoming: grouped.upcoming.length,
      drafts: grouped.drafts.length,
    },
    t,
  );

  return summary == null ? null : (
    <Text size={tokens.typeBodyPhone.size} muted testID="events.summary">
      {summary}
    </Text>
  );
}

/** Events, [fd]'s `EventsHome-fd` (sc-22103): the tiles, Happening now on every tab, the tabs, the cards and the footer. */
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
  const { grouped, now } = useEventsHome(load);
  const counts: Record<EventsTab, number> = {
    upcoming: grouped.upcoming.length,
    drafts: grouped.drafts.length,
    past: grouped.pastCount,
  };
  const events =
    tab === 'upcoming' ? grouped.upcoming : tab === 'drafts' ? grouped.drafts : grouped.past;
  const phone = kind === 'phone';

  return (
    <View style={styles.stack}>
      <View style={styles.tiles}>
        <View
          style={[styles.tile, phone && styles.tileHalf]}
          accessible
          accessibilityLabel={`${t('eventsScreen.tileUpcoming')}, ${counts.upcoming}`}
          testID="events.tile.upcoming"
        >
          <Text size={tokens.typeLabel.size} weight="semibold" muted style={styles.caps}>
            {t('eventsScreen.tileUpcoming')}
          </Text>
          <Text
            size={phone ? tokens.typeTitlePhone.size : tokens.typeNumberTile.size}
            weight="bold"
            style={styles.number}
          >
            {String(counts.upcoming)}
          </Text>
        </View>
        {PLACEHOLDER_TILES.map((label) => (
          <View key={label} style={[styles.tile, phone && styles.tileHalf]}>
            <Placeholder label={t(label)} look="tile" />
          </View>
        ))}
      </View>
      {grouped.happeningNow.map((event) => (
        <HappeningNow
          key={event.id}
          kind={kind}
          event={event}
          now={now}
          onOpen={() => onOpen(event.id, true)}
        />
      ))}
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
              <Text size={tokens.typeBody.size} weight="semibold" muted={!selected}>
                {t(TAB_WORD[one])}
              </Text>
              <Text size={tokens.typeSmall.size} weight="medium" muted style={styles.number}>
                {String(counts[one])}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {events.length === 0 ? (
        <View style={styles.empty}>
          <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
            {t(EMPTY[tab].title)}
          </Text>
          <Text size={tokens.typeBody.size} muted style={styles.centred}>
            {t(EMPTY[tab].line)}
          </Text>
        </View>
      ) : (
        <View style={styles.cards}>
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

/** [fd]'s card, one link with nothing else to press in it and no cover: the chip and the dates, the name with its type and place, Guests to come, then the next step (sc-22103). */
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
  const phone = kind === 'phone';
  const small = phone ? tokens.typeMeta.size : tokens.typeSmall.size;

  return (
    <Pressable
      style={[
        styles.card,
        phone
          ? styles.cardPhone
          : kind === 'tabletPortrait'
            ? styles.cardPortrait
            : styles.cardWide,
      ]}
      onPress={onOpen}
      accessibilityRole="button"
      testID={`events.row.${event.id}`}
    >
      <View style={styles.when}>
        <EventState phase={phase} />
        <WithSoon
          line={dates.days}
          soon={howSoonPhrase(event, phase, now, language, (time) =>
            t('eventsScreen.endsIn', { time }),
          )}
          size={small}
          weight="medium"
        />
        {dates.time != null && (
          <Text size={small} weight="medium" muted>
            {dates.time}
          </Text>
        )}
      </View>
      <View style={styles.cardHead}>
        <Text
          size={phone ? tokens.typeRowTitle.size : tokens.typeTitleSection.size}
          weight="semibold"
        >
          {event.name}
        </Text>
        <TypeAndPlace event={event} size={small} />
      </View>
      <Placeholder label={t('eventsScreen.columnGuests')} labelSize={small} look="figure" />
      {next != null && (
        <View style={styles.next}>
          <Text size={small}>{next}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** [fd]'s Happening now: the chip, the dates and the time, the name, its figures to come, and Next up when there is one (sc-22103). */
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
  const phone = kind === 'phone';
  const figures = NOW_FIGURES.slice(0, phone ? 1 : 2);

  return (
    <Pressable
      style={[styles.card, styles.now]}
      onPress={onOpen}
      accessibilityRole="button"
      testID={`events.now.${event.id}`}
    >
      <View style={styles.when}>
        <EventState phase="happening_now" />
        <Text size={tokens.typeSmall.size} muted>
          {dates.days}
        </Text>
        {dates.time != null && (
          <WithSoon
            line={dates.time}
            soon={howSoonPhrase(event, 'happening_now', now, language, (time) =>
              t('eventsScreen.endsIn', { time }),
            )}
          />
        )}
      </View>
      <View style={styles.cardHead}>
        <Text size={phone ? tokens.typeBodyGuest.size : tokens.typeTitleDialog.size} weight="bold">
          {event.name}
        </Text>
        <TypeAndPlace event={event} size={tokens.typeSmall.size} />
      </View>
      <View style={styles.figures}>
        {figures.map((label) => (
          <Placeholder key={label} label={t(label)} look="figure" />
        ))}
      </View>
      {step?.kind === 'nextUp' && (
        <View style={styles.next}>
          <Text size={tokens.typeSmall.size}>
            {t('eventsScreen.nextUp', { title: step.milestone.title })}
          </Text>
        </View>
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
}: {
  line: string;
  soon: string | null;
  size?: number;
  weight?: WeightName;
}) {
  const { t } = useTranslation();

  if (soon == null) {
    return (
      <Text size={size} weight={weight} muted>
        {line}
      </Text>
    );
  }

  return (
    <View style={styles.withSoon}>
      <Text size={size} weight={weight} muted>
        {t('eventsScreen.thenSoon', { when: line })}
      </Text>
      <Text size={size} weight={weight} muted>
        {soon}
      </Text>
    </View>
  );
}

function TypeAndPlace({ event, size }: { event: ListedEvent; size: number }) {
  const { t } = useTranslation();
  const place = event.venue?.name ?? event.venue?.address?.formatted ?? null;
  const type = t(`eventTypes.${event.type}`);

  return (
    <Text size={size} muted>
      {place == null ? type : t('eventsScreen.typeAndPlace', { type, place })}
    </Text>
  );
}

const LIFT = {
  shadowColor: tokens.colorInk,
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 1,
} as const;

const styles = StyleSheet.create({
  stack: { gap: 14 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 140,
    gap: tokens.spaceXs,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  tileHalf: { flexBasis: '40%', padding: 14 },
  caps: { textTransform: 'uppercase', letterSpacing: tracking(tokens.typeLabel) },
  number: { fontVariant: ['tabular-nums'] },
  card: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
    ...LIFT,
  },
  cardPhone: { flexGrow: 1, flexBasis: '40%' },
  cardPortrait: { flexGrow: 1, flexBasis: 220 },
  cardWide: { flexGrow: 1, flexBasis: 260 },
  now: { paddingVertical: 14, paddingHorizontal: tokens.spaceXl },
  when: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceXxs },
  tabs: {
    flexDirection: 'row',
    gap: tokens.spaceHair,
    padding: 3,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorBorder,
  },
  tab: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 5,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceXs,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusPill,
  },
  tabSelected: {
    backgroundColor: tokens.colorCard,
    shadowColor: tokens.colorInk,
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  empty: {
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingVertical: tokens.space5xl,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusCardLarge,
  },
  centred: { textAlign: 'center' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  cardHead: { gap: tokens.spaceHair, alignSelf: 'stretch' },
  next: {
    alignSelf: 'stretch',
    paddingTop: tokens.spaceSm,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  withSoon: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceXs },
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spaceXl,
    rowGap: tokens.spaceXxs,
  },
});
