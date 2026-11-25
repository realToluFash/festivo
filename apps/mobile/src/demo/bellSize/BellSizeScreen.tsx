import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewInstance, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bell } from '../../components/BellButton.tsx';
import { QuietButton } from '../../components/Buttons.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { Refreshing } from '../../components/Refreshing.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import type { Anchor } from '../../components/Summary.tsx';
import { AnchoredMenu } from '../../components/SummaryOverlays.tsx';
import { TextAction } from '../../components/SummaryRows.tsx';
import type { TextHandle } from '../../components/Text.tsx';
import { MeasuredWords, Title } from '../../components/Title.tsx';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { FILTER_SIZES, type FilterSize, filterScale } from '../filterSize/filterSizeRules.ts';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { measuredUnder } from '../measuredUnder.ts';
import { openOnceSettled } from '../menuSettles.ts';
import { FitWords } from '../todaySize/FitWords.tsx';
import { piecesOfLine } from '../todaySize/todaySizeRules.ts';
import {
  BELL_LANGUAGES,
  BELL_READS,
  type BellLanguage,
  type BellRead,
  HEADING,
  UNDER_GAP,
  BESIDE_GAP,
  markAllSize,
  markAllStart,
  markAllUnder,
} from './bellSizeRules.ts';
import { BellSampleBody, unreadAt } from './BellSamples.tsx';
import { PhoneBellScreen } from './PhoneBellScreen.tsx';

export interface BellSizeStart {
  size: FilterSize;
  language: BellLanguage;
  read: BellRead;
  refreshing: boolean;
}

const MENU_AFTER_MS = 300;
const HEADING_LINE = 1.2;

/** sc-92580: the iPad bell's 380 panel under the bell at a stand-in text size and language, its heading whole on one line and Mark all read whole beside it or, where the two cannot share the row, under it. */
export function BellSizeScreen({ start }: { start: BellSizeStart }) {
  const { i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [read, setRead] = useState(start.read);
  const [refreshing, setRefreshing] = useState(start.refreshing);
  const [open, setOpen] = useState(true);
  const [at, setAt] = useState<Anchor | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [told, setTold] = useState<string | null>(null);
  const [drawnAt, setDrawnAt] = useState<string | null>(null);
  const [unread, setUnread] = useState<ReadonlySet<string>>(() => unreadAt(start.read));
  const bellRef = useRef<ViewInstance>(null);
  const heading = useRef<TextHandle>(null);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const scale = filterScale(size, fontScale);
  const phone = kind === 'phone';

  useEffect(() => {
    if (phone || !open) return undefined;
    return openOnceSettled(measuredUnder(bellRef), setAt, MENU_AFTER_MS);
  }, [phone, open]);

  useEffect(() => {
    if (at == null) return undefined;
    const wait = setTimeout(() => moveScreenReaderFocus(heading.current), SETTLED_MS);

    return () => clearTimeout(wait);
  }, [at]);

  const close = () => {
    setOpen(false);
    setAt(null);
    setMenu(null);
  };

  if (phone) return <PhoneBellScreen start={start} />;

  return (
    <I18nextProvider i18n={words}>
      <View style={[styles.page, styles.side, { paddingTop: insets.top + tokens.spaceXl }]}>
        <Page
          unread={unread.size}
          bellRef={bellRef}
          onBell={() => {
            setTold(null);
            setOpen(true);
          }}
        />
        <DemoOnly title="Stand-ins for the device’s text size, its language, whether anything is unread, and the refreshing mark. Only the panel’s top draws at the size chosen; its list is main’s at this device’s size. The heading grows as on main and, from AX1, steps down only to the largest size at which its own word fits the panel, never under 18. Mark all read grows as on main, breaks only between its words, and steps down only for its widest word, never under 15. Where the two cannot each be whole on one line side by side, Mark all read moves onto its own line under the heading, at its start. Close the panel to change these; the bell opens it again. Nothing is sent and no string is added.">
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
              setUnread(unreadAt(next));
            }}
            id="read"
            prefix="demo.bellSize"
          />
          <QuietButton
            label={refreshing ? 'Hide the refreshing mark' : 'Show the refreshing mark'}
            onPress={() => setRefreshing((now) => !now)}
            testID="demo.bellSize.toggleRefreshing"
          />
        </DemoOnly>
        <AnchoredMenu
          at={open ? at : null}
          opener={bellRef}
          onClose={close}
          width={380}
          align="end"
          head={
            <PanelTop
              scale={scale}
              heading={heading}
              refreshing={refreshing}
              off={unread.size === 0}
              onReport={setDrawnAt}
              onMarkAll={(said) => {
                setUnread(new Set());
                setTold(said);
                readOut(said);
              }}
            />
          }
          testID="demo.bellSize.panel"
        >
          <View style={styles.popover}>
            <BellSampleBody
              unread={unread}
              menu={menu}
              onMenu={setMenu}
              onPick={(row) => {
                setUnread((now) => new Set([...now].filter((id) => id !== row.id)));
                setTold(`${row.title}: opens its page, as on main.`);
              }}
              onSettings={() => setTold('Notification settings opens, as on main.')}
            />
            <View style={styles.told}>
              <DemoOnly
                title={[drawnAt, told == null ? null : `Said: ${told}`]
                  .filter((line) => line != null)
                  .join(' ')}
              >
                {null}
              </DemoOnly>
            </View>
          </View>
        </AnchoredMenu>
      </View>
    </I18nextProvider>
  );
}

