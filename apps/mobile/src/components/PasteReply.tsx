import { shownReply } from '@soirely/domain';
import * as Clipboard from 'expo-clipboard';
import { type RefObject, memo, useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { markOf } from '../kit/guestRows.ts';
import { LIST_EDGES } from './listFrame.ts';
import type { LayoutKind } from '../layout/useLayout.ts';
import { type WhoseRow, hasText } from '../kit/pasteReply.ts';
import { tokens } from '../theme/tokens.ts';
import { SearchField } from './EventsSearch.tsx';
import { Glyph } from './Glyph.tsx';
import { readOut, useReadOut } from './ReadOut.tsx';
import { MarkSlot } from './ReplyMark.tsx';
import { Row, RowList, TextAction } from './SummaryRows.tsx';
import { Text, type TextHandle } from './Text.tsx';

const FIELD_HEIGHT = 48;
const RING = 1.5;
const QUOTE_LINES = 6;
const PLAIN_TEXT: Clipboard.AcceptedContentType[] = ['plain-text'];
const EVEN_BUILD: Clipboard.GetImageOptions = { format: 'png', jpegQuality: 1 };
const ODD_BUILD: Clipboard.GetImageOptions = { format: 'png', jpegQuality: 0.99 };

/** expo-clipboard sets the control's target before its paste configuration; a later prop change rebuilds it with both in place. */
function useRebuiltPaste() {
  const [build, setBuild] = useState(0);
  useEffect(() => {
    const again = () => setBuild((was) => was + 1);
    again();
    const resumed = AppState.addEventListener('change', (state) => {
      if (state === 'active') again();
    });
    const copied = Clipboard.addClipboardListener(again);
    return () => {
      resumed.remove();
      copied.remove();
    };
  }, []);

  return build % 2 === 0 ? EVEN_BUILD : ODD_BUILD;
}

/** Soirely's own secondary button: Android's, and iOS's before 16. It reads the clipboard only when pressed. */
function OwnPaste({ onText }: { onText: (text: string) => void }) {
  const { t } = useTranslation();
  const label = t('guestList.paste.button');
  const press = () => {
    Clipboard.getStringAsync().then(onText, () => onText(''));
  };

  return (
    <Pressable
      onPress={press}
      style={({ pressed }) => [styles.own, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="guests.paste"
    >
      <Glyph name="clipboard" ink={tokens.colorInk} />
      <Text size={15} weight="semibold" numberOfLines={1} accessible={false}>
        {label}
      </Text>
    </Pressable>
  );
}

/** iOS 16 on: Apple's Paste, memoised because expo-clipboard rebuilds it on every prop update, and a press during a rebuild does nothing. */
const ApplePaste = memo(function ApplePaste({
  onText,
  inRow,
}: {
  onText: (text: string) => void;
  inRow: boolean;
}) {
  const onPress = useCallback(
    (data: Clipboard.PasteEventPayload) => onText(data.type === 'text' ? data.text : ''),
    [onText],
  );
  const imageOptions = useRebuiltPaste();

  return (
    <View style={[styles.appleRing, inRow ? styles.appleInRow : styles.appleAlone]}>
      <Clipboard.ClipboardPasteButton
        onPress={onPress}
        acceptedContentTypes={PLAIN_TEXT}
        imageOptions={imageOptions}
        displayMode="iconAndLabel"
        cornerStyle="capsule"
        backgroundColor={tokens.colorCard}
        foregroundColor={tokens.colorInk}
        style={styles.apple}
        testID="guests.paste"
      />
    </View>
  );
});

export function PasteButton({
  onText,
  inRow = false,
}: {
  onText: (text: string) => void;
  inRow?: boolean;
}) {
  return Platform.OS === 'ios' && Clipboard.isPasteButtonAvailable ? (
    <ApplePaste onText={onText} inRow={inRow} />
  ) : (
    <OwnPaste onText={onText} />
  );
}

export function PasteNotice() {
  const { t } = useTranslation();

  return (
    <Text
      size={14}
      weight="medium"
      style={[styles.secondary, styles.notice]}
      testID="guests.paste.nothing"
    >
      {t('guestList.paste.nothing')}
    </Text>
  );
}

/** What was copied: text goes on to Whose reply is this?, nothing or only spaces is said beside the button. */
export function usePaste(onQuote: (quote: string) => void) {
  const { t } = useTranslation();
  const [nothing, setNothing] = useState(false);
  const onText = useCallback(
    (text: string) => {
      if (hasText(text)) {
        setNothing(false);
        onQuote(text);
        return;
      }
      setNothing(true);
      readOut(t('guestList.paste.nothing'), { interrupts: true });
    },
    [onQuote, t],
  );

  return { nothing, onText, forget: () => setNothing(false) };
}

/** On a phone and in the list pane: the button in a row of its own, the notice beside it, wrapping under it when there is no room. */
export function PasteRow({
  nothing,
  onText,
}: {
  nothing: boolean;
  onText: (text: string) => void;
}) {
  return (
    <View style={styles.pasteRow}>
      <PasteButton onText={onText} />
      {nothing && (
        <View style={styles.noticeBeside}>
          <PasteNotice />
        </View>
      )}
    </View>
  );
}

/** Their message, as copied: six lines and Show all when it runs longer. It is shown here only, never sent, kept or logged. */
export function Quote({
  text,
  all,
  onShowAll,
}: {
  text: string;
  all: boolean;
  onShowAll: () => void;
}) {
  const { t } = useTranslation();
  const [lines, setLines] = useState(0);
  const clipped = !all && lines > QUOTE_LINES;

  return (
    <View style={styles.quoteBlock} testID="paste.quote">
      <Text size={13} weight="semibold" style={styles.secondary}>
        {t('guestList.paste.theirMessage')}
      </Text>
      <View style={styles.quote}>
        <View>
          <Text
            size={16}
            weight="medium"
            numberOfLines={all ? undefined : QUOTE_LINES}
            ellipsizeMode="tail"
            style={styles.quoteText}
            testID="paste.quote.text"
          >
            {text}
          </Text>
          <View
            style={styles.measure}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text
              size={16}
              weight="medium"
              style={styles.quoteText}
              accessible={false}
              onTextLayout={(event) => setLines(event.nativeEvent.lines.length)}
            >
              {text}
            </Text>
          </View>
        </View>
      </View>
      {clipped && (
        <TextAction
          label={t('guestList.paste.showAll')}
          onPress={onShowAll}
          testID="paste.quote.all"
        />
      )}
    </View>
  );
}

function Nobody({ typed, onClear }: { typed: string; onClear: () => void }) {
  const { t } = useTranslation();
  const looking = typed.trim() !== '';
  useReadOut(looking ? t('guestList.noMatch') : null);

  return looking ? (
    <View style={styles.none} testID="paste.noMatch">
      <Text size={18} weight="bold" accessibilityRole="header">
        {t('guestList.noMatch')}
      </Text>
      <TextAction label={t('guestList.clear')} onPress={onClear} testID="paste.noMatch.clear" />
    </View>
  ) : (
    <Text
      size={15}
      weight="medium"
      style={[styles.secondary, styles.lines]}
      testID="paste.everyone"
    >
      {t('guestList.paste.everyone')}
    </Text>
  );
}

/** A group's head, as Guests draws it: "No reply · 12". */
export function GroupHead({ word, count }: { word: string; count: number }) {
  const { t } = useTranslation();

  return (
    <View style={styles.groupHead} accessible accessibilityRole="header">
      <Text size={18} weight="bold" accessible={false} style={styles.headTitle}>
        {word}
      </Text>
      <Text
        size={18}
        weight="bold"
        accessible={false}
        style={[styles.secondary, styles.figures, styles.headTitle]}
      >
        {` · ${t('guestList.figure', { count })}`}
      </Text>
    </View>
  );
}

/** Whose reply is this? (sc-54450): the copied message on top, Find a guest, and the guests still waiting as rows. */
export function WhoseReply({
  kind,
  quote,
  all,
  onShowAll,
  typed,
  onTyped,
  rows,
  waiting,
  onPick,
  onBack,
  titleRef,
}: {
  kind: LayoutKind;
  quote: string;
  all: boolean;
  onShowAll: () => void;
  typed: string;
  onTyped: (typed: string) => void;
  rows: readonly WhoseRow[];
  waiting: number;
  onPick: (guestId: string) => void;
  onBack: () => void;
  titleRef: RefObject<TextHandle | null>;
}) {
  const { t } = useTranslation();
  const wide = kind === 'tabletLandscape';
  const size = wide ? 26 : 30;
  const looking = typed.trim() !== '';

  return (
    <View style={[styles.page, kind === 'phone' && styles.flushPhone]} testID="paste.whose">
      {wide && (
        <TextAction
          label={t('guestList.backToGuests')}
          onPress={onBack}
          testID="paste.whose.back"
        />
      )}
      <Text
        ref={titleRef}
        size={size}
        weight="bold"
        accessibilityRole="header"
        style={{ lineHeight: size * 1.12, letterSpacing: size * -0.02 }}
        testID="paste.whose.title"
      >
        {t('guestList.paste.whose')}
      </Text>
      <Quote text={quote} all={all} onShowAll={onShowAll} />
      <SearchField
        typed={typed}
        off={false}
        width={null}
        onTyped={onTyped}
        onSearch={() => undefined}
        onClear={() => onTyped('')}
        label={t('guestList.find')}
        testID="paste.search"
      />
      {rows.length === 0 ? (
        <Nobody typed={typed} onClear={() => onTyped('')} />
      ) : (
        <View>
          {!looking && <GroupHead word={t('guestList.reply.noReply')} count={waiting} />}
          <RowList
            items={rows.map(({ guest, line }) => ({
              key: guest.id,
              inset: 40,
              selected: false,
              row: (
                <Row
                  title={guest.fullName}
                  line={line}
                  lead={<MarkSlot kind={markOf(shownReply(guest))} />}
                  opens
                  onPress={() => onPick(guest.id)}
                  accessibilityLabel={`${guest.fullName}, ${line}`}
                  testID={`paste.row.${guest.id}`}
                />
              ),
            }))}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  lines: { lineHeight: 15 * 1.45 },
  pressed: { opacity: tokens.opacityPressed },
  own: {
    height: FIELD_HEIGHT,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: FIELD_HEIGHT / 2,
    borderWidth: RING,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  appleRing: {
    height: FIELD_HEIGHT,
    padding: RING,
    borderRadius: FIELD_HEIGHT / 2,
    backgroundColor: tokens.colorBorder,
  },
  appleAlone: { width: '100%' },
  appleInRow: { flexGrow: 1, flexBasis: 0 },
  apple: { flex: 1 },
  pasteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceMd,
    rowGap: tokens.spaceXs,
  },
  noticeBeside: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  notice: { lineHeight: 14 * 1.4 },
  quoteBlock: { gap: tokens.spaceXs },
  quote: {
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: 14,
    backgroundColor: tokens.colorInset,
  },
  quoteText: { lineHeight: 16 * 1.45 },
  measure: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
  page: { gap: 18 },
  /** The demo starts this page flush under the top bar; the page column's top edge is the list's. */
  flushPhone: { marginTop: -LIST_EDGES.phone.paddingTop },
  none: { gap: 6, paddingTop: tokens.spaceXs },
  groupHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  headTitle: { letterSpacing: -0.18, lineHeight: 18 * 1.25 },
});
