import { type ReactNode, type Ref, type RefObject, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, StyleSheet, View, type ViewInstance } from 'react-native';

import { type LayoutKind } from '../layout/classify.ts';
import { actionsUnder } from '../layout/titleFit.ts';
import { tokens } from '../theme/tokens.ts';
import { BellInPane, PaneBell } from './BellButton.tsx';
import { type TextHandle } from './Text.tsx';
import { BodyTitle, MeasuredWords } from './Title.tsx';
import { TopPrimary, usePrimaryLabel } from './TopPrimary.tsx';
import { COLUMN_TITLE, PAGE_TITLE, columnTitle, pageTitle } from './topTitle.ts';

/** Guests' title row as `/demo/guests` draws it: the title whole, then Export, the + and on its side the bell; where the title at its default size has no room beside them, Export and the + go together to a row under it, the bell staying on the title's row (sc-51444, sc-67659, sc-68417). */
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
    gap: tokens.spaceSm,
    labelled: !phone,
  });
  const bell = useContext(BellInPane);
  const [room, setRoom] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  const [exportWidth, setExportWidth] = useState(0);
  const under = actionsUnder({
    room,
    title: titleWidth,
    extra: exports == null ? 0 : exportWidth,
    plus: onAdd == null ? 0 : tokens.sizeHit,
    bell: bell ? tokens.sizeHit : 0,
    gap: tokens.spaceMd,
  });
  const widthOf = (set: (width: number) => void) => (event: LayoutChangeEvent) =>
    set(Math.ceil(event.nativeEvent.layout.width));

  const heading = (
    <View style={styles.fill} onLayout={label.onSlot}>
      {label.measure}
      <BodyTitle size={size} accessibilityRole="header" ref={titleRef} style={style}>
        {title}
      </BodyTitle>
    </View>
  );
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
            {!phone && refreshing}
            <PaneBell />
          </View>
          <View style={styles.actions} testID="guests.actionsRow">
            {actions}
          </View>
        </>
      ) : (
        <View style={styles.row}>
          {heading}
          {!phone && refreshing}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  stack: { gap: tokens.spaceSm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
});