/** What stands under the panel: Today's title and the bell, its right edge where the panel's lines up. */
function Page({
  unread,
  bellRef,
  onBell,
}: {
  unread: number;
  bellRef: RefObject<ViewInstance | null>;
  onBell: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.titleRow}>
      <View style={styles.fill}>
        <Title size={tokens.typeTitleFrameCompact.size} accessibilityRole="header">
          {t('todayScreen.tab.today')}
        </Title>
      </View>
      <Bell ref={bellRef} unread={unread} onPress={onBell} testID="demo.bellSize.bell" />
    </View>
  );
}

/** The panel's top: the heading, whole on one line, and Mark all read beside it or under it. */
function PanelTop({
  scale,
  heading,
  refreshing,
  off,
  onMarkAll,
  onReport,
}: {
  scale: number;
  heading: RefObject<TextHandle | null>;
  refreshing: boolean;
  off: boolean;
  onMarkAll: (said: string) => void;
  onReport: (drawn: string) => void;
}) {
  const { t } = useTranslation();
  const name = t('notifications.heading');
  const label = t('notifications.markAllRead');
  const pieces = piecesOfLine(label);
  const start = markAllStart(scale);
  const [room, setRoom] = useState(0);
  const [drawn, setDrawn] = useState<number | null>(null);
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const widthOf = (key: string) => widths[key] ?? 0;
  const widest = pieces.every((piece) => widths[`${start}|${piece}`] != null)
    ? Math.max(...pieces.map((piece) => widthOf(`${start}|${piece}`)))
    : null;
  const accessible = atAccessibilitySizes(scale);
  const markAt = widest == null || room === 0 ? start : markAllSize(scale, widest, room);
  const headingAt = drawn ?? HEADING * scale;
  const under = markAllUnder({
    room,
    heading: widthOf(`${headingAt}|${name}`),
    markAll: widthOf(`${markAt}|${label}`),
  });
  const pending =
    room === 0 ||
    (accessible && (widest == null || drawn == null)) ||
    widths[`${headingAt}|${name}`] == null ||
    widths[`${markAt}|${label}`] == null;
  const report = pending
    ? null
    : `The heading draws at ${tenths(headingAt)}, Mark all read at ${tenths(markAt)}, ${under ? 'under the heading' : 'beside it'}.`;

  useEffect(() => {
    if (report != null) onReport(report);
  }, [report, onReport]);

  const keep = (key: string, width: number) =>
    setWidths((now) => (now[key] === width ? now : { ...now, [key]: width }));

  return (
    <View style={styles.popoverHead}>
      <MeasuredWords
        words={pieces}
        size={start}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(piece, width) => keep(`${start}|${piece}`, width)}
      />
      <MeasuredWords
        words={[label]}
        size={markAt}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(whole, width) => keep(`${markAt}|${whole}`, width)}
      />
      <MeasuredWords
        words={[name]}
        size={headingAt}
        weight="bold"
        allowFontScaling={false}
        onWidth={(whole, width) => keep(`${headingAt}|${whole}`, width)}
      />
      <View
        style={[styles.bellHead, under && styles.bellHeadUnder, pending && styles.waiting]}
        onLayout={(event) => setRoom(Math.floor(event.nativeEvent.layout.width))}
        testID={under ? 'demo.bellSize.top.under' : 'demo.bellSize.top.beside'}
      >
        <View style={[styles.titleLine, !under && styles.fill]}>
          <FitWords
            ref={heading}
            text={name}
            size={HEADING}
            scale={scale}
            cap={Number.POSITIVE_INFINITY}
            room={room}
            weight="bold"
            line={HEADING_LINE}
            role="header"
            onDrawn={setDrawn}
            testID="demo.bellSize.heading"
          />
          {refreshing && <Refreshing testID="demo.bellSize.refreshing" />}
        </View>
        <TextAction
          label={label}
          off={off}
          wraps
          drawnAt={markAt}
          onPress={() => onMarkAll(t('notifications.allRead'))}
          testID="demo.bellSize.markAllRead"
        />
      </View>
    </View>
  );
}

function tenths(size: number): string {
  return String(Math.round(size * 10) / 10);
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  side: { gap: tokens.spaceXl, paddingHorizontal: tokens.space5xl },
  fill: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  popoverHead: { paddingTop: tokens.spaceSm, paddingHorizontal: tokens.spaceXl },
  popover: { paddingHorizontal: tokens.spaceXl, paddingBottom: tokens.spaceXs },
  bellHead: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BESIDE_GAP,
  },
  bellHeadUnder: { flexDirection: 'column', alignItems: 'flex-start', gap: UNDER_GAP },
  titleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceMd,
  },
  waiting: { opacity: 0 },
  told: { paddingTop: tokens.spaceLg },
});
