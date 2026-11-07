import type { ReactNode, Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import type { FieldAction } from './Field.tsx';
import { useReadOut } from './ReadOut.tsx';
import { useFocusOnAnswer } from './Screen.tsx';
import { Text } from './Text.tsx';
import { useAccessibilitySizes } from '../layout/useLayout.ts';
import { useMarkSide } from './markSide.ts';

/** A notice's mark grows with the text, to twice its size at most (sc-28812). */
const MARK_MAX_SCALE = 2;

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
  button,
  actions,
  heading = false,
  announce = false,
  interrupts = false,
  answer,
  takesFocus = false,
  readMs,
  wordsRef,
  wordsInTone = false,
}: {
  tone: NoticeTone;
  mark: string;
  markTone?: NoticeTone;
  title?: string;
  accentTitle?: boolean;
  body?: string;
  detail?: string | null;
  action?: FieldAction | undefined;
  /** A house button under the words, where the way out is a button rather than a text action. */
  button?: ReactNode;
  /** A row of actions under the words, inside the notice; the notice then keeps 16 at its sides and 8 above the row (RuleNotices.dc). */
  actions?: ReactNode;
  /** The notice is the screen's message, so its title is the screen's heading. */
  heading?: boolean;
  /** The notice appears in answer to something the person did, so a screen reader reads it out. */
  announce?: boolean;
  /** Read out ahead of whatever a screen reader was saying. */
  interrupts?: boolean;
  /** What a tap set for this notice to answer it: the notice is read out as it appears, and again with each new answer, without changing what a screen reader reads on it. */
  answer?: unknown;
  /** The answer takes screen reader focus to the words, which focus reads, in place of reading them out (sc-11032). */
  takesFocus?: boolean;
  /** How long after the answer focus moves to the words, as `useFocusOnAnswer` takes it. */
  readMs?: number;
  /** Its words as one item, without the action, for screen reader focus to be moved to. */
  wordsRef?: Ref<ViewInstance> | undefined;
  /** The body in the tone's own ink, semibold; an attention notice then also takes the solid amber mark and the tighter line (sc-23233). */
  wordsInTone?: boolean;
}) {
  const line = wordsInTone && tone === 'attention';
  const markSide = useMarkSide(line ? tokens.sizeMark : tokens.sizePill, MARK_MAX_SCALE);
  // At the accessibility sizes the mark sits above the words, so they get the full width.
  const markAbove = useAccessibilitySizes();
  useReadOut(
    !takesFocus && (announce || answer !== undefined)
      ? [title, body, detail].filter((line) => line != null).join('\n')
      : null,
    { answer, interrupts },
  );
  const { shown, read } = useFocusOnAnswer(takesFocus ? answer : undefined, undefined, readMs);
  const wordsAsOne = announce || takesFocus || wordsRef != null;
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
  const bodyInk = tone === 'done' ? styles.accent : wordsInTone ? toneInk : undefined;

  return (
    <View
      ref={shown}
      style={[
        styles.notice,
        surface,
        line && styles.line,
        actions != null && styles.withActions,
        markAbove && styles.markAbove,
      ]}
    >
      {/* The words already say what the mark says (WCAG 2.2 SC 1.1.1). */}
      <View
        style={[styles.mark, markSide, ring, line && styles.solidMark]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          size={tokens.typePill.size}
          weight="bold"
          style={line ? styles.inkOnSolid : ink[markTone]}
          maxFontSizeMultiplier={MARK_MAX_SCALE}
          accessible={false}
        >
          {mark}
        </Text>
      </View>
      <View
        style={[
          styles.body,
          actions != null && styles.bodyWithActions,
          markAbove && styles.bodyBelowMark,
        ]}
      >
        <View
          ref={takesFocus ? read : wordsRef}
          style={[styles.words, actions != null && styles.wordsWithActions]}
          accessible={wordsAsOne || undefined}
          // As one item, the words keep their title's "heading" only on the item itself.
          accessibilityRole={wordsAsOne && heading ? 'header' : undefined}
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
            <Text
              size={line ? tokens.typeBody.size : tokens.typeBodyPhone.size}
              weight={wordsInTone ? 'semibold' : 'regular'}
              style={bodyInk}
            >
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
        {button != null && <View style={styles.button}>{button}</View>}
        {actions != null && <View style={styles.actions}>{actions}</View>}
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
  line: {
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
  },
  solidMark: { borderWidth: 0, backgroundColor: tokens.colorAttention },
  inkOnSolid: { color: tokens.colorInkOnDark },
  markAbove: { flexDirection: 'column' },
  body: { flex: 1, gap: tokens.spaceHair },
  bodyBelowMark: { flex: 0, alignSelf: 'stretch' },
  words: { gap: tokens.spaceHair },
  button: { marginTop: tokens.spaceSm },
  withActions: { paddingHorizontal: tokens.spaceXl },
  bodyWithActions: { gap: tokens.spaceSm },
  wordsWithActions: { gap: tokens.spaceXxs },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceSm,
    rowGap: tokens.spaceXxs,
  },
  action: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  accent: { color: tokens.colorAccentText },

  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusPill,
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
