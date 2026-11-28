import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuietButton } from '../../components/Buttons.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { Refreshing } from '../../components/Refreshing.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { Back } from '../../components/SettingsParts.tsx';
import { TextAction } from '../../components/SummaryRows.tsx';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { FILTER_SIZES, filterScale } from '../filterSize/filterSizeRules.ts';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { wordsStart } from '../todaySize/todaySizeRules.ts';
import { BELL_ROWS, type BellRows } from '../bellRows/bellRowsRules.ts';
import { SizedBellBody } from '../bellRows/SizedBellBody.tsx';
import { unreadOf } from '../bellRows/unreadOf.ts';
import { BellSampleBody } from './BellSamples.tsx';
import type { BellSizeStart } from './BellSizeScreen.tsx';
import {
  BELL_LANGUAGES,
  BELL_READS,
  PHONE_TITLE,
  PHONE_TITLE_LINE,
  PHONE_TITLE_TRACKING,
  phoneTitleSize,
} from './bellSizeRules.ts';

/** sc-92959: the phone's own bell screen, upright, at a stand-in text size and language: main's top row and list, and the title whole on one line, stepped down only for its own word. */
export function PhoneBellScreen({ start }: { start: BellSizeStart }) {
  const { i18n } = useTranslation();
  const { fontScale, width, height } = useWindowDimensions();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [read, setRead] = useState(start.read);
  const [refreshing, setRefreshing] = useState(start.refreshing);
  const [rows, setRows] = useState(start.rows);
  const [rowsAt, setRowsAt] = useState<string | null>(null);
  const [unread, setUnread] = useState<ReadonlySet<string>>(() => unreadOf(start.read, start.rows));
  const [menu, setMenu] = useState<string | null>(null);
  const [told, setTold] = useState<string | null>(null);
  const [drawnAt, setDrawnAt] = useState<number | null>(null);
  const [emptyAt, setEmptyAt] = useState<string | null>(null);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const scale = filterScale(size, fontScale);

  if (width > height)
    return (
      <View style={styles.aside}>
        <QuietButton label="Back to the demo" onPress={goBack} testID="demo.bellSize.back" />
        <DemoOnly title="On its side the phone opens the bell in main’s frame, whose title this demo does not draw. Turn the iPhone upright.">
          {null}
        </DemoOnly>
      </View>
    );

  return (
    <I18nextProvider i18n={words}>
      <BellPage
        scale={scale}
        language={language}
        rows={rows}
        onRows={setRowsAt}
        empty={read === 'none' ? { scale, onDrawn: setEmptyAt } : null}
        unread={unread}
        refreshing={refreshing}
        menu={menu}
        onMenu={setMenu}
        onDrawn={setDrawnAt}
        onMarkAll={(said) => {
          setUnread(new Set());
          setTold(said);
          readOut(said);
        }}
        onPick={(id, title) => {
          setUnread((now) => new Set([...now].filter((one) => one !== id)));
          setTold(`${title}: opens its page, as on main.`);
        }}
        onSettings={() => setTold('Notification settings opens, as on main.')}
        onShowMore={() => setTold('Show more loads the next page, as on main.')}
        foot={
          <DemoOnly
            title={[
              'Stand-ins for the device’s text size, its language, whether anything is unread, and the refreshing mark. Only the title draws at the size chosen; the row with ‹ and Mark all read, and the list, are main’s at this device’s size. The title grows as on main and, from AX1, steps down only to the largest size at which its own word fits the screen’s width, never under 30. The refreshing mark sits beside it or on the line under it and never makes it smaller. With nothing yet, the empty sentence draws at the size chosen too, by the panel’s rule: whole words, one size, stepped down from AX1 only for its widest word, never under 15, the bell tile above it where that word cannot fit beside it, and Notification settings under it by the same rule. Rows other than As on main draw the list at the size chosen too (sc-102956): each of a row’s texts grows as on main and steps down only to the largest size at which its own widest word fits its line, never under its default size; no text under a title draws larger than it; a word wider than its line even at the default size draws at the default size and breaks at the line’s end. Nothing is sent and no string is added.',
              drawnAt == null ? null : `The title draws at ${tenths(drawnAt)}.`,
              read === 'none' ? emptyAt : null,
              rows !== 'main' && read !== 'none' ? rowsAt : null,
              told == null ? null : `Said: ${told}`,
            ]
              .filter((line) => line != null)
              .join(' ')}
          >
            <Choices
              heading="Text size"
              options={FILTER_SIZES}
              chosen={size}
              onChoose={setSize}
              id="size"
              prefix="demo.bellSize"
            />
            <Choices
              heading="Language"
              options={BELL_LANGUAGES}
              chosen={language}
              onChoose={setLanguage}
              id="language"
              prefix="demo.bellSize"
            />
            <Choices
              heading="Unread"
              options={BELL_READS}
              chosen={read}
              onChoose={(next) => {
                setRead(next);
                setUnread(unreadOf(next, rows));
              }}
              id="read"
              prefix="demo.bellSize"
            />
            <Choices
              heading="Rows"
              options={BELL_ROWS}
              chosen={rows}
              onChoose={(next) => {
                setRows(next);
                setRowsAt(null);
                setUnread(unreadOf(read, next));
              }}
              id="rows"
              prefix="demo.bellSize"
            />
            <QuietButton
              label={refreshing ? 'Hide the refreshing mark' : 'Show the refreshing mark'}
              onPress={() => setRefreshing((now) => !now)}
              testID="demo.bellSize.toggleRefreshing"
            />
          </DemoOnly>
        }
      />
    </I18nextProvider>
  );
}

