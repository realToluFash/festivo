import { type RefObject, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextField } from '../../components/Field.tsx';
import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { Toast } from '../../components/Toast.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventField } from '../events/EventEdits.tsx';
import { Back, Pill } from '../settings/parts.tsx';
import {
  type Anchor,
  AnchoredMenu,
  FocusedScreen,
  Row,
  RowList,
  TextAction,
} from '../settings/Summary.tsx';
import { ChannelPill } from './CheckCard.tsx';
import {
  BELL,
  EVENT,
  PARKING,
  PARKING_REACH,
  TELL,
  TOKENS,
  TO_FIGURES,
  TO_ORDER,
  TO_WORD,
  type ToGroup,
  type Token,
  formatCount,
  BALANCE,
} from './MessagesSample.ts';
import { W, say } from './MessagesWords.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

function CloseX({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="messages.close"
    >
      <Glyph name="x" size={18} ink={tokens.colorInk} weight={2.4} />
    </Pressable>
  );
}

function SheetHead({
  title,
  close,
  onClose,
}: {
  title: string;
  close: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.sheetHead}>
      <Text
        size={22}
        weight="bold"
        accessibilityRole="header"
        style={[styles.grow, styles.sheetTitle]}
      >
        {title}
      </Text>
      <CloseX label={close} onPress={onClose} />
    </View>
  );
}

/** To, as a radio group: a sheet on the phone, a 360 popover under the chip on the iPad; focus starts on the one picked. */
export function ToPicker({
  open,
  to,
  phone,
  at,
  opener,
  onChoose,
  onClose,
}: {
  open: boolean;
  to: ToGroup;
  phone: boolean;
  at: Anchor | null;
  opener: Opener;
  onChoose: (to: ToGroup) => void;
  onClose: () => void;
}) {
  const picked = useRef<ViewInstance>(null);

  useEffect(() => {
    if (!open) return;
    const later = setTimeout(() => moveScreenReaderFocus(picked.current), 600);

    return () => clearTimeout(later);
  }, [open]);

  const body = (
    <View style={phone ? styles.sheetBody : styles.menuBody}>
      <SheetHead title={W.to} close={W.closeTo} onClose={onClose} />
      <View accessibilityRole="radiogroup">
        {TO_ORDER.map((group) => (
          <Row
            key={group}
            ref={group === to ? picked : undefined}
            title={TO_WORD[group]}
            lead={<RadioMark on={group === to} />}
            value={String(TO_FIGURES[group].count)}
            accent={group === to}
            pad={tokens.spaceSm}
            onPress={() => onChoose(group)}
            accessibilityRole="radio"
            accessibilityState={{ checked: group === to }}
            accessibilityLabel={`${TO_WORD[group]}, ${TO_FIGURES[group].count}`}
            testID={`messages.to.${group}`}
          />
        ))}
      </View>
    </View>
  );

  if (phone)
    return (
      <Sheet
        open={open}
        onClose={onClose}
        scrimLabel={W.closeTo}
        opener={opener}
        testID="messages.toSheet"
      >
        {body}
      </Sheet>
    );

  return (
    <AnchoredMenu
      at={open ? at : null}
      onClose={onClose}
      opener={opener}
      width={360}
      align="start"
      testID="messages.toPopover"
    >
      {body}
    </AnchoredMenu>
  );
}

/** Insert: the tokens Soirely fills in for each guest on their page (sc-3960). */
export function InsertMenu({
  at,
  opener,
  onInsert,
  onClose,
}: {
  at: Anchor | null;
  opener: Opener;
  onInsert: (token: Token) => void;
  onClose: () => void;
}) {
  return (
    <AnchoredMenu
      at={at}
      onClose={onClose}
      opener={opener}
      width={220}
      align="start"
      testID="messages.insertMenu"
    >
      {TOKENS.map((token) => (
        <Pressable
          key={token}
          onPress={() => onInsert(token)}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
          accessibilityRole="menuitem"
          accessibilityLabel={token}
          testID={`messages.insert.${token}`}
        >
          <View style={styles.token}>
            <Text size={14} weight="semibold" accessible={false} style={styles.accent}>
              {token}
            </Text>
          </View>
        </Pressable>
      ))}
    </AnchoredMenu>
  );
}

