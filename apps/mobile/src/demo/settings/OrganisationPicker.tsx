import {
  countryChoices,
  currencyChoices,
  languageChoices,
  timezoneLabel,
  withCurrent,
} from '@soirely/domain';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { TextField } from '../../components/Field.tsx';
import { LIFT } from '../../components/keyboardWatch.ts';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { type Picked, SAMPLE_DETAILS } from './OrganisationModel.ts';
import { DETAILS_WORDS as W, LANGUAGE_NAMES } from './OrganisationWords.ts';
import { Row } from './Summary.tsx';

export interface Choice {
  code: string;
  name: string;
}

const SHOWN_IN = 'en';

let made: Record<Picked, readonly Choice[]> | null = null;

/** Every list the details pick from, made once: naming every country, currency and zone is slow on a phone. */
export function organisationChoices(): Record<Picked, readonly Choice[]> {
  made ??= {
    countryCode: countryChoices(SHOWN_IN),
    currency: currencyChoices(SAMPLE_DETAILS.currency, SHOWN_IN, W.currencyRetired),
    timezone: withCurrent(Intl.supportedValuesOf('timeZone'), SAMPLE_DETAILS.timezone).map(
      (zone) => ({ code: zone, name: timezoneLabel(zone) }),
    ),
    locale: languageChoices((key) => LANGUAGE_NAMES[key] ?? key),
  };

  return made;
}

export function choiceName(field: Picked, code: string): string {
  if (field === 'currency' && code === '') return W.currencyPlaceholder;

  return organisationChoices()[field].find((choice) => choice.code === code)?.name ?? code;
}

export const PICKERS: Record<Picked, { label: string; search: string; testID: string }> = {
  countryCode: { label: W.country, search: W.searchCountry, testID: 'organisation.country' },
  currency: { label: W.currency, search: W.searchCurrency, testID: 'organisation.currency' },
  timezone: { label: W.timezone, search: W.searchTimezone, testID: 'organisation.timezone' },
  locale: { label: W.language, search: W.searchLanguage, testID: 'organisation.language' },
};

/** A row of 52 and the hairline under it, so the list can open on the current choice. */
const ROW = 53;

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** A field's list in the details screen's own surface: search, then rows of 52, the current one ticked. */
export function PickerList({
  field,
  value,
  onChoose,
}: {
  field: Picked;
  value: string;
  onChoose: (code: string) => void;
}) {
  const { search, testID } = PICKERS[field];
  const choices = organisationChoices()[field];
  const [needle, setNeedle] = useState('');
  const wanted = needle.trim().toLocaleLowerCase(SHOWN_IN);
  const shown =
    wanted === ''
      ? choices
      : choices.filter((choice) => choice.name.toLocaleLowerCase(SHOWN_IN).includes(wanted));
  const [current] = useState(() => choices.findIndex((choice) => choice.code === value));

  return (
    <View style={styles.fill}>
      <View style={styles.searchBox}>
        <TextField
          accessibilityLabel={search}
          placeholder={search}
          defaultValue=""
          onChangeText={setNeedle}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="search"
          style={styles.search}
          testID={`${testID}.search`}
        />
        <View style={styles.searchMark} pointerEvents="none" {...hidden}>
          <Glyph name="search" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
        </View>
      </View>
      <FlatList
        data={shown}
        keyExtractor={(choice) => choice.code}
        getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
        initialScrollIndex={current > 2 ? current - 2 : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={LIFT.adjustScrollInsets}
        style={styles.list}
        contentContainerStyle={styles.rows}
        ItemSeparatorComponent={Hairline}
        renderItem={({ item }) => {
          const on = item.code === value;

          return (
            <Row
              title={item.name}
              weight={on ? 'semibold' : 'medium'}
              accent={on}
              pad={tokens.spaceSm}
              trail={
                on ? (
                  <View {...hidden}>
                    <Glyph name="tick" size={18} ink={tokens.colorAccentText} weight={2.6} />
                  </View>
                ) : undefined
              }
              onPress={() => onChoose(item.code)}
              accessibilityLabel={item.name}
              accessibilityState={{ selected: on }}
              testID={`${testID}.${item.code}`}
            />
          );
        }}
      />
    </View>
  );
}

function Hairline() {
  return <View style={styles.hairline} />;
}

const styles = StyleSheet.create({
  fill: { flexShrink: 1, flexGrow: 1, minHeight: 0 },
  searchBox: {
    paddingTop: tokens.spaceLg,
    paddingBottom: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXxl,
  },
  search: { minHeight: 48, paddingLeft: 44 },
  searchMark: {
    position: 'absolute',
    left: tokens.spaceXxl + tokens.spaceLg,
    top: tokens.spaceLg,
    bottom: tokens.spaceSm,
    justifyContent: 'center',
  },
  list: { flexGrow: 0, flexShrink: 1 },
  rows: { paddingHorizontal: tokens.spaceXxl, paddingBottom: tokens.space5xl },
  hairline: { height: 1, backgroundColor: tokens.colorBorder },
});