/** Main's bell screen (BellParts' BellFrame, `screen`): ‹ and Mark all read on one row, then the page that scrolls, its title over the list. */
function BellPage({
  scale,
  language,
  rows,
  onRows,
  empty,
  unread,
  refreshing,
  menu,
  onMenu,
  onDrawn,
  onMarkAll,
  onPick,
  onSettings,
  onShowMore,
  foot,
}: {
  scale: number;
  language: string;
  rows: BellRows;
  onRows: (drawn: string) => void;
  empty: { scale: number; onDrawn: (drawn: string) => void } | null;
  unread: ReadonlySet<string>;
  refreshing: boolean;
  menu: string | null;
  onMenu: (id: string | null) => void;
  onDrawn: (size: number) => void;
  onMarkAll: (said: string) => void;
  onPick: (id: string, title: string) => void;
  onSettings: () => void;
  onShowMore: () => void;
  foot: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const heading = useRef<TextHandle>(null);

  useEffect(() => {
    const wait = setTimeout(() => moveScreenReaderFocus(heading.current), SETTLED_MS);

    return () => clearTimeout(wait);
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="demo.bellSize.phone">
      <View style={styles.bellTop}>
        <Back label={t('notifications.back')} onPress={goBack} testID="demo.bellSize.back" />
        <View style={styles.grow} />
        <TextAction
          label={t('notifications.markAllRead')}
          off={unread.size === 0}
          onPress={() => onMarkAll(t('notifications.allRead'))}
          testID="demo.bellSize.markAllRead"
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.bellPage,
          { paddingBottom: insets.bottom + tokens.space6xl },
        ]}
      >
        <PageTitle heading={heading} scale={scale} refreshing={refreshing} onDrawn={onDrawn} />
        {rows !== 'main' && empty == null ? (
          <SizedBellBody
            rows={rows}
            scale={scale}
            language={language}
            unread={unread}
            onPick={onPick}
            onShowMore={onShowMore}
            onSettings={onSettings}
            onReport={onRows}
          />
        ) : (
          <BellSampleBody
            empty={empty}
            unread={unread}
            menu={menu}
            onMenu={onMenu}
            onPick={(row) => onPick(row.id, row.title)}
            onSettings={onSettings}
          />
        )}
        <View style={styles.foot}>{foot}</View>
      </ScrollView>
    </View>
  );
}

/** The title at main's 30 grown by the stand-in scale and, from AX1, stepped down only until **Notifications** fits the page's width whole; the refreshing mark wraps under it rather than shrinking it. */
function PageTitle({
  heading,
  scale,
  refreshing,
  onDrawn,
}: {
  heading: RefObject<TextHandle | null>;
  scale: number;
  refreshing: boolean;
  onDrawn: (size: number) => void;
}) {
  const { t } = useTranslation();
  const name = t('notifications.heading');
  const begin = wordsStart(PHONE_TITLE, scale, Number.POSITIVE_INFINITY);
  const [room, setRoom] = useState(0);
  const [measured, setMeasured] = useState<{ key: string; width: number } | null>(null);
  const key = `${begin}|${name}`;
  const width = measured?.key === key ? measured.width : null;
  // Below AX1 the title is main's and waits for nothing; from AX1 it is hidden until its room and its width are known.
  const pending = atAccessibilitySizes(scale) && (width == null || room === 0);
  const drawn = pending || width == null ? begin : phoneTitleSize(scale, width, room);

  useEffect(() => {
    if (!pending) onDrawn(drawn);
  }, [pending, drawn, onDrawn]);

  return (
    <View
      style={styles.titleLine}
      onLayout={(event) => setRoom(Math.floor(event.nativeEvent.layout.width))}
    >
      <MeasuredWords
        words={[name]}
        size={begin}
        weight="bold"
        allowFontScaling={false}
        style={{ letterSpacing: begin * PHONE_TITLE_TRACKING }}
        onWidth={(_, measuredWidth) =>
          setMeasured((now) =>
            now?.key === key && now.width === measuredWidth ? now : { key, width: measuredWidth },
          )
        }
      />
      <Text
        // A new size mounts a new Text, so iOS never draws one size in the box laid out for another (sc-69816).
        key={drawn}
        ref={heading}
        size={drawn}
        weight="bold"
        allowFontScaling={false}
        accessibilityRole="header"
        style={[
          styles.pageTitle,
          { letterSpacing: drawn * PHONE_TITLE_TRACKING, lineHeight: drawn * PHONE_TITLE_LINE },
          pending && styles.waiting,
        ]}
        testID="demo.bellSize.title"
      >
        {name}
      </Text>
      {refreshing && <Refreshing testID="demo.bellSize.refreshing" />}
    </View>
  );
}

function tenths(size: number): string {
  return String(Math.round(size * 10) / 10);
}

const styles = StyleSheet.create({
  aside: {
    flex: 1,
    gap: tokens.spaceXl,
    paddingHorizontal: tokens.space5xl,
    paddingTop: tokens.space5xl,
    backgroundColor: tokens.colorCard,
  },
  screen: { flex: 1, backgroundColor: tokens.colorCard },
  bellTop: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spaceXxl,
  },
  grow: { flex: 1 },
  bellPage: { paddingHorizontal: tokens.spaceXxl, gap: tokens.spaceSm },
  titleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceMd,
  },
  pageTitle: { paddingTop: 14, paddingBottom: tokens.spaceXs },
  waiting: { opacity: 0 },
  foot: { paddingTop: tokens.spaceLg },
});
