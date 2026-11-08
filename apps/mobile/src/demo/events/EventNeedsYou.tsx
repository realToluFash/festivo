import type { Milestone } from '@soirely/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { Panel, SectionHead } from '../../components/TodayParts.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  type NeedRow,
  type NeedsState,
  NEEDS_WORDS as W,
  headingLabel,
  needRows,
  rowLabel,
} from './NeedsYouModel.ts';

function Row({ need, last }: { need: NeedRow; last: boolean }) {
  return (
    <View
      style={[styles.row, !last && styles.ruled]}
      accessible
      accessibilityLabel={rowLabel(need)}
      testID="event.needsYou.row"
    >
      <Text size={16} weight="semibold">
        {need.title}
      </Text>
      <View style={styles.due}>
        {need.late && <Glyph name="clock" size={13} ink={tokens.colorBroken} weight={2.4} />}
        <Text
          size={14}
          weight={need.late ? 'semibold' : 'medium'}
          style={need.late ? styles.late : styles.secondary}
        >
          {need.due}
        </Text>
      </View>
    </View>
  );
}

/** The Overview's Needs you (sc-32801): the rows Today lists, from the event's dates, this event's only. No row presses or has a button. */
export function EventNeedsYou({
  timeline,
  permissions,
  state,
  now,
  timeZone,
  locale,
}: {
  timeline: readonly Milestone[];
  permissions: readonly string[];
  state: NeedsState | null;
  now: Date;
  timeZone: string;
  locale: string;
}) {
  const [load, setLoad] = useState<'loading' | 'failed' | 'loaded'>(
    state === 'needsYouLoading' ? 'loading' : state === 'needsYouFailed' ? 'failed' : 'loaded',
  );
  const rows = load === 'loaded' ? needRows(timeline, permissions, now, timeZone, locale) : [];

  return (
    <View testID="event.needsYou">
      <View accessible accessibilityRole="header" accessibilityLabel={headingLabel(rows.length)}>
        <SectionHead
          title={W.heading}
          {...(rows.length > 0 ? { count: rows.length } : {})}
          top={0}
        />
      </View>
      <Panel>
        {load === 'loading' && (
          <Text size={15} weight="medium" style={[styles.secondary, styles.line]}>
            {W.loading}
          </Text>
        )}
        {load === 'failed' && (
          <View style={styles.line}>
            <Text size={15} weight="medium">
              {W.failed}
            </Text>
            <TextAction
              label={W.tryAgain}
              onPress={() => setLoad('loaded')}
              testID="event.needsYou.retry"
            />
          </View>
        )}
        {load === 'loaded' && rows.length === 0 && (
          <View style={styles.clear} testID="event.needsYou.nothing">
            <View style={styles.tick}>
              <Glyph name="tick" size={22} ink={tokens.colorAccentText} weight={2.6} />
            </View>
            <Text size={16} weight="semibold" style={styles.fill}>
              {W.nothing}
            </Text>
          </View>
        )}
        {rows.map((need, index) => (
          <Row key={need.key} need={need} last={index === rows.length - 1} />
        ))}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  secondary: { color: tokens.colorInkSecondary },
  late: { color: tokens.colorBroken },
  line: { paddingVertical: tokens.spaceLg },
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
