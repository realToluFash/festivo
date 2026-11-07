import { setStringAsync } from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { Notice } from '../../components/Notice.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { TextAction } from '../settings/SummaryRows.tsx';
import type { Feed } from './CalendarModel.ts';
import { CW } from './CalendarWords.ts';
import { Pill } from '../../components/SettingsParts.tsx';

/** The sample's private feed links: the reader's, and the one a reset makes. Nothing is asked of the API. */
const LINKS = [
  'https://soirely.app/api/calendar-feeds/pV3kQ8sLm2Xr7TnB0cYw5Hd9JfAe4GuZ1oKi6bRtNqM.ics',
  'https://soirely.app/api/calendar-feeds/Zt4bWq9Lr2Hk7Vx0Ns5Jd8Fc3Gm6Pa1YuEo4TiRyQwB.ics',
] as const;

function Disc({ yes }: { yes: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, yes ? styles.discYes : styles.discNo]}
    >
      <Glyph
        name={yes ? 'tick' : 'x'}
        size={yes ? 12 : 11}
        ink={yes ? tokens.marks.done.ink : tokens.colorInkSecondary}
        weight={3}
      />
    </View>
  );
}

function List({ title, items, yes }: { title: string; items: readonly string[]; yes: boolean }) {
  return (
    <View style={styles.listBlock}>
      <Text size={15} weight="bold" accessibilityRole="header" style={styles.listTitle}>
        {title}
      </Text>
      {items.map((item) => (
        <View key={item} style={styles.listRow}>
          <Disc yes={yes} />
          <Text size={15} weight="medium" style={styles.listWords}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Close({ onClose }: { onClose: () => void }) {
  return (
    <Pressable
      onPress={onClose}
      style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={CW.close}
      testID="calendar.subscribe.close"
    >
      <Glyph name="x" size={18} ink={tokens.colorInk} weight={2.4} />
    </Pressable>
  );
}

function Said({ words, answer }: { words: string; answer: unknown }) {
  useReadOut(words, { answer });

  return null;
}

/** Main's panel, stacked on the phone; on an iPad the buttons sit side by side and the two lists in two columns. */
export function SubscribePanel({
  organisation,
  start,
  wide,
  onClose,
  onOpenApp,
}: {
  organisation: string;
  start: Feed;
  wide: boolean;
  onClose: () => void;
  onOpenApp: () => void;
}) {
  const [asking, setAsking] = useState(start === 'reset');
  const [refused, setRefused] = useState(start === 'refused');
  const [copied, setCopied] = useState(false);
  const [renewed, setRenewed] = useState(false);
  const [said, setSaid] = useState<{ words: string; at: number } | null>(null);
  const link = LINKS[renewed ? 1 : 0];
  const say = (words: string) => setSaid({ words, at: Date.now() });

  const copy = () => {
    if (refused) return;
    setStringAsync(link).then(
      () => {
        setCopied(true);
        say(CW.copiedSaid);
      },
      () => setRefused(true),
    );
  };

  const head = (title: string) => (
    <View style={styles.head}>
      <Text size={20} weight="bold" accessibilityRole="header" style={[styles.grow, styles.title]}>
        {title}
      </Text>
      <Close onClose={onClose} />
    </View>
  );

  if (asking)
    return (
      <View style={styles.panel} testID="calendar.subscribe.confirm">
        {said != null && <Said words={said.words} answer={said.at} />}
        {head(CW.confirmTitle)}
        <Text size={15} weight="medium" style={styles.body}>
          {CW.confirmBody}
        </Text>
        <View style={wide ? styles.pairRow : styles.stack}>
          {wide && (
            <Pill
              label={CW.keep}
              kind="secondary"
              height={tokens.sizeHit}
              full={false}
              onPress={() => {
                setAsking(false);
                say(CW.kept);
              }}
              testID="calendar.subscribe.keep"
            />
          )}
          <Pill
            label={CW.reset}
            kind="danger"
            height={wide ? tokens.sizeHit : tokens.sizeHitPhonePrimary}
            full={!wide}
            onPress={() => {
              setAsking(false);
              setRenewed(true);
              setCopied(false);
              setRefused(false);
              say(CW.newLink);
            }}
            testID="calendar.subscribe.resetConfirm"
          />
          {!wide && (
            <Pill
              label={CW.keep}
              kind="secondary"
              height={tokens.sizeHitPhonePrimary}
              onPress={() => {
                setAsking(false);
                say(CW.kept);
              }}
              testID="calendar.subscribe.keep"
            />
          )}
        </View>
      </View>
    );

  const buttons = [
    <Pill
      key="copy"
      label={copied ? CW.copied : CW.copy}
      glyph={copied ? 'tick' : 'copy'}
      height={tokens.sizeHitPhonePrimary}
      onPress={copy}
      testID="calendar.subscribe.copy"
    />,
    <Pill
      key="open"
      label={CW.openInApp}
      kind="secondary"
      glyph="link"
      height={tokens.sizeHitPhonePrimary}
      onPress={onOpenApp}
      testID="calendar.subscribe.open"
    />,
  ];

  return (
    <View style={styles.panel} testID="calendar.subscribe">
      {said != null && <Said words={said.words} answer={said.at} />}
      {head(CW.subscribe)}
      <Text size={15} weight="medium" style={[styles.secondary, styles.body]}>
        {CW.feedIntro(organisation)}
      </Text>
      <View style={styles.linkBlock}>
        <Text size={13} weight="semibold" style={styles.secondary}>
          {CW.linkLabel}
        </Text>
        <View style={styles.link}>
          <Text
            size={14.5}
            weight="medium"
            selectable
            style={styles.linkWords}
            testID="calendar.subscribe.url"
          >
            {link}
          </Text>
        </View>
      </View>
      {renewed && <Notice tone="done" mark={tokens.marks.done.glyph} body={CW.newLink} />}
      {refused && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={CW.copyRefused}
          announce={start !== 'refused'}
        />
      )}
      <View style={wide ? styles.pairWide : styles.stack}>
        {wide
          ? buttons.map((button) => (
              <View key={button.key} style={styles.grow}>
                {button}
              </View>
            ))
          : buttons}
      </View>
      <Line glyph="shield" words={CW.private} />
      <View style={styles.rule} />
      <View style={wide ? styles.columns : styles.stackLists}>
        <View style={wide ? styles.grow : undefined}>
          <List title={CW.inTitle} items={CW.inFeed} yes />
        </View>
        <View style={wide ? styles.grow : undefined}>
          <List title={CW.outTitle} items={CW.outFeed} yes={false} />
        </View>
      </View>
      <Text size={14} weight="medium" style={[styles.secondary, styles.small]}>
        {CW.access}
      </Text>
      <View style={styles.rule} />
      <View style={styles.resetBlock}>
        <Text size={15} weight="bold" accessibilityRole="header" style={styles.listTitle}>
          {CW.resetTitle}
        </Text>
        <Text size={14} weight="medium" style={[styles.secondary, styles.small]}>
          {CW.resetBody}
        </Text>
        <View style={styles.resetAction}>
          <TextAction
            label={CW.resetOpen}
            removes
            onPress={() => setAsking(true)}
            testID="calendar.subscribe.reset"
          />
        </View>
      </View>
    </View>
  );
}

function Line({ glyph, words }: { glyph: GlyphName; words: string }) {
  return (
    <View style={styles.line}>
      <View style={styles.lineGlyph}>
        <Glyph name={glyph} size={16} ink={tokens.colorInkSecondary} weight={2} />
      </View>
      <Text size={14} weight="medium" style={[styles.grow, styles.secondary, styles.small]}>
        {words}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: tokens.opacityPressed },
  panel: { gap: tokens.spacePillEnd },
  head: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  title: { lineHeight: 20 * 1.25, letterSpacing: -0.2 },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  body: { lineHeight: 15 * 1.45 },
  small: { lineHeight: 14 * 1.45 },
  linkBlock: { gap: tokens.spaceXs },
  link: {
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spacePillEnd,
    borderRadius: tokens.spacePillEnd,
    backgroundColor: tokens.colorInset,
  },
  linkWords: { lineHeight: 14.5 * 1.45 },
  stack: { gap: tokens.spaceMd },
  pairWide: { flexDirection: 'row', gap: tokens.spaceMd },
  pairRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spaceMd },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  lineGlyph: { paddingTop: 2 },
  rule: { height: 1, backgroundColor: tokens.colorBorder },
  columns: { flexDirection: 'row', gap: tokens.space3xl },
  stackLists: { gap: tokens.spaceXl },
  listBlock: { gap: tokens.spaceSm },
  listTitle: { lineHeight: 15 * 1.3 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  listWords: { flexShrink: 1, lineHeight: 15 * 1.4 },
  disc: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  discYes: { backgroundColor: tokens.marks.done.fill },
  discNo: { backgroundColor: tokens.colorInsetBorder },
  resetBlock: { gap: tokens.spaceXs },
  resetAction: { alignItems: 'flex-start' },
});
