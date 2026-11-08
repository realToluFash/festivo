import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import {
  EventThumb,
  NeedsYou as NeedsYouTick,
  Panel,
  SectionHead,
  TYPE,
} from '../../components/TodayParts.tsx';
import { useTodayShell } from '../../components/todayShell.ts';
import type { Moment, Need } from '../../kit/today.ts';
import { tokens } from '../../theme/tokens.ts';
import { headLabel, rowLabel } from './needsYou.ts';

function NeedRow({
  need,
  first,
  last,
  wide,
}: {
  need: Need;
  first: boolean;
  last: boolean;
  wide: boolean;
}) {
  const { open } = useTodayShell();
  const { id, name } = need.event;
  const due = (
    <View style={styles.due}>
      {need.late && <Glyph name="clock" size={13} ink={tokens.colorBroken} weight={2.4} />}
      <Text
        size={wide ? 14 : TYPE.sub}
        weight={need.late || first ? 'semibold' : 'medium'}
        accessible={false}
        style={need.late ? styles.late : first ? undefined : styles.secondary}
      >
        {need.due}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={() => open({ to: 'event', id, name })}
      style={({ pressed }) => [styles.row, !last && styles.ruled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={rowLabel(need)}
    >
      <EventThumb event={need.event} side={wide ? 46 : 44} />
      <View style={styles.words}>
        <Text size={TYPE.row} weight="semibold" accessible={false}>
          {need.title}
        </Text>
        {wide ? (
          <View style={styles.inline}>
            {due}
            <Text
              size={14}
              weight="medium"
              numberOfLines={2}
              accessible={false}
              style={styles.inlineName}
            >
              {` · ${name}`}
            </Text>
          </View>
        ) : (
          <>
            <Text size={TYPE.sub} weight="medium" accessible={false} style={styles.secondary}>
              {name}
            </Text>
            {due}
          </>
        )}
      </View>
      <Glyph name="chevron" ink={tokens.colorInkTertiary} />
    </Pressable>
  );
}

/** The kit's NeedsYou, each row one button that opens its event: the app's rows have no action of their own (sc-3914). */
export function NeedsYou({ moment, wide, top }: { moment: Moment; wide: boolean; top: number }) {
  const { t } = useTranslation();
  const { needs } = moment;

  if (needs == null || needs.length === 0)
    return <NeedsYouTick moment={moment} wide={wide} top={top} />;

  return (
    <>
      <View accessible accessibilityRole="header" accessibilityLabel={headLabel(needs.length)}>
        <SectionHead title={t('todayScreen.needsYou')} count={needs.length} top={top} />
      </View>
      <Panel style={wide && styles.panelWide}>
        {needs.map((need, index) => (
          <NeedRow
            key={`${need.event.id}:${need.title}`}
            need={need}
            first={index === 0}
            last={index === needs.length - 1}
            wide={wide}
          />
        ))}
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacePillEnd,
    minHeight: tokens.sizeHit,
    paddingVertical: tokens.spaceLg,
  },
  ruled: { borderBottomWidth: 1, borderBottomColor: tokens.colorBorder },
  pressed: { opacity: 0.7 },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  inline: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 1 },
  inlineName: { flexShrink: 1, color: tokens.colorInkSecondary },
  due: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxs, flexShrink: 0 },
  secondary: { color: tokens.colorInkSecondary },
  late: { color: tokens.colorBroken },
  panelWide: { paddingHorizontal: 18 },
});
