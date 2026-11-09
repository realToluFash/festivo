import {
  countryChoices,
  currencyChoices,
  languageChoices,
  type OrganisationDetails,
  type OrganisationField,
  timezoneLabel,
  withCurrent,
} from '@soirely/domain';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { currentLocale } from '../i18n/index.ts';
import { tokens } from '../theme/tokens.ts';
import { TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { LIFT } from './keyboardWatch.ts';
import { Row } from './Summary.tsx';

export type Picked = Exclude<OrganisationField, 'name' | 'contactAddress'>;

export interface Choice {
  code: string;
  name: string;
}

export type Choices = Record<Picked, readonly Choice[]>;

/** Every list the details pick from, in the reader's language, made once a page: naming every country, currency and zone is slow on a phone. */
export function useOrganisationChoices(held: OrganisationDetails): Choices {
  const { t } = useTranslation();
  const locale = currentLocale();

  return useMemo(
    () => ({
      countryCode: countryChoices(locale),
      currency: currencyChoices(held.currency, locale, (code) =>
        t('orgGeneral.currencyRetired', { code }),
      ),
      timezone: withCurrent(Intl.supportedValuesOf('timeZone'), held.timezone).map((zone) => ({
        code: zone,
        name: timezoneLabel(zone),
      })),
      locale: languageChoices(t),
    }),
    [held.currency, held.timezone, locale, t],
  );
}

export function choiceName(choices: Choices, field: Picked, code: string, blank: string): string {
  if (field === 'currency' && code === '') return blank;

  return choices[field].find((choice) => choice.code === code)?.name ?? code;
}

/** Each picker's label, search words and testID, as `orgGeneral.*` names them. */
export function usePickers(): Record<Picked, { label: string; search: string; testID: string }> {
  const { t } = useTranslation();

  return {
    countryCode: {
      label: t('orgGeneral.country'),
      search: t('orgGeneral.searchCountry'),
      testID: 'organisation.country',
    },
    currency: {
      label: t('orgGeneral.currency'),
      search: t('orgGeneral.searchCurrency'),
      testID: 'organisation.currency',
    },
    timezone: {
      label: t('orgGeneral.timezone'),
      search: t('orgGeneral.searchTimezone'),
      testID: 'organisation.timezone',
    },
    locale: {
      label: t('orgGeneral.language'),
      search: t('orgGeneral.searchLanguage'),
      testID: 'organisation.language',
    },
  };
}

/** A row of 52 and the hairline under it, so the list can open on the current choice. */
const ROW = 53;

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** A field's list in the details screen's own surface: search, then rows of 52, the current one ticked. */
export function PickerList({
  choices,
  search,
  testID,
  value,
  onChoose,
}: {
  choices: readonly Choice[];
  search: string;
  testID: string;
  value: string;
  onChoose: (code: string) => void;
}) {
  const locale = currentLocale();
  const [needle, setNeedle] = useState('');
  const wanted = needle.trim().toLocaleLowerCase(locale);
  const shown =
    wanted === ''
      ? choices
      : choices.filter((choice) => choice.name.toLocaleLowerCase(locale).includes(wanted));
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
