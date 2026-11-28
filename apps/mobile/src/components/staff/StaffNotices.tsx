import { type StaffEntry, type StaffReminder, realtimeTopic } from '@soirely/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { api } from '../../api.ts';
import { followReadingAgain } from '../../followTopic.ts';
import { dateLocale } from '../../i18n/index.ts';
import { type NoticeMark, flipReminder, reminderLines } from '../../kit/staffNotices.ts';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';
import { Notice } from '../Notice.tsx';
import { OnOffSwitch } from '../OnOffSwitch.tsx';
import { ReadOut, readOut } from '../ReadOut.tsx';
import { Text } from '../Text.tsx';

/** Under the AC's ten seconds from a change made on the web, while no line to the hub is open. */
const READ_AGAIN_MS = 5_000;

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** The Staff area's Reminder the day before (sc-97614), the web's card on the same API (sc-4333), push only: its cost line and shortfall warning are sc-96965's. Read again whenever the roster changes, since who it reaches does. */
export function ReminderCard({
  eventId,
  manages,
  roster,
}: {
  eventId: string;
  /** staff.manage. */
  manages: boolean;
  /** Changes whenever the roster does. */
  roster: unknown;
}) {
  const { t } = useTranslation();
  const [card, setCard] = useState<StaffReminder | null>(null);
  const [busy, setBusy] = useState(false);
  const [notSaved, setNotSaved] = useState(false);
  const [over, setOver] = useState(false);
  const ticket = useRef(0);

  const read = useCallback(() => {
    const mine = ++ticket.current;
    api
      .staffReminder(eventId)
      .then((answer) => {
        if (mine === ticket.current) setCard(answer);
      })
      .catch(() => undefined);
  }, [eventId]);

  useEffect(() => {
    read();
  }, [read, roster]);

  useEffect(
    () =>
      followReadingAgain(
        realtimeTopic('EventStaff', eventId),
        () => api.staffSubscription(eventId),
        read,
        READ_AGAIN_MS,
      ),
    [eventId, read],
  );

  if (card == null) return null;
  const lines = reminderLines(card, dateLocale(), t);

  async function flip(next: boolean) {
    if (card == null || busy) return;
    ticket.current += 1;
    setBusy(true);
    setNotSaved(false);
    const result = await flipReminder(card, next, (on) => api.setStaffReminder(eventId, on));
    setCard(result.card);
    if (result.kind === 'over') {
      setOver(true);
      readOut(t('notices.alreadyOver'));
      read();
    } else if (result.kind === 'failed') {
      setNotSaved(true);
      readOut(card.on ? t('notices.notSavedOn') : t('notices.notSavedOff'));
    }
    setBusy(false);
  }

  return (
    <View style={styles.stack}>
      {over && (
        <View testID="reminder.over">
          <Notice tone="quiet" mark="info" body={t('notices.alreadyOver')} />
        </View>
      )}
      <View style={styles.card} testID="reminder.card">
        <View style={styles.head}>
          <Text
            size={tokens.typeTitleSection.size}
            weight="bold"
            accessibilityRole="header"
            style={styles.grow}
          >
            {t('notices.card')}
          </Text>
          {lines.kind === 'open' &&
            (manages ? (
              <OnOffSwitch
                on={card.on}
                words={{ on: t('notices.on'), off: t('notices.off') }}
                label={t('notices.switchLabel')}
                busy={busy}
                onChange={(next) => void flip(next)}
                testID="reminder.switch"
              />
            ) : (
              <Text
                size={15}
                weight="semibold"
                style={card.on ? styles.accent : styles.secondary}
                testID="reminder.word"
              >
                {card.on ? t('notices.on') : t('notices.off')}
              </Text>
            ))}
        </View>
        {lines.kind === 'finished' ? (
          <Text size={15} weight="semibold" testID="reminder.finished">
            {lines.line}
          </Text>
        ) : (
          <>
            {notSaved && (
              <ReadOut
                words={card.on ? t('notices.notSavedOn') : t('notices.notSavedOff')}
                interrupts
                accessibilityRole="alert"
                style={styles.inline}
                testID="reminder.failed"
              >
                <Glyph name="alert" size={16} ink={tokens.colorBrokenText} />
                <Text size={14} weight="semibold" style={[styles.broken, styles.shrink]}>
                  {card.on ? t('notices.notSavedOn') : t('notices.notSavedOff')}
                </Text>
              </ReadOut>
            )}
            <Text size={15} style={styles.secondary}>
              {t('notices.does', { time: card.time })}
            </Text>
            {(lines.top != null || lines.left.length > 0) && (
              <View style={styles.box} testID="reminder.lines">
                {lines.top != null && (
                  <Text size={15} weight="semibold" testID="reminder.next">
                    {lines.top}
                  </Text>
                )}
                {lines.left.map((line) => (
                  <Text key={line} size={13} style={styles.secondary}>
                    {line}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

/** The lines under a person's Briefing word, each with its own shape beside its words. */
export function NoticeLines({
  lines,
  person,
}: {
  lines: { mark: NoticeMark | null; words: string }[];
  person: StaffEntry['id'];
}) {
  if (lines.length === 0) return null;

  return (
    <View style={styles.lines} testID={`staff.notice.${person}`}>
      {lines.map((line, index) => (
        <View key={`${index}:${line.words}`} style={styles.line}>
          {line.mark == null ? <View style={styles.markSpace} /> : <LineShape mark={line.mark} />}
          <Text
            size={13}
            weight={line.mark == null ? 'regular' : 'semibold'}
            accessible={false}
            style={[styles.shrink, line.mark == null && styles.secondary]}
          >
            {line.words}
          </Text>
        </View>
      ))}
    </View>
  );
}

const SIDE = 14;

function LineShape({ mark }: { mark: NoticeMark }) {
  switch (mark) {
    case 'waiting':
      return <Glyph name="clock" size={SIDE} ink={tokens.colorInkSecondary} />;
    case 'told':
      return <Glyph name="bell" size={SIDE} ink={tokens.colorAccentText} />;
    case 'called_off':
      return (
        <View {...hidden} style={styles.square}>
          <View style={styles.strike} />
        </View>
      );
    case 'ended':
      return (
        <View {...hidden} style={styles.square}>
          <View style={styles.stop} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  grow: { flex: 1, minWidth: 0 },
  box: {
    gap: tokens.spaceXs,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorInset,
  },
  inline: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  lines: { gap: tokens.spaceXxs, paddingTop: tokens.spaceXs },
  line: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  markSpace: { width: SIDE },
  square: {
    width: SIDE,
    height: SIDE,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: tokens.colorInkSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  strike: {
    width: SIDE * 1.3,
    height: 1.5,
    backgroundColor: tokens.colorInkSecondary,
    transform: [{ rotate: '-45deg' }],
  },
  stop: { width: 6, height: 6, borderRadius: 1, backgroundColor: tokens.colorInkSecondary },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBrokenText },
  accent: { color: tokens.colorAccentText },
  shrink: { flexShrink: 1 },
});
