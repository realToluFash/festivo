import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

export type NoticeTone = 'quiet' | 'attention' | 'broken' | 'done';

export function Notice({
  tone,
  mark,
  title,
  body,
  heading = false,
}: {
  tone: NoticeTone;
  mark: string;
  title?: string;
  body: string;
  /** The notice is the screen's message, so its title is the screen's heading. */
  heading?: boolean;
}) {
  const surface = {
    quiet: styles.quiet,
    attention: styles.attention,
    broken: styles.broken,
    done: styles.done,
  }[tone];
  const ring = {
    quiet: styles.ringInfo,
    attention: styles.ringAttention,
    broken: styles.ringBroken,
    done: styles.ringDone,
  }[tone];
  const ink = {
    quiet: styles.inkInfo,
    attention: styles.inkAttention,
    broken: styles.inkBroken,
    done: styles.inkDone,
  }[tone];

  return (
    <View style={[styles.notice, surface]}>
      <View style={[styles.mark, ring]}>
        <Text size={tokens.typePill.size} weight="bold" style={ink}>
          {mark}
        </Text>
      </View>
      <View style={styles.body}>
        {title != null && (
          <Text
            size={heading ? tokens.typeTitleDialog.size : tokens.typeRowTitle.size}
            weight="bold"
            style={tone === 'quiet' ? undefined : ink}
            accessibilityRole={heading ? 'header' : undefined}
          >
            {title}
          </Text>
        )}
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
  attention: {
    backgroundColor: tokens.colorAttentionTint,
    borderColor: tokens.colorAttentionBorder,
  },
  broken: { backgroundColor: tokens.colorBrokenTint, borderColor: tokens.colorBroken },
  done: { backgroundColor: tokens.colorAccentTint, borderColor: tokens.colorAccentTintBorder },
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
  ringDone: { borderColor: tokens.marks.done.ring, backgroundColor: tokens.marks.done.fill },

  inkInfo: { color: tokens.marks.info.ink },
  inkAttention: { color: tokens.colorAttentionText },
  inkBroken: { color: tokens.colorBrokenText },
  inkDone: { color: tokens.marks.done.ink },
});
