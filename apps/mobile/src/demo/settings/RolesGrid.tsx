import { type Level, levelOf, withExtra, withLevel } from '@soirely/domain';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';
import { Caps, Card } from './parts.tsx';
import { AREAS, type Extra, extrasFor, LEVEL_WORDS, levelsFor, lockedLine } from './RolesSample.ts';

const SEGMENT_HEIGHT = tokens.sizeHit;
const SEGMENT_BESIDE = 264;
const TICK = 14;
const TICK_GAP = 5;

interface Option<T extends string> {
  value: T;
  label: string;
}

/** Nothing, Read and Change as one control: each a 44 pt radio, the chosen one white on the track. */
export function Segment<T extends string>({
  name,
  options,
  value,
  onPick,
  testID,
}: {
  name: string;
  options: readonly Option<T>[];
  value: T;
  onPick: (value: T) => void;
  testID: string;
}) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map((option) => {
        const on = option.value === value;

        return (
          <Pressable
            key={option.value}
            style={[styles.cell, on && styles.cellOn]}
            onPress={() => onPick(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${name}, ${option.label}`}
            testID={`${testID}.${option.value}`}
          >
            <View>
              {on && (
                <View style={styles.tick}>
                  <Glyph name="tick" size={TICK} ink={tokens.colorAccentText} weight={2.6} />
                </View>
              )}
              <Text
                size={14.5}
                weight={on ? 'semibold' : 'medium'}
                numberOfLines={1}
                accessible={false}
                style={on ? styles.accent : styles.secondary}
              >
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function GridRow<T extends string>({
  phone,
  name,
  means,
  fixed,
  options,
  value,
  onPick,
  locked,
  extra = false,
  testID,
}: {
  phone: boolean;
  name: string;
  means: string;
  fixed: string | null;
  options: readonly Option<T>[];
  value: T;
  onPick: (value: T) => void;
  locked: string | null;
  extra?: boolean;
  testID: string;
}) {
  const words = (
    <View style={phone ? styles.wordsStacked : styles.wordsBeside}>
      <Text size={extra ? 15.5 : 16} weight="semibold">
        {name}
      </Text>
      <Text size={13.5} weight="medium" style={styles.secondary}>
        {means}
      </Text>
    </View>
  );
  const control =
    fixed != null ? (
      <View style={[styles.fixed, !phone && styles.fixedBeside]}>
        <Text size={15.5} weight="semibold" testID={`${testID}.fixed`}>
          {fixed}
        </Text>
      </View>
    ) : (
      <View style={phone ? undefined : styles.beside}>
        <Segment name={name} options={options} value={value} onPick={onPick} testID={testID} />
      </View>
    );

  return (
    <View style={styles.rowStack}>
      <View style={phone ? styles.stacked : styles.inline}>
        {words}
        {control}
      </View>
      {locked != null && (
        <Text size={13} weight="medium" style={styles.secondary}>
          {lockedLine(locked)}
        </Text>
      )}
    </View>
  );
}

/** One row per area, each extra set in under its area while the area is not Nothing. */
export function Grid({
  grant,
  held,
  editable,
  phone,
  onChange,
}: {
  grant: string[];
  held: string[];
  editable: boolean;
  phone: boolean;
  onChange: (grant: string[]) => void;
}) {
  return (
    <Card gap={0}>
      <Caps text="In each area, this role can" top={2} />
      {AREAS.map((area, index) => {
        const level = levelOf(grant, area.area);
        const levels = editable ? levelsFor(grant, held, area) : [];
        const locked = editable && levels.length < 2;
        const extras = level === 'nothing' ? [] : extrasFor(area);

        return (
          <Fragment key={area.area}>
            {index > 0 && <View style={styles.rule} />}
            <View style={styles.area}>
              <GridRow<Level>
                phone={phone}
                name={area.name}
                means={area.means}
                fixed={editable && !locked ? null : LEVEL_WORDS[level]}
                options={levels.map((value) => ({ value, label: LEVEL_WORDS[value] }))}
                value={level}
                onPick={(value) => onChange(withLevel(grant, area.area, value, area.permissions))}
                locked={locked ? area.name : null}
                testID={`roles.area.${area.area}`}
              />
              {extras.map((extra) => (
                <ExtraRow
                  key={extra.permission}
                  extra={extra}
                  grant={grant}
                  locked={editable && !held.includes(extra.permission)}
                  editable={editable}
                  phone={phone}
                  onChange={onChange}
                />
              ))}
            </View>
          </Fragment>
        );
      })}
    </Card>
  );
}

function ExtraRow({
  extra,
  grant,
  locked,
  editable,
  phone,
  onChange,
}: {
  extra: Extra;
  grant: string[];
  locked: boolean;
  editable: boolean;
  phone: boolean;
  onChange: (grant: string[]) => void;
}) {
  const on = grant.includes(extra.permission);

  return (
    <View style={styles.extra}>
      <GridRow<'off' | 'on'>
        phone={phone}
        extra
        name={extra.name}
        means={extra.means}
        fixed={editable && !locked ? null : on ? extra.on : extra.off}
        options={[
          { value: 'off', label: extra.off },
          { value: 'on', label: extra.on },
        ]}
        value={on ? 'on' : 'off'}
        onPick={(value) => onChange(withExtra(grant, extra.permission, value === 'on'))}
        locked={locked ? extra.name : null}
        testID={`roles.extra.${extra.permission}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    alignSelf: 'stretch',
    minHeight: SEGMENT_HEIGHT,
    flexDirection: 'row',
    borderRadius: SEGMENT_HEIGHT / 2,
    backgroundColor: tokens.colorNeutralFill,
  },
  cell: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: SEGMENT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: SEGMENT_HEIGHT / 2,
    borderWidth: 3,
    borderColor: tokens.colorNeutralFill,
  },
  cellOn: { backgroundColor: tokens.colorCard },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '100%',
    marginRight: TICK_GAP,
    justifyContent: 'center',
  },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  wordsStacked: { gap: 2 },
  wordsBeside: { flex: 1, minWidth: 0, gap: 2 },
  rowStack: { gap: tokens.spaceSm },
  stacked: { gap: tokens.spaceMd },
  inline: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXl },
  beside: { minWidth: SEGMENT_BESIDE },
  fixed: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  fixedBeside: { minWidth: SEGMENT_BESIDE, alignItems: 'flex-end' },
  area: { paddingVertical: 14 },
  rule: { height: 1, backgroundColor: tokens.colorBorder },
  extra: {
    marginTop: tokens.spaceLg,
    marginLeft: tokens.spaceXs,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: tokens.colorBorder,
  },
});
