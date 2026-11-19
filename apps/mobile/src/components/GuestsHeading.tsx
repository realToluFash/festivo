import {
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  StyleSheet,
  type TextLayoutEvent,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';

import { type LayoutKind } from '../layout/classify.ts';
import { titleSize } from '../layout/textSize.ts';
import { actionsUnder, brokeOn, titleRowKey } from '../layout/titleFit.ts';
import { tokens } from '../theme/tokens.ts';
import { BellInPane, PaneBell } from './BellButton.tsx';
import { type TextHandle } from './Text.tsx';
import { BodyTitle, MeasuredWords, PageTitleDrawn, usePageTitleDrawn } from './Title.tsx';
import { TopPrimary, usePrimaryLabel } from './TopPrimary.tsx';
import { COLUMN_TITLE, PAGE_TITLE, columnTitle, pageTitle } from './topTitle.ts';

/** Guests' title row as `/demo/guests` draws it: the title whole, stepping down from its slot's width, then Export, the + and on its side the bell; where the title at its default size has no room beside them, or broke there all the same, Export and the + go together to a row under it, the bell staying on the title's row (sc-51444, sc-67659, sc-68417). */
export function GuestsHeading({
  kind,
  titleRef,
  refreshing,
  exports,
  onAdd,
  addRef,
}: {
  kind: LayoutKind;
  titleRef: RefObject<TextHandle | null>;
  refreshing: ReactNode;
  exports: ReactNode;
  onAdd: (() => void) | null;
  addRef: Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const phone = kind === 'phone';
  const title = t('eventNav.guests');
  const size = kind === 'tabletLandscape' ? COLUMN_TITLE : PAGE_TITLE;
  const style = kind === 'tabletLandscape' ? columnTitle : pageTitle;
  const label = usePrimaryLabel({
    title,
    size,
    style,
    label: onAdd != null ? t('guestList.addGuest') : undefined,
    gap: tokens.spaceMd,
    labelled: !phone,
  });
  const bell = useContext(BellInPane);
  const { fontScale } = useWindowDimensions();
  const [room, setRoom] = useState(0);
  const [slot, setSlot] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  const [exportWidth, setExportWidth] = useState(0);
  const [spinnerWidth, setSpinnerWidth] = useState(0);
  const spinning = !phone && refreshing != null;
  const pageDrawn = usePageTitleDrawn();
  const drawn = useRef(0);
  const [broke, setBroke] = useState<string | null>(null);
  const rowKey = titleRowKey({ room, title, fontScale, spinning });
  const under =
    broke === rowKey ||
    actionsUnder({
      room,
      title: titleWidth,
      extra: exports == null ? 0 : exportWidth,
      plus: onAdd == null ? 0 : tokens.sizeHit,
      bell: bell ? tokens.sizeHit : 0,
      refreshing: spinning ? spinnerWidth : 0,
      gap: tokens.spaceMd,
    });
  const onDrawn = useCallback(
    (next: number) => {
      drawn.current = next;
      pageDrawn?.(next);
    },
    [pageDrawn],
  );
  const onTitleLines = (event: TextLayoutEvent) => {
    const start = titleSize(size, fontScale);
    setBroke((was) =>
      brokeOn({
        broke: was,
        row: rowKey,
        under,
        lines: event.nativeEvent.lines,
        drawn: drawn.current || start,
        start,
        size,
        slot,
        title: titleWidth,
      }),
    );
  };
  const widthOf = (set: (width: number) => void) => (event: LayoutChangeEvent) =>
    set(Math.ceil(event.nativeEvent.layout.width));

  const heading = (
    <View
      style={styles.fill}
      onLayout={(event) => {
        label.onSlot(event);
        setSlot(Math.floor(event.nativeEvent.layout.width));
      }}
    >
      {label.measure}
      <PageTitleDrawn.Provider value={onDrawn}>
        <BodyTitle
          size={size}
          accessibilityRole="header"
          ref={titleRef}
          style={style}
          room={slot}
          onTextLayout={onTitleLines}
        >
          {title}
        </BodyTitle>
      </PageTitleDrawn.Provider>
    </View>
  );
  const spinner = spinning && <View onLayout={widthOf(setSpinnerWidth)}>{refreshing}</View>;
  const actions = (
    <>
      {exports != null && (
        <View style={under && styles.shrink} onLayout={widthOf(setExportWidth)}>
          {exports}
        </View>
      )}
      {onAdd != null && (
        <TopPrimary
          ref={addRef}
          label={t('guestList.addGuest')}
          onPress={onAdd}
          wide={label.wide && !under}
          testID="guests.add"
        />
      )}
    </>
  );

  return (
    <View style={under && styles.stack} onLayout={widthOf(setRoom)} testID="guests.titleRow">
      <MeasuredWords
        words={[title]}
        size={size}
        weight="bold"
        style={style}
        maxFontSizeMultiplier={1}
        onWidth={(_, width) => setTitleWidth(Math.ceil(width))}
      />
      {under ? (
        <>
          <View style={styles.row}>
            {heading}
            {spinner}
            <PaneBell />
          </View>
          <View style={styles.actions} testID="guests.actionsRow">
            {actions}
          </View>
        </>
      ) : (
        <View style={styles.row}>
          {heading}
          {spinner}
          {actions}
          <PaneBell />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  stack: { gap: tokens.spaceSm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
});
