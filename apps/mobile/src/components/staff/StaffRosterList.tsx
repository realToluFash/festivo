import { type StaffEntry, realtimeTopic } from '@soirely/api-client';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { api } from '../../api.ts';
import { followReadingAgain } from '../../followTopic.ts';
import { dateLocale } from '../../i18n/index.ts';
import { linkWord, rowLine } from '../../kit/staffRoster.ts';
import { tokens } from '../../theme/tokens.ts';
import { SecondaryButton } from '../Buttons.tsx';
import { Glyph } from '../Glyph.tsx';
import { Notice } from '../Notice.tsx';
import { Skeleton } from '../Skeleton.tsx';
import { HeadCount, Row, RowList, SectionHead } from '../SummaryRows.tsx';
import { Text } from '../Text.tsx';
import { moveScreenReaderFocus } from '../screenReaderFocus.ts';
import { LinkMark } from './StaffParts.tsx';

/** Under the AC's ten seconds from a change on the web, while no line to the hub is open. */
const READ_AGAIN_MS = 5_000;
const BACK_FOCUS_MS = 350;

type Seen = { kind: 'loading' } | { kind: 'failed' } | { kind: 'shown'; staff: StaffEntry[] };

/** The event's Staff in the app (sc-77903), as /demo/events/evt-wed-4?area=staff draws it: the roster to read, in the API's roster order, each person opening their own link. */
export function StaffRosterList({ eventId, manages }: { eventId: string; manages: boolean }) {
  const { t } = useTranslation();
  const locale = dateLocale();
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
    api.staff(eventId).then(
      (staff) => {
        if (mine !== ticket.current) return;
        held.current = staff;
        setSeen({ kind: 'shown', staff });
      },
      () => {
        if (mine !== ticket.current || held.current != null) return;
        setSeen({ kind: 'failed' });
      },
    );
  }, [eventId]);

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
    router.push({ pathname: '/events/[id]/staff-link', params: { id: eventId, person: entry.id } });
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
        <Notice tone="broken" mark="alert" body={t('staffRoster.failed')} answer={answer} />
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
                  }
                  opens
                  onPress={() => open(entry)}
                  accessibilityLabel={t('staffRoster.rowLabel', {
                    name: entry.fullName,
                    line,
                    status: word,
                  })}
                  testID={`staff.row.${entry.id}`}
                />
              ),
            };
          })}
        />
      </>
    );

  return (
    <View style={styles.head} testID="staff.roster">
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
}

const styles = StyleSheet.create({
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
