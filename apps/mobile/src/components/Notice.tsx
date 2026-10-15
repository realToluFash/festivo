import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

export type NoticeTone = 'quiet' | 'attention' | 'broken';

/** What the notice sits on. A quiet one is drawn inset on a card and as a card on the page. */
export type NoticeSurface = 'card' | 'page';

export function Notice({
  tone,
  mark,
  title,
  body,
  on = 'card',
}: {
  tone: NoticeTone;
  mark: string;
  title: string;
  body: string;
  on?: NoticeSurface;
}) {
  const quiet = on === 'page' ? styles.quietOnPage : styles.quiet;
  const surface = { quiet, attention: styles.attention, broken: styles.broken }[tone];
  const ring = {
    quiet: styles.ringInfo,
    attention: styles.ringAttention,
    broken: styles.ringBroken,
  }[tone];
  const ink = { quiet: styles.inkInfo, attention: styles.inkAttention, broken: styles.inkBroken }[
    tone
  ];

  return (
    <View style={[styles.notice, surface]}>
      <View style={[styles.mark, ring]}>
        <Text size={tokens.typePill.size} weight="bold" style={ink}>
          {mark}
        </Text>
      </View>
      <View style={styles.body}>
        <Text
          size={tokens.typeRowTitle.size}
          weight="bold"
          style={tone === 'quiet' ? undefined : ink}
        >
          {title}
        </Text>
        <Text size={tokens.typeBodyPhone.size}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
  },
  quiet: { backgroundColor: tokens.colorInset, borderColor: tokens.colorInsetBorder },
  quietOnPage: { backgroundColor: tokens.colorCard, borderColor: tokens.colorBorder },
  attention: {
    backgroundColor: tokens.colorAttentionTint,
    borderColor: tokens.colorAttentionBorder,
  },
  broken: { backgroundColor: tokens.colorBrokenTint, borderColor: tokens.colorBroken },
  body: { flex: 1, gap: tokens.spaceHair },

  mark: {
    width: tokens.sizePill,
    height: tokens.sizePill,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizePill / 2,
    borderWidth: 1.5,
  },
  ringInfo: { borderColor: tokens.marks.info.ring },
  ringAttention: { borderColor: tokens.colorAttentionText },
  ringBroken: { borderColor: tokens.marks.broken.ring, backgroundColor: tokens.marks.broken.fill },

  inkInfo: { color: tokens.marks.info.ink },
  inkAttention: { color: tokens.colorAttentionText },
  inkBroken: { color: tokens.colorBrokenText },
});
