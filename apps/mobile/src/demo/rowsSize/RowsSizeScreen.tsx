import { initials } from '@soirely/domain';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { SchemeTile } from '../../components/SchemeParts.tsx';
import { rowSide, settingsRowStyles } from '../../components/SettingsHome.tsx';
import { Caps, Tile } from '../../components/SettingsParts.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { useShellLayout } from '../../components/settingsShell.ts';
import { labelStart, lineStart, piecesIn } from '../../layout/textSize.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { defaultScheme, tokens } from '../../theme/tokens.ts';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { frameTitleCap } from '../frameTitleCap.ts';
import { settingsHref } from '../settings/Route.tsx';
import { signOutRoom } from '../signOutSize/signOutSizeRules.ts';
import {
  ORGANISATION_NAMES,
  ROWS_LANGUAGES,
  ROWS_NAMES,
  ROWS_SIZES,
  labelSize,
  rowType,
  rowsScale,
  type RowsLanguage,
  type RowsName,
  type RowsSize,
} from './rowsSizeRules.ts';

export interface RowsSizeStart {
  size: RowsSize;
  language: RowsLanguage;
  name: RowsName;
}

type Section =
  'security' | 'notifications' | 'personalisation' | 'organisation' | 'members' | 'signInRules';

const GROUPS: readonly { heading: string; sections: readonly Section[] }[] = [
  { heading: 'yourAccount', sections: ['security', 'notifications', 'personalisation'] },
  { heading: 'organisationHeading', sections: ['organisation', 'members', 'signInRules'] },
];

interface RowWords {
  key: Section;
  title: string;
  line: string;
}

