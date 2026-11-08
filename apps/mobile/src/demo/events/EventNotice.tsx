import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';

/** B's notice: its tint, the mark in a solid disc, the words in Ink and any way on under them. */
export function EventNotice({
  tone,
  words,
  body,
  interrupts = false,
  actions,
}: {
  tone: 'quiet' | 'attention' | 'broken';
  words: string;
  body?: string | undefined;
  interrupts?: boolean;
  actions?: ReactNode;
}) {
  useReadOut(body == null ? words : `${words} ${body}`, { interrupts });

  return (
    <View style={[styles.notice, tint[tone]]}>
      <View
        style={[styles.disc, disc[tone]]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {tone === 'broken' ? (
          <Glyph name="x" size={15} ink={tokens.colorInkOnDark} weight={3} />
        ) : (
          <Text size={14} weight="bold" accessible={false} style={styles.onDisc}>
            {tone === 'attention' ? '!' : 'i'}
          </Text>
        )}
      </View>
      <View style={styles.noticeWords}>
        <Text size={15} weight="semibold" style={styles.noticeHead}>
          {words}
        </Text>
        {body != null && (
          <Text size={15} weight="medium" style={styles.noticeHead}>
            {body}
          </Text>
        )}
        {actions != null && <View style={styles.noticeActions}>{actions}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spacePillEnd,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.radiusCardPhone,
  },
  noticeQuiet: { backgroundColor: tokens.colorAccentTint },
  noticeAttention: { backgroundColor: tokens.colorAttentionTint },
  noticeBroken: { backgroundColor: tokens.colorBrokenTint },
  disc: {
    width: 26,
    height: 26,
    marginTop: -1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discQuiet: { backgroundColor: tokens.colorAccent },
  discAttention: { backgroundColor: tokens.colorAttention },
  discBroken: { backgroundColor: tokens.colorBroken },
  onDisc: { color: tokens.colorInkOnDark },
  noticeWords: { flex: 1, minWidth: 0, gap: 3 },
  noticeHead: { lineHeight: 15 * 1.4 },
  noticeActions: { marginTop: tokens.spaceHair },
});

const tint = {
  quiet: styles.noticeQuiet,
  attention: styles.noticeAttention,
  broken: styles.noticeBroken,
};
const disc = {
  quiet: styles.discQuiet,
  attention: styles.discAttention,
  broken: styles.discBroken,
};
