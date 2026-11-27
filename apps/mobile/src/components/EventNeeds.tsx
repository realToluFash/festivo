import { type OrganisationEvent } from '@soirely/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { eventNeeds } from '../kit/eventNeeds.ts';
import { dayWords } from '../kit/todayMoment.ts';
import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { TextAction } from './SummaryRows.tsx';
import type { TimelineRead } from './Timeline.tsx';
import { Panel, SectionHead } from './TodayParts.tsx';

const SHORT_DAY: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

/** The Overview's Needs you: the event's own You milestones the reader can act on, from the same load as Coming up and All dates. A row is one element and does nothing when pressed: the app has no page for a milestone's action (sc-32801). */
export function EventNeeds({
  event,
  timeline: { load, now, retried, retry },
}: {
  event: OrganisationEvent;
  timeline: TimelineRead;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  useReadOut(load.kind === 'failed' && retried ? t('timeline.failed') : null, {
    quietAtMount: true,
  });
  const rows =
    load.kind === 'loaded'
      ? eventNeeds(
          load.timeline.milestones,
          event,
          load.timeline.timeZone,
          now,
          locale,
          (day, withYear) =>
            dayWords(day, locale, withYear ? { ...SHORT_DAY, year: 'numeric' } : SHORT_DAY),
          t,
        )
      : [];

  return (
    <View testID="event.needsYou">
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={
          rows.length > 0
            ? t('todayScreen.needsHead', { count: rows.length })
            : t('todayScreen.needsYou')
        }
      >
        <SectionHead
          title={t('todayScreen.needsYou')}
          {...(rows.length > 0 ? { count: rows.length } : {})}
          top={0}
        />
      </View>
      <Panel>
        {load.kind === 'loading' && (
          <Text
            size={15}
            weight="medium"
            style={[styles.secondary, styles.line]}
            testID="event.needsYou.loading"
          >
            {t('timeline.loading')}
          </Text>
        )}
        {load.kind === 'failed' && (
          <View style={styles.line}>
            <Text size={15} weight="medium">
              {t('timeline.failed')}
            </Text>
            <TextAction label={t('timeline.retry')} onPress={retry} testID="event.needsYou.retry" />
          </View>
        )}
        {load.kind === 'loaded' && rows.length === 0 && (
          <View style={styles.clear} testID="event.needsYou.nothing">
            <View style={styles.tick}>
              <Glyph name="tick" size={22} ink={tokens.colorAccentText} weight={2.6} />
            </View>
            <Text size={16} weight="semibold" style={styles.fill}>
              {t('todayScreen.nothingNeedsYou')}
            </Text>
          </View>
        )}
        {rows.map(({ key, title, due, late }, index) => (
          <View
            key={key}
            accessible
            accessibilityLabel={t('todayScreen.needRowHere', { title, due })}
            style={[styles.row, index < rows.length - 1 && styles.ruled]}
            testID="event.needsYou.row"
          >
            <Text size={16} weight="semibold">
              {title}
            </Text>
            <View style={styles.due}>
              {late && <Glyph name="clock" size={13} ink={tokens.colorBroken} weight={2.4} />}
              <Text
                size={14}
                weight={late ? 'semibold' : 'medium'}
                style={late ? styles.late : styles.secondary}
              >
                {due}
              </Text>
            </View>
          </View>
        ))}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  secondary: { color: tokens.colorInkSecondary },
  line: { paddingVertical: tokens.spaceLg },
  late: { color: tokens.colorBroken },
  ruled: { borderBottomWidth: 1, borderBottomColor: tokens.colorBorder },
  row: { gap: tokens.spaceHair, paddingVertical: tokens.spaceLg },
  due: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxs },
  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacePillEnd,
    paddingVertical: tokens.spacePillEnd,
  },
  tick: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    backgroundColor: tokens.colorAccentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
