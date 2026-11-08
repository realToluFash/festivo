import type { ListedEvent } from '@soirely/api-client';
import { type EventsTab, eventsHome, shownPhase } from '@soirely/domain';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { summaryWords } from '../kit/eventsHome.ts';
import {
  type CardStep,
  type StepAction,
  type Shown,
  howSoon,
  listEventOf,
  rowLine,
  rowTag,
  shownEvent,
} from '../kit/eventsList.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { EventCard, EventThumb } from './EventCard.tsx';
import { EventsSummaryLine, EventsTabs, Said, SaidLine } from './EventsList.tsx';
import { Notice } from './Notice.tsx';
import { Row, RowList, TextAction } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

export interface HomeLoad {
  unfinished: ListedEvent[];
  past: ListedEvent[];
  pastTotal: number;
  pastPages: number;
  at: Date;
}

const EMPTY: Record<EventsTab, { title: string; line: string }> = {
  upcoming: { title: 'eventsScreen.emptyUpcomingTitle', line: 'eventsScreen.emptyUpcoming' },
  drafts: { title: 'eventsScreen.emptyDraftsTitle', line: 'eventsScreen.emptyDrafts' },
  past: { title: 'eventsScreen.emptyPastTitle', line: 'eventsScreen.emptyPast' },
};

/** Each tab's events as Events draws them: Upcoming holds what is happening now first (sc-22103). */
function useEventsHome(load: HomeLoad) {
  const now = useServerNow();
  const grouped = eventsHome(load, now, dateLocale());
  const shown = (events: readonly ListedEvent[]) =>
    events.map((event) => shownEvent(listEventOf(event), shownPhase(event, load.at, now)));

  return {
    now,
    grouped,
    tabs: {
      upcoming: shown([...grouped.happeningNow, ...grouped.upcoming]),
      drafts: shown(grouped.drafts),
      past: shown(grouped.past),
    } satisfies Record<EventsTab, Shown[]>,
  };
}

function eventTestID(event: Shown) {
  return event.phase === 'happening_now' ? `events.now.${event.id}` : `events.row.${event.id}`;
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

  return summary == null ? null : <EventsSummaryLine words={summary} />;
}

/** Events as its demo draws it (sc-30413): the tabs, the soonest event as the card, then its rows; Past ten at a time. */
export function EventsHome({
  kind,
  load,
  tab,
  onTab,
  onOpen,
  takes,
  onStep,
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
  takes: (action: StepAction) => boolean;
  onStep: (event: Shown, step: Extract<CardStep, { kind: 'button' }>) => void;
  more: 'idle' | 'loading' | 'failed';
  shown: string | null;
  onShowMore: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const { grouped, tabs, now } = useEventsHome(load);
  const wide = kind !== 'phone';
  const counts: Record<EventsTab, number> = {
    upcoming: tabs.upcoming.length,
    drafts: tabs.drafts.length,
    past: grouped.pastCount,
  };
  const events = tabs[tab];
  const card = tab === 'past' ? null : (events[0] ?? null);
  const rows = tab === 'past' ? events : events.slice(1);
  const open = (event: Shown) => onOpen(event.id, event.phase === 'happening_now');

  return (
    <View style={styles.blocks}>
      <EventsTabs tab={tab} counts={counts} onTab={onTab} />
      {events.length === 0 && (
        <View style={styles.empty} testID={`events.empty.${tab}`}>
          <Text size={18} weight="bold" accessibilityRole="header" style={styles.emptyTitle}>
            {t(EMPTY[tab].title)}
          </Text>
          <Text size={15} weight="medium" style={styles.emptyLine}>
            {t(EMPTY[tab].line)}
          </Text>
        </View>
      )}
      {card != null && (
        <EventCard
          event={card}
          now={now}
          locale={locale}
          wide={wide}
          onOpen={() => open(card)}
          takes={takes}
          onStep={(step) => onStep(card, step)}
          testID="events.card"
          openTestID={eventTestID(card)}
        />
      )}
      {rows.length > 0 && (
        <RowList
          items={rows.map((event) => ({
            key: event.id,
            inset: 60,
            row: (
              <Row
                title={event.name}
                line={rowLine(event, locale, t)}
                lead={<EventThumb event={event} />}
                tag={rowTag(event, false, t)}
                value={wide ? (howSoon(event, now, t) ?? undefined) : undefined}
                opens
                onPress={() => open(event)}
                testID={eventTestID(event)}
              />
            ),
          }))}
        />
      )}
      {tab === 'past' && grouped.past.length < grouped.pastCount && (
        <TextAction
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
      {tab === 'past' && shown != null && <Said key={shown} words={shown} />}
      {counts[tab] > 0 && (
        <SaidLine words={t('eventsScreen.footer', { count: counts[tab] })} testID="events.footer" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: 18 },
  empty: { gap: tokens.spaceXs, paddingTop: tokens.spaceXxs },
  emptyTitle: { letterSpacing: -0.18, lineHeight: 18 * 1.25 },
  emptyLine: { color: tokens.colorInkSecondary, lineHeight: 15 * 1.45 },
});