/** Settings' six rows, as the owner of QA Organisation sees them, at a text size and language the board chooses: each label steps down alone, by whole words, only as far as its widest word needs (sc-69816). */
export function RowsSizeScreen({ start }: { start: RowsSizeStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
  const layout = useShellLayout();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [name, setName] = useState(start.name);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const t = words.t.bind(words);
  const scale = rowsScale(size, fontScale);
  const dense = layout === 'landscape';
  const cap = frameTitleCap(layout !== 'phone', Math.min(windowWidth, windowHeight), scale);
  const room = signOutRoom(layout, windowWidth);
  const groups = GROUPS.map(({ heading, sections }) => ({
    heading: t(`settings.${heading}`),
    rows: sections.map((section): RowWords => ({
      key: section,
      title: section === 'organisation' ? ORGANISATION_NAMES[name] : t(`settings.${section}`),
      line: t(`settings.${section}Line`),
    })),
  }));
  const group = (each: (typeof groups)[number]) => (
    <View key={each.heading} style={{ width: room }}>
      <Caps text={each.heading} top={tokens.spaceXl} />
      <View style={settingsRowStyles.group}>
        {each.rows.map((row, index) => (
          <DemoRow
            key={row.key}
            row={row}
            first={index === 0}
            dense={dense}
            scale={scale}
            cap={cap}
            organisation={ORGANISATION_NAMES[name]}
          />
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.body,
        {
          paddingTop: insets.top + tokens.space3xl,
          paddingBottom: insets.bottom + tokens.space6xl,
        },
      ]}
    >
      <View style={{ width: layout === 'portrait' ? 2 * room + tokens.space3xl : room }}>
        <DemoOnly title="Stand-ins for the device’s own text size and language. The six rows are drawn at the size chosen and as wide as main gives them: the phone’s page, two columns upright on an iPad, the list column on its side. Each title and its line grow to the page title’s size, 43 from the ninth step, then step down alone, only as far as the widest word needs, never under main’s default size. The line never draws larger than its title. One tap opens the row’s page. No string is added.">
          <Choices
            heading="Text size"
            options={ROWS_SIZES}
            chosen={size}
            onChoose={setSize}
            id="size"
            prefix="demo.rowsSize"
          />
          <Choices
            heading="Language"
            options={ROWS_LANGUAGES}
            chosen={language}
            onChoose={setLanguage}
            id="language"
            prefix="demo.rowsSize"
          />
          <Choices
            heading="Organisation"
            options={ROWS_NAMES}
            chosen={name}
            onChoose={setName}
            id="name"
            prefix="demo.rowsSize"
          />
        </DemoOnly>
      </View>
      {layout === 'portrait' ? (
        <View style={styles.columns}>{groups.map(group)}</View>
      ) : (
        groups.map(group)
      )}
    </ScrollView>
  );
}

/** A row as main draws it, its tile, › and rule where main has them; only its two labels are sized by the proposal. */
function DemoRow({
  row,
  first,
  dense,
  scale,
  cap,
  organisation,
}: {
  row: RowWords;
  first: boolean;
  dense: boolean;
  scale: number;
  cap: number;
  organisation: string;
}) {
  const type = rowType(dense);
  const side = rowSide(dense);
  const [room, setRoom] = useState(0);
  const titleStart = labelStart(type.title, scale, cap);
  const [title, setTitle] = useState(titleStart);

  return (
    <Pressable
      onPress={() => router.push(settingsHref('owner', row.key))}
      style={({ pressed }) => [
        settingsRowStyles.row,
        dense && settingsRowStyles.rowDense,
        pressed && settingsRowStyles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${row.title}. ${row.line}`}
      testID={`demo.rowsSize.${row.key}`}
    >
      {!first && <View style={[styles.rule, { left: tokens.spaceXl + side + 12 }]} />}
      {row.key === 'personalisation' ? (
        <SchemeTile side={side} scheme={defaultScheme} />
      ) : (
        <Tile
          of={row.key}
          side={side}
          initials={row.key === 'organisation' ? initials(organisation) : undefined}
        />
      )}
      <View
        style={settingsRowStyles.rowWords}
        onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
      >
        <DemoLabel
          text={row.title}
          size={type.title}
          start={titleStart}
          room={room}
          weight="semibold"
          onDrawn={setTitle}
        />
        <DemoLabel
          text={row.line}
          size={type.line}
          start={lineStart(type.line, scale, cap, title)}
          room={room}
          weight="medium"
          secondary
        />
      </View>
      <Glyph name="chevron" size={18} ink={tokens.colorInkTertiary} weight={2.2} />
    </Pressable>
  );
}

/** A label measured piece by piece at its start (words, split after their hyphens), drawn at the largest size its widest piece fits `room`, never under `size`. */
function DemoLabel({
  text,
  size,
  start,
  room,
  weight,
  secondary = false,
  onDrawn,
}: {
  text: string;
  size: number;
  start: number;
  room: number;
  weight: 'semibold' | 'medium';
  secondary?: boolean;
  onDrawn?: (drawn: number) => void;
}) {
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const key = `${start}|${text}`;
  const each = piecesIn([text]);
  const widths = measured.key === key ? measured.widths : {};
  const widest = each.every((word) => widths[word] != null)
    ? Math.max(...each.map((word) => widths[word] ?? 0))
    : null;
  const drawn = widest == null || room === 0 ? start : labelSize(size, start, widest, room);

  useEffect(() => onDrawn?.(drawn), [onDrawn, drawn]);

  return (
    <>
      <MeasuredWords
        words={each}
        size={start}
        weight={weight}
        allowFontScaling={false}
        onWidth={(word, width) =>
          setMeasured((now) => {
            const kept = now.key === key ? now.widths : {};

            return kept[word] === width ? now : { key, widths: { ...kept, [word]: width } };
          })
        }
      />
      <Text
        size={drawn}
        weight={weight}
        allowFontScaling={false}
        accessible={false}
        style={secondary ? settingsRowStyles.secondary : undefined}
      >
        {text}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  body: { alignItems: 'center', gap: tokens.spaceXl },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space3xl },
  rule: { position: 'absolute', right: 0, top: 0, height: 1, backgroundColor: tokens.colorBorder },
});
