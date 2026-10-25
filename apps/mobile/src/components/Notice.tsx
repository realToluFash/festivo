import type { Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import type { FieldAction } from './Field.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

export type NoticeTone = 'quiet' | 'attention' | 'broken' | 'done';

export function Notice({
  tone,
  mark,
  markTone = tone,
  title,
  accentTitle = false,
  body,
  detail,
  action,
  heading = false,
  announce = false,
  wordsRef,
}: {
  tone: NoticeTone;
  mark: string;
  markTone?: NoticeTone;
  title?: string;
  accentTitle?: boolean;
  body?: string;
  detail?: string | null;
  action?: FieldAction | undefined;
  /** The notice is the screen's message, so its title is the screen's heading. */
  heading?: boolean;
  /** The notice appears in answer to something the person did, so a screen reader reads it out. */
  announce?: boolean;
  /** Its words as one item, without the action, for screen reader focus to be moved to. */
  wordsRef?: Ref<View> | undefined;
}) {
  useReadOut(announce ? [title, body, detail].filter((line) => line != null).join('\n') : null);
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
  }[markTone];
  const ink = {
    quiet: styles.inkInfo,
    attention: styles.inkAttention,
    broken: styles.inkBroken,
    done: styles.inkDone,
  };
  const toneInk = {
    quiet: undefined,
    attention: styles.inkAttention,
    broken: styles.inkBroken,
    done: styles.accent,
  }[tone];
  const titleInk = accentTitle ? styles.accent : toneInk;
  const bodyInk = tone === 'done' ? styles.accent : undefined;

  return (
    <View style={[styles.notice, surface]}>
      {/* The words already say what the mark says (WCAG 2.2 SC 1.1.1). */}
      <View
        style={[styles.mark, ring]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text size={tokens.typePill.size} weight="bold" style={ink[markTone]} accessible={false}>
          {mark}
        </Text>
      </View>
      <View style={styles.body}>
        <View
          ref={wordsRef}
          style={styles.words}
          accessible={announce || wordsRef != null || undefined}
        >
          {title != null && (
            <Text
              size={heading ? tokens.typeTitleDialog.size : tokens.typeRowTitle.size}
              weight="bold"
              style={titleInk}
              accessibilityRole={heading ? 'header' : undefined}
            >
              {title}
            </Text>
          )}
          {body != null && (
            <Text size={tokens.typeBodyPhone.size} style={bodyInk}>
              {body}
            </Text>
          )}
          {detail != null && (
            <Text size={tokens.typeSmall.size} muted>
              {detail}
            </Text>
          )}
        </View>
        {action != null && (
          <Pressable
            style={styles.action}
            onPress={action.onPress}
            accessibilityRole="link"
            testID={action.testID}
          >
            <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accent}>
              {action.label}
            </Text>
          </Pressable>
        )}
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
  words: { gap: tokens.spaceHair },
  action: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  accent: { color: tokens.colorAccentText },

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
