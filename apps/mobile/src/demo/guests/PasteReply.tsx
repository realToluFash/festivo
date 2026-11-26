import { type Ref, type RefObject, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { SearchField } from '../../components/EventsSearch.tsx';
import { PasteButton } from '../../components/PasteReply.tsx';
import { readOut, useReadOut } from '../../components/ReadOut.tsx';
import { MarkSlot } from '../../components/ReplyMark.tsx';
import { Row, RowList, TextAction } from '../../components/Summary.tsx';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { GroupHead, type Layout } from './GuestsParts.tsx';
import { REPLY_WORD, W } from './GuestsWords.ts';
import {
  LONG_QUOTE,
  PW,
  QUOTE_LINES,
  SAMPLE_QUOTE,
  type WhoseRow,
  clipQuote,
  hasText,
} from './PasteReplyModel.ts';

export { PasteButton };

export function PasteNotice() {
  return (
    <Text
      size={14}
      weight="medium"
      style={[styles.secondary, styles.notice]}
      testID="guests.paste.nothing"
    >
      {PW.nothingToPaste}
    </Text>
  );
}

/** Reads what was copied: text goes on to Whose reply is this?, nothing or only spaces is said beside the button. */
export function usePaste(onQuote: (quote: string) => void, startNothing: boolean) {
  const [nothing, setNothing] = useState(startNothing);
  const onText = (text: string) => {
    if (hasText(text)) {
      setNothing(false);
      onQuote(text);
      return;
    }
    setNothing(true);
    readOut(PW.nothingToPaste, { interrupts: true });
  };
  return { nothing, onText };
}

/** The demo's stand-ins for a copied message, so each path opens on a simulator with nothing copied. */
export function PasteDemo({ onText }: { onText: (text: string) => void }) {
  return (
    <DemoOnly title={PW.demoTitle}>
      <TextAction label={PW.pasteSample} onPress={() => onText(SAMPLE_QUOTE)} />
      <TextAction label={PW.pasteLong} onPress={() => onText(LONG_QUOTE)} />
      <TextAction label={PW.pasteNothing} onPress={() => onText('  ')} />
    </DemoOnly>
  );
}

export function PasteRow({
  nothing,
  onText,
  demo,
}: {
  nothing: boolean;
  onText: (text: string) => void;
  demo: boolean;
}) {
  return (
    <View style={styles.pasteBlock}>
      <View style={styles.pasteRow}>
        <PasteButton onText={onText} />
        {nothing && (
          <View style={styles.noticeBeside}>
            <PasteNotice />
          </View>
        )}
      </View>
      {demo && <PasteDemo onText={onText} />}
    </View>
  );
}

/** Their message, as copied: six lines and Show all when it runs longer. Shown here only; never sent, kept or logged. */
export function Quote({
  text,
  all,
  onShowAll,
}: {
  text: string;
  all: boolean;
  onShowAll: () => void;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const cut = all ? null : clipQuote(lines);
  const clipped = cut !== null;

  return (
    <View style={styles.quoteBlock} testID="paste.quote">
      <Text size={13} weight="semibold" style={styles.secondary}>
        {PW.theirMessage}
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
            {cut ?? text}
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
              onTextLayout={(event) => setLines(event.nativeEvent.lines.map((line) => line.text))}
            >
              {text}
            </Text>
          </View>
        </View>
      </View>
      {clipped && <TextAction label={PW.showAll} onPress={onShowAll} testID="paste.quote.all" />}
    </View>
  );
}

function Nobody({ typed, onClear }: { typed: string; onClear: () => void }) {
  const looking = typed.trim() !== '';
  useReadOut(looking ? W.noMatch : null);

  return looking ? (
    <View style={styles.none} testID="paste.noMatch">
      <Text size={18} weight="bold" accessibilityRole="header">
        {W.noMatch}
      </Text>
      <TextAction label={W.clear} onPress={onClear} testID="paste.noMatch.clear" />
    </View>
  ) : (
    <Text
      size={15}
      weight="medium"
      style={[styles.secondary, styles.lines]}
      testID="paste.everyone"
    >
      {PW.everyoneReplied}
    </Text>
  );
}

/** Whose reply is this? (sc-54450): the copied message on top, Find a guest, and the guests still waiting as rows. */
export function WhoseReply({
  layout,
  quote,
  all,
  onShowAll,
  typed,
  onTyped,
  rows,
  waiting,
  onPick,
  onBack,
  refFor,
  titleRef,
}: {
  layout: Layout;
  quote: string;
  all: boolean;
  onShowAll: () => void;
  typed: string;
  onTyped: (typed: string) => void;
  rows: readonly WhoseRow[];
  waiting: number;
  onPick: (guest: string) => void;
  onBack: () => void;
  refFor: (key: string) => Ref<ViewInstance>;
  titleRef: RefObject<TextHandle | null>;
}) {
  const size = layout === 'landscape' ? 26 : 30;
  const looking = typed.trim() !== '';
  const wide = layout === 'landscape';

  return (
    <View style={styles.page} testID="paste.whose">
      {wide && <TextAction label={W.backToGuests} onPress={onBack} testID="paste.whose.back" />}
      <Text
        ref={titleRef}
        size={size}
        weight="bold"
        accessibilityRole="header"
        style={{ lineHeight: size * 1.12, letterSpacing: size * -0.02 }}
        testID="paste.whose.title"
      >
        {PW.whose}
      </Text>
      <Quote text={quote} all={all} onShowAll={onShowAll} />
      <SearchField
        typed={typed}
        off={false}
        width={null}
        onTyped={onTyped}
        onSearch={() => undefined}
        onClear={() => onTyped('')}
        label={W.findGuest}
        testID="paste.search"
      />
      {rows.length === 0 ? (
        <Nobody typed={typed} onClear={() => onTyped('')} />
      ) : (
        <View>
          {!looking && <GroupHead word={REPLY_WORD.noreply} count={waiting} />}
          <View style={wide && styles.reach}>
            <RowList
              gutter={wide ? 10 : 0}
              items={rows.map((row) => ({
                key: row.key,
                inset: 40,
                selected: false,
                row: (
                  <Row
                    ref={refFor(`paste.${row.key}`)}
                    title={row.name}
                    line={row.line}
                    lead={<MarkSlot kind={row.kind} />}
                    opens
                    gutter={wide ? 10 : 0}
                    onPress={() => onPick(row.key)}
                    accessibilityLabel={`${row.name}. ${row.line}`}
                    testID={`paste.row.${row.key}`}
                  />
                ),
              }))}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  lines: { lineHeight: 15 * 1.45 },
  pressed: { opacity: 0.6 },
  pasteBlock: { gap: tokens.spaceSm },
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
  none: { gap: 6, paddingTop: tokens.spaceXs },
  reach: { marginHorizontal: -10 },
});
