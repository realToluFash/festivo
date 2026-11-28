import { type StaffEntry, realtimeTopic } from '@soirely/api-client';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { api } from '../../api.ts';
import { followReadingAgain } from '../../followTopic.ts';
import { dateLocale } from '../../i18n/index.ts';
import { BRIEFING_WORDS, noteOf } from '../../kit/staffBriefing.ts';
import { noticeClock, noticeLines } from '@soirely/domain';
import { linkWord, rowLine } from '../../kit/staffRoster.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { SecondaryButton } from '../Buttons.tsx';
import { Glyph } from '../Glyph.tsx';
import { Notice } from '../Notice.tsx';
import { Sheet } from '../Sheet.tsx';
import { Skeleton } from '../Skeleton.tsx';
import { HeadCount, Row, RowList, SectionHead } from '../SummaryRows.tsx';
import { Text } from '../Text.tsx';
import { moveScreenReaderFocus } from '../screenReaderFocus.ts';
import { BriefWord, BriefingCard } from './BriefingCard.tsx';
import { BriefingPanel, type BriefingSide, PANEL_WIDTH } from './BriefingPanel.tsx';
import { NoticeLines, ReminderCard } from './StaffNotices.tsx';
import { LinkMark } from './StaffParts.tsx';
import { openedFrom } from './openedEntry.ts';

/** Under the AC's ten seconds from a change on the web, while no line to the hub is open. */
const READ_AGAIN_MS = 5_000;
const BACK_FOCUS_MS = 350;

type Seen =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'shown'; staff: StaffEntry[]; rules: string | null };

/** The roster, with the house rules where the briefing shows them. */
function readRoster(eventId: string, withRules: boolean) {
  return withRules
    ? api.staffPlan(eventId).then((plan) => ({ staff: plan.staff, rules: plan.rules }))
    : api.staff(eventId).then((staff) => ({ staff, rules: null }));
}