interface BellItem {
  key: 'replies' | 'missed' | 'change';
  title: string;
  line: string;
  glyph: GlyphName;
}

const BELL_ITEMS: readonly BellItem[] = [
  {
    key: 'replies',
    title: W.bellReplies,
    line: say.whereWhen(EVENT, say.atTime('09:31')),
    glyph: 'users',
  },
  {
    key: 'missed',
    title: say.bellMissed(PARKING, PARKING_REACH.notReached),
    line: say.whereWhen(EVENT, 'Mon, Nov 2'),
    glyph: 'chat',
  },
  { key: 'change', title: BELL.change, line: say.whereWhen(EVENT, 'Mon, Nov 2'), glyph: 'events' },
];

function BellItems({ read, onItem }: { read: boolean; onItem: (key: BellItem['key']) => void }) {
  return (
    <RowList
      items={BELL_ITEMS.map((item) => {
        const unread = !read && item.key !== 'change';

        return {
          key: item.key,
          inset: 52,
          row: (
            <Pressable
              onPress={() => onItem(item.key)}
              style={({ pressed }) => [styles.bellItem, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={[item.title, item.line, unread ? W.unread : null]
                .filter(Boolean)
                .join(', ')}
              testID={`messages.bell.${item.key}`}
            >
              <View style={styles.bellTile}>
                <Glyph name={item.glyph} size={20} ink={tokens.colorInkSecondary} />
              </View>
              <View style={styles.grow}>
                <Text
                  size={16}
                  weight={unread ? 'bold' : 'medium'}
                  accessible={false}
                  style={styles.bellTitle}
                >
                  {item.title}
                </Text>
                <Text
                  size={13.5}
                  weight="medium"
                  accessible={false}
                  style={[styles.secondary, styles.bellLine]}
                >
                  {item.line}
                </Text>
                {unread && (
                  <View style={styles.unread}>
                    <View style={styles.dot} />
                    <Text size={12.5} weight="semibold" accessible={false} style={styles.accent}>
                      {W.unread}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          ),
        };
      })}
    />
  );
}

/** The bell with the batched replies item (sc-4331): its own screen on the phone with the push above, a 380 popover on the iPad. */
export function BellPlace({
  open,
  phone,
  at,
  opener,
  push,
  onItem,
  onSettings,
  onClose,
}: {
  open: boolean;
  phone: boolean;
  at: Anchor | null;
  opener: Opener;
  push: boolean;
  onItem: (key: BellItem['key']) => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [read, setRead] = useState(false);
  const [pushing, setPushing] = useState(push);
  const markAll = () => {
    setRead(true);
    readOut(W.allRead);
  };
  const markAllRead = (
    <TextAction label={W.markAllRead} off={read} onPress={markAll} testID="messages.bell.markAll" />
  );

  if (!phone)
    return (
      <AnchoredMenu
        at={open ? at : null}
        onClose={onClose}
        opener={opener}
        width={380}
        align="end"
        testID="messages.bellPopover"
      >
        <View style={styles.popover}>
          <View style={styles.bellHead}>
            <Text size={18} weight="bold" accessibilityRole="header" style={styles.grow}>
              {W.notifications}
            </Text>
            {markAllRead}
          </View>
          <BellItems read={read} onItem={onItem} />
          <TextAction
            label={W.notificationSettings}
            onPress={onSettings}
            testID="messages.bell.settings"
          />
        </View>
      </AnchoredMenu>
    );
  if (!open) return null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bellTop}>
        <Back label={W.back} onPress={onClose} />
        <View style={styles.grow} />
        {markAllRead}
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.bellPage,
          { paddingBottom: insets.bottom + tokens.space6xl },
        ]}
      >
        <Text size={30} weight="bold" accessibilityRole="header" style={styles.pageTitle}>
          {W.notifications}
        </Text>
        <BellItems read={read} onItem={onItem} />
        <TextAction
          label={W.notificationSettings}
          onPress={onSettings}
          testID="messages.bell.settings"
        />
      </ScrollView>
      {pushing && (
        <View style={[styles.pushAt, { top: insets.top + tokens.spaceXxs }]}>
          <Pressable
            onPress={() => {
              setPushing(false);
              onItem('replies');
            }}
            style={styles.push}
            accessibilityRole="button"
            accessibilityLabel={BELL.push}
            testID="messages.push"
          >
            <View style={styles.pushTile}>
              <Glyph name="bell" size={18} ink={tokens.colorInkOnDark} weight={2.2} />
            </View>
            <View style={styles.grow}>
              <View style={styles.pushHead}>
                <Text
                  size={13}
                  weight="semibold"
                  accessible={false}
                  style={[styles.grow, styles.secondary]}
                >
                  SOIRELY
                </Text>
                <Text size={13} weight="semibold" accessible={false} style={styles.secondary}>
                  now
                </Text>
              </View>
              <Text size={15} weight="semibold" accessible={false}>
                {BELL.push}
              </Text>
            </View>
          </Pressable>
          <PushTimer onGone={() => setPushing(false)} />
        </View>
      )}
    </View>
  );
}

function PushTimer({ onGone }: { onGone: () => void }) {
  useEffect(() => {
    const gone = setTimeout(onGone, 6000);

    return () => clearTimeout(gone);
  }, [onGone]);

  return null;
}

/** Tell guests (sc-4330): Soirely's prepared line goes by every channel; a note goes on their page only. */
export function TellGuests({
  open,
  lines,
  phone,
  opener,
  onSend,
  onNotNow,
  onSeeWho,
}: {
  open: boolean;
  lines: readonly string[];
  phone: boolean;
  opener: Opener;
  onSend: () => void;
  onNotNow: () => void;
  onSeeWho: () => void;
}) {
  const [note, setNote] = useState('');
  const parts = (
    <>
      <Text size={15} weight="medium" style={[styles.secondary, styles.line15]}>
        {W.tellWho}
      </Text>
      <View style={styles.block}>
        <Text size={14} weight="semibold">
          {W.sentBy}
        </Text>
        <View style={styles.pills}>
          <ChannelPill channel="email" count={TELL.email} />
          <ChannelPill channel="sms" count={TELL.sms} />
          <ChannelPill channel="wa" count={TELL.wa} />
        </View>
      </View>
      <View>
        <View style={styles.info}>
          <View style={styles.markTop}>
            <Glyph name="info" size={15} ink={tokens.colorInkSecondary} weight={2.2} />
          </View>
          <Text size={14} weight="medium" style={[styles.grow, styles.secondary, styles.line14]}>
            {say.cannotBeReached(TELL.cannot)}
          </Text>
        </View>
        <TextAction label={W.seeWho} onPress={onSeeWho} testID="messages.tell.seeWho" />
      </View>
      <View style={styles.block}>
        <Text size={14} weight="semibold">
          {W.message}
        </Text>
        <View style={styles.prepared}>
          {lines.map((line) => (
            <Text key={line} size={16} weight="medium" style={styles.line16}>
              {line}
            </Text>
          ))}
        </View>
        <Text size={13.5} weight="medium" style={[styles.secondary, styles.line135]}>
          {W.ownLanguage}
        </Text>
      </View>
      <EventField label={W.addANote} optional help={W.noteOnPage}>
        <TextField
          value={note}
          onChangeText={setNote}
          multiline
          autoCorrect
          spellCheck
          autoCapitalize="sentences"
          style={styles.note}
          accessibilityLabel={W.addANote}
          testID="messages.tell.note"
        />
      </EventField>
      <View>
        <Text size={14} weight="medium" style={[styles.line14, styles.figures]}>
          {say.tellCredits(TELL.credits)}
        </Text>
        <Text size={14} weight="medium" style={[styles.line14, styles.figures]}>
          {say.balanceAfter(formatCount(BALANCE - TELL.credits))}
        </Text>
      </View>
    </>
  );

  if (!phone)
    return (
      <FocusedScreen
        open={open}
        title={say.tell(TELL.count)}
        cancelLabel={W.notNow}
        verb={{ label: W.send, on: true, onPress: onSend, testID: 'messages.tell.send' }}
        onCancel={onNotNow}
        cancelTestID="messages.tell.notNow"
        opener={opener}
        gap={14}
        testID="messages.tell"
      >
        {parts}
      </FocusedScreen>
    );

  return (
    <Sheet open={open} onClose={onNotNow} opener={opener} headingTakesFocus testID="messages.tell">
      <ScrollView
        style={styles.tellScroll}
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled"
      >
        <SheetHead title={say.tell(TELL.count)} close={W.notNow} onClose={onNotNow} />
        {parts}
        <Pill label={W.send} onPress={onSend} testID="messages.tell.send" />
        <TextAction label={W.notNow} onPress={onNotNow} testID="messages.tell.notNow" />
      </ScrollView>
    </Sheet>
  );
}

/** A toast at the top of the phone, as the boards draw it over a pushed screen with the keys up. */
export function TopToast({ words, onClose }: { words: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.topToast, { top: insets.top + tokens.spaceXxs }]} pointerEvents="box-none">
      <Toast key={words} words={words} onClose={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  markTop: { paddingTop: tokens.spaceHair },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  sheetHead: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  sheetTitle: { letterSpacing: 22 * -0.015, lineHeight: 22 * 1.2 },
  sheetBody: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceXl,
  },
  menuBody: {
    gap: tokens.spaceMd,
    paddingTop: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.spaceSm,
  },
  menuRow: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
  },
  token: {
    alignSelf: 'flex-start',
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceSm,
    borderRadius: 7,
    backgroundColor: tokens.colorAccentTint,
  },
  bellItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
  },
  bellTile: {
    width: 40,
    height: 40,
    borderRadius: tokens.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  bellTitle: { lineHeight: 16 * 1.35 },
  bellLine: { marginTop: 3, lineHeight: 13.5 * 1.4 },
  unread: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    marginTop: tokens.spaceXs,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  popover: {
    paddingTop: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.spaceXs,
  },
  bellHead: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  screen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: tokens.colorCard,
  },
  bellTop: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spaceXxl,
  },
  bellPage: { paddingHorizontal: tokens.spaceXxl, gap: tokens.spaceSm },
  pageTitle: {
    paddingTop: 14,
    paddingBottom: tokens.spaceXs,
    letterSpacing: -0.6,
    lineHeight: 30 * 1.12,
  },
  pushAt: { position: 'absolute', left: tokens.spaceMd, right: tokens.spaceMd },
  push: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: tokens.colorInset,
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
  pushTile: {
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccent,
  },
  pushHead: { flexDirection: 'row', gap: tokens.spaceXs },
  block: { gap: 7 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  prepared: {
    paddingVertical: 14,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 14,
    backgroundColor: tokens.colorInset,
  },
  note: { minHeight: 52, maxHeight: 120 },
  tellScroll: { maxHeight: 700 },
  line14: { lineHeight: 14 * 1.45 },
  line135: { lineHeight: 13.5 * 1.45 },
  line15: { lineHeight: 15 * 1.45 },
  line16: { lineHeight: 16 * 1.5 },
  topToast: {
    position: 'absolute',
    left: tokens.spaceXl,
    right: tokens.spaceXl,
    alignItems: 'center',
  },
});
