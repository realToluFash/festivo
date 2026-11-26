import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BellBody, type BellRowData } from '../../components/BellParts.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { TextAction } from '../../components/SummaryRows.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { piecesOfLine } from '../todaySize/todaySizeRules.ts';
import {
  type BellRead,
  EMPTY_GAP,
  EMPTY_TILE,
  emptySentenceSize,
  emptyStart,
  emptyTileAbove,
} from './bellSizeRules.ts';

interface Sample {
  id: string;
  category: string;
  title: string;
  lines: readonly string[];
  event: string | null;
  time: string;
  unread: boolean;
}

export const SAMPLES: readonly Sample[] = [
  {
    id: 'reply',
    category: 'guest_replies',
    title: 'Ada Obi replied: coming, with 1 guest',
    lines: ['Dietary: vegetarian'],
    event: 'Adaeze & Tunde’s wedding',
    time: '09:40',
    unread: true,
  },
  {
    id: 'change',
    category: 'event_changes',
    title: 'Ana Souza changed the event',
    lines: ['Starts at 19:30, was 19:00'],
    event: 'Adaeze & Tunde’s wedding',
    time: '08:15',
    unread: true,
  },
  {
    id: 'day',
    category: 'event_day',
    title: 'Event day tomorrow',
    lines: ['Doors at 18:00. Seating is final.'],
    event: 'Lagos launch dinner',
    time: '07:30',
    unread: false,
  },
  {
    id: 'security',
    category: 'account_security',
    title: 'A new sign-in to your account',
    lines: ['iPad, Lagos'],
    event: null,
    time: '07:05',
    unread: false,
  },
];

export function unreadAt(read: BellRead): ReadonlySet<string> {
  return new Set(read !== 'some' ? [] : SAMPLES.filter((one) => one.unread).map((one) => one.id));
}

/** The bell's list on the sample notifications, at the device's own size: main's BellBody, nothing sent. With nothing in it, the empty sentence at the stand-in size (sc-94028). */
export function BellSampleBody({
  empty,
  unread,
  menu,
  onMenu,
  onPick,
  onSettings,
}: {
  empty: { scale: number; onDrawn: (drawn: string) => void } | null;
  unread: ReadonlySet<string>;
  menu: string | null;
  onMenu: (id: string | null) => void;
  onPick: (row: BellRowData) => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();

  if (empty != null)
    return (
      <View testID="demo.bellSize.body">
        <EmptySentence scale={empty.scale} onDrawn={empty.onDrawn} />
        <TextAction
          label={t('notifications.settings')}
          onPress={onSettings}
          testID="demo.bellSize.body.settings"
        />
      </View>
    );

  const rows: BellRowData[] = SAMPLES.map((one) => ({
    id: one.id,
    category: one.category,
    title: one.title,
    lines: one.lines,
    where:
      one.event == null
        ? t('notifications.atTime', { time: one.time })
        : t('notifications.whereWhen', {
            event: one.event,
            when: t('notifications.atTime', { time: one.time }),
          }),
    unread: unread.has(one.id),
    muted: false,
    more: null,
    goneShown: false,
    testID: `demo.bellSize.item.${one.id}`,
  }));

  return (
    <BellBody
      ask={null}
      feed="loaded"
      rows={rows}
      menu={menu}
      onMenu={onMenu}
      onPick={onPick}
      onTryAgain={() => undefined}
      more={null}
      onSettings={onSettings}
      testID="demo.bellSize.body"
    />
  );
}

/** Main's empty line (BellBody) at the stand-in size: the sentence breaks only between its words, all one size, and from AX1 steps down only until its widest word fits; where that word cannot fit beside the tile, the tile goes above it. */
function EmptySentence({ scale, onDrawn }: { scale: number; onDrawn: (drawn: string) => void }) {
  const { t } = useTranslation();
  const sentence = t('notifications.empty');
  const pieces = piecesOfLine(sentence);
  const start = emptyStart(scale);
  const key = `${start}|${sentence}`;
  const [room, setRoom] = useState(0);
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const widths = measured.key === key ? measured.widths : {};
  const widest = pieces.every((piece) => widths[piece] != null)
    ? Math.max(...pieces.map((piece) => widths[piece] ?? 0))
    : null;
  // Below AX1 the sentence is main's and waits for nothing; from AX1 it is hidden until its room and its widest word are known.
  const pending = atAccessibilitySizes(scale) && (widest == null || room === 0);
  const ready = !pending && widest != null && room > 0;
  const above = ready && emptyTileAbove(scale, widest, room);
  const drawn = ready ? emptySentenceSize(scale, widest, room) : start;
  const report = ready
    ? `The sentence draws at ${tenths(drawn)}, its tile ${above ? 'above it' : 'beside it'}.`
    : null;

  useEffect(() => {
    if (report != null) onDrawn(report);
  }, [report, onDrawn]);

  return (
    <View
      style={[styles.empty, above && styles.emptyAbove, pending && styles.waiting]}
      onLayout={(event) => setRoom(Math.floor(event.nativeEvent.layout.width))}
      testID={above ? 'demo.bellSize.empty.above' : 'demo.bellSize.empty.beside'}
    >
      <MeasuredWords
        words={pieces}
        size={start}
        allowFontScaling={false}
        onWidth={(piece, width) =>
          setMeasured((now) => {
            const kept = now.key === key ? now.widths : {};

            return kept[piece] === width ? now : { key, widths: { ...kept, [piece]: width } };
          })
        }
      />
      <View
        style={styles.tile}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Glyph name="bell" size={20} ink={tokens.colorInkSecondary} />
      </View>
      <Text
        // A new size mounts a new Text, so iOS never draws one size in the box laid out for another (sc-69816).
        key={drawn}
        size={drawn}
        allowFontScaling={false}
        style={[!above && styles.grow, styles.secondary]}
        testID="demo.bellSize.empty"
      >
        {sentence}
      </Text>
    </View>
  );
}

function tenths(size: number): string {
  return String(Math.round(size * 10) / 10);
}

const styles = StyleSheet.create({
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EMPTY_GAP,
    paddingVertical: tokens.spaceLg,
  },
  emptyAbove: { flexDirection: 'column', alignItems: 'flex-start' },
  tile: {
    width: EMPTY_TILE,
    height: EMPTY_TILE,
    borderRadius: tokens.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  waiting: { opacity: 0 },
});