/** The event's Staff in the app (sc-77903), as /demo/events/evt-wed-4?area=staff draws it: the roster to read, in the API's roster order, each person opening their own link. */
export function StaffRosterList({
  eventId,
  when,
  manages,
  finished = false,
  entries,
}: {
  eventId: string;
  /** The event's own days and zone, which every time on a notice line is read in. */
  when: { startsAt: string; endsAt: string; timeZone: string };
  manages: boolean;
  finished?: boolean;
  /** Hours and Who's here: after the briefing card where it shows, and above the Roster heading in every state. */
  entries: ReactNode;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const { kind } = useLayout();
  /** The briefing is the tablet's (sc-95654); the phone's Staff shows the roster alone. */
  const briefs = kind !== 'phone';
  const docked = kind === 'tabletLandscape';
  const clock = noticeClock(when, locale);
  const acts = manages && !finished;
  const [side, setSide] = useState<BriefingSide | null>(null);
  const copyOpener = useRef<ViewInstance | null>(null);
  const rulesOpener = useRef<ViewInstance | null>(null);
  const previewOpener = useRef<ViewInstance | null>(null);
  const [seen, setSeen] = useState<Seen>({ kind: 'loading' });
  const [answer, setAnswer] = useState(0);
  const [round, setRound] = useState(0);
  const ticket = useRef(0);
  const held = useRef<StaffEntry[] | null>(null);
  const rows = useRef(new Map<string, ViewInstance>());
  const head = useRef<ViewInstance | null>(null);
  const opened = useRef<string | null>(null);

  const read = useCallback(() => {
    const mine = ++ticket.current;
    readRoster(eventId, briefs).then(
      ({ staff, rules }) => {
        if (mine !== ticket.current) return;
        held.current = staff;
        setSeen({ kind: 'shown', staff, rules });
      },
      () => {
        if (mine !== ticket.current || held.current != null) return;
        setSeen({ kind: 'failed' });
      },
    );
  }, [eventId, briefs, setSeen]);

  useEffect(() => {
    read();

    return followReadingAgain(
      realtimeTopic('EventStaff', eventId),
      () => api.staffSubscription(eventId),
      read,
      READ_AGAIN_MS,
    );
  }, [eventId, read, round]);

  useFocusEffect(
    useCallback(() => {
      const id = opened.current;
      if (id == null) return undefined;
      opened.current = null;
      read();
      const timer = setTimeout(
        () => moveScreenReaderFocus(rows.current.get(id) ?? head.current),
        BACK_FOCUS_MS,
      );

      return () => clearTimeout(timer);
    }, [read]),
  );

  function open(entry: StaffEntry): void {
    opened.current = entry.id;
    openedFrom(eventId, entry);
    router.push({ pathname: '/events/[id]/staff-link', params: { id: eventId, person: entry.id } });
  }

  function took(entry: StaffEntry): void {
    setSeen((was) =>
      was.kind !== 'shown'
        ? was
        : { ...was, staff: was.staff.map((one) => (one.id === entry.id ? entry : one)) },
    );
    if (held.current != null)
      held.current = held.current.map((one) => (one.id === entry.id ? entry : one));
  }

  function closeSide(): void {
    const was = side?.kind;
    setSide(null);
    const back = was === 'copy' ? copyOpener : was === 'preview' ? previewOpener : rulesOpener;
    setTimeout(() => moveScreenReaderFocus(back.current ?? head.current), BACK_FOCUS_MS);
  }

  const staff = seen.kind === 'shown' ? seen.staff : null;
  const counted = staff != null && staff.length > 0;
  const people = counted ? t('staffRoster.people', { count: staff.length }) : null;

  let body;
  if (seen.kind === 'loading')
    body = <Skeleton shape="rows" rowHeight={64} rows={6} words={t('staffRoster.loading')} />;
  else if (seen.kind === 'failed')
    body = (
      <View style={styles.failed} testID="staff.failed">
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('staffRoster.failed')}
          answer={answer}
        />
        <SecondaryButton
          label={t('staffRoster.tryAgain')}
          onPress={() => {
            setAnswer((n) => n + 1);
            setSeen({ kind: 'loading' });
            setRound((n) => n + 1);
          }}
          testID="staff.retry"
        />
      </View>
    );
  else if (seen.staff.length === 0)
    body = (
      <View style={styles.empty} testID="staff.empty">
        <Text size={17} weight="semibold" accessibilityRole="header">
          {t('staffRoster.empty')}
        </Text>
        <Text size={15} weight="medium" style={styles.secondary}>
          {t('staffRoster.emptyLine')}
        </Text>
      </View>
    );
  else
    body = (
      <>
        {!manages && (
          <View style={styles.lock} testID="staff.readOnly">
            <Glyph name="lock" size={16} ink={tokens.colorInkSecondary} />
            <Text size={15} weight="medium" style={[styles.secondary, styles.shrink]}>
              {t('staffRoster.lock')}
            </Text>
          </View>
        )}
        <RowList
          items={seen.staff.map((entry) => {
            const word = linkWord(t, entry.link);
            const line = rowLine(t, entry, locale);

            return {
              key: entry.id,
              row: (
                <Row
                  ref={(view: ViewInstance | null) => {
                    if (view == null) rows.current.delete(entry.id);
                    else rows.current.set(entry.id, view);
                  }}
                  title={entry.fullName}
                  line={line}
                  below={
                    <>
                      {briefs && (
                        <View style={styles.status} testID={`staff.briefing.${entry.id}`}>
                          <BriefWord briefing={entry.briefing} />
                          {noteOf(entry, t) != null && (
                            <Text size={13} style={[styles.secondary, styles.shrink]}>
                              {noteOf(entry, t)}
                            </Text>
                          )}
                        </View>
                      )}
                      {briefs && (
                        <NoticeLines
                          person={entry.id}
                          lines={noticeLines(entry, finished, clock, t)}
                        />
                      )}
                      <View style={styles.status}>
                        <LinkMark link={entry.link} side={14} />
                        <Text
                          size={14}
                          weight="semibold"
                          accessible={false}
                          style={[styles.shrink, entry.link === 'no_mobile' && styles.attention]}
                        >
                          {word}
                        </Text>
                      </View>
                    </>
                  }
                  opens
                  onPress={() => open(entry)}
                  accessibilityLabel={t('staffRoster.rowLabel', {
                    name: entry.fullName,
                    line,
                    status: briefs
                      ? [
                          t(BRIEFING_WORDS[entry.briefing]),
                          ...noticeLines(entry, finished, clock, t).map((one) => one.words),
                          word,
                        ].join('. ')
                      : word,
                  })}
                  testID={`staff.row.${entry.id}`}
                />
              ),
            };
          })}
        />
      </>
    );

  const roster = (
    <View
      style={[styles.head, docked && side != null && styles.rosterBeside]}
      testID="staff.roster"
    >
      <View
        ref={head}
        accessible
        accessibilityRole="header"
        accessibilityLabel={
          people == null ? t('staffRoster.roster') : t('staffRoster.heading', { people })
        }
        testID="staff.heading"
      >
        <SectionHead
          title={t('staffRoster.roster')}
          right={people == null ? undefined : <HeadCount text={people} />}
        />
      </View>
      {body}
    </View>
  );

  if (!briefs || seen.kind !== 'shown')
    return (
      <View style={styles.page}>
        {entries}
        {roster}
      </View>
    );

  const reminder = <ReminderCard eventId={eventId} manages={manages} roster={seen.staff} />;
  const card = (
    <BriefingCard
      people={seen.staff}
      acts={acts}
      manages={manages}
      openCopy={() => setSide({ kind: 'copy' })}
      openRules={() => setSide({ kind: 'rules', editing: false })}
      openPreview={
        seen.staff.length === 0
          ? null
          : () =>
              setSide({
                kind: 'preview',
                id: (seen.staff.find((one) => one.shifts.length > 0) ?? seen.staff[0])!.id,
              })
      }
      openCopyRef={copyOpener}
      openRulesRef={rulesOpener}
      openPreviewRef={previewOpener}
    />
  );
  const panel =
    side == null ? null : (
      <BriefingPanel
        eventId={eventId}
        side={side}
        people={seen.staff}
        rules={seen.rules}
        acts={acts}
        onSide={setSide}
        onEntry={took}
        onRules={(rules) => setSeen((was) => (was.kind === 'shown' ? { ...was, rules } : was))}
        onClose={closeSide}
      />
    );

  if (docked)
    return (
      <View style={styles.beside}>
        <View style={styles.main}>
          {card}
          {reminder}
          {entries}
          {roster}
        </View>
        {panel != null && (
          <View style={styles.dock} testID="briefing.dock">
            {panel}
          </View>
        )}
      </View>
    );

  return (
    <View style={styles.page}>
      {card}
      {reminder}
      {entries}
      {roster}
      <Sheet
        open={side != null}
        onClose={closeSide}
        scrimLabel={t('briefing.close')}
        opener={
          side?.kind === 'copy'
            ? copyOpener
            : side?.kind === 'preview'
              ? previewOpener
              : rulesOpener
        }
        testID="briefing.dialog"
      >
        <View style={styles.dialog}>{panel}</View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  rosterBeside: { flex: 1 },
  beside: { flexDirection: 'row', gap: tokens.spaceXl, alignItems: 'flex-start' },
  main: { flex: 1, minWidth: 0, gap: tokens.spaceLg },
  page: { gap: tokens.spaceXl },
  dock: {
    width: PANEL_WIDTH,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  dialog: { flexShrink: 1, maxHeight: 640, padding: tokens.space3xl },
  head: { gap: tokens.spaceMd },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  shrink: { flexShrink: 1 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceXs,
  },
  lock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    paddingBottom: tokens.spaceSm,
  },
  failed: { gap: tokens.spaceMd, alignItems: 'flex-start' },
  empty: {
    gap: tokens.spaceXxs,
    paddingVertical: 18,
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorInset,
  },
});
