import {
  countrySearch,
  foundingCurrencyWords,
  newOrganisationLimit,
  timezoneLabel,
} from '@soirely/domain';
import {
  type ReactNode,
  type Ref,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  FlatList,
  type FlatListInstance,
  Keyboard,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  View,
} from 'react-native';

import { afterMount } from './afterMount.ts';
import { TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { DraftTile } from './DraftTile.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { glide } from '../motion.ts';
import { weight } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { EventNotice } from './EventNotice.tsx';
import {
  type Country,
  type Naming,
  type Walk,
  boxWords,
  cardNameSize,
  cardWords,
  countries,
  countryNoMatch,
  factsOf,
  NAME_LABEL,
  nameField,
  nameGap,
  nameRow,
  nameScroll,
  rowLabel,
} from '../kit/createWalk.ts';
import { FactLine, Question, Refusal, Tag, TWICE, ZoneLine } from './CreateWalkParts.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

export interface Look {
  phone: boolean;
  /** The phone at the accessibility sizes: the board's "twice the text". */
  large: boolean;
  /** A phone on its side with the keys up. */
  sideways: boolean;
}

function sizesOf({ phone, large }: Look) {
  return {
    question: phone ? 28 : 26,
    label: NAME_LABEL,
    field: nameField(large),
    fieldText: 16,
    help: 13.5,
    gap: nameGap(large),
  };
}

interface StepProps {
  walk: Walk;
  look: Look;
  naming: Naming;
  stepWords: string;
  question?: Ref<TextHandle> | undefined;
  answer: object | undefined;
  onScrolled: (scrolled: boolean) => void;
  /** Continue, when a phone on its side with the keys up scrolls it as the step's last part. */
  foot?: ReactNode;
}

function StepScroll({
  look,
  gap,
  scroller,
  onScrolled,
  onLayout,
  onContentSizeChange,
  children,
}: {
  look: Look;
  gap: number;
  scroller?: Ref<ScrollViewInstance>;
  onScrolled: (scrolled: boolean) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onContentSizeChange?: () => void;
  children: ReactNode;
}) {
  return (
    <ScrollView
      ref={scroller}
      style={look.phone ? styles.fill : styles.shrink}
      contentContainerStyle={[look.phone && styles.phoneBody, { gap }]}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={(event) => onScrolled(event.nativeEvent.contentOffset.y > 0)}
      onLayout={onLayout}
      onContentSizeChange={onContentSizeChange}
    >
      {children}
    </ScrollView>
  );
}

/** At twice the text, "Step n of 3" leaves the nav for the body, over the question. */
function StepWords({ look, words }: { look: Look; words: string }) {
  if (!look.large) return null;

  return (
    <Text maxFontSizeMultiplier={TWICE} size={13} weight="semibold" muted style={styles.stepWords}>
      {words}
    </Text>
  );
}

function Preview({ name }: { name: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.preview} {...hidden}>
      <DraftTile name={name} side={88} radius={28} initials={36} />
      {name.trim() !== '' && (
        <Text
          maxFontSizeMultiplier={TWICE}
          size={22}
          weight="bold"
          accessible={false}
          style={styles.previewName}
        >
          {name.trim()}
        </Text>
      )}
      <Text
        maxFontSizeMultiplier={TWICE}
        size={14}
        weight="medium"
        muted
        accessible={false}
        style={styles.previewRole}
      >
        {t('switcher.yourRole', { role: t('roles.owner') })}
      </Text>
    </View>
  );
}

export function NameStep({
  walk,
  look,
  stepWords,
  question,
  answer,
  onScrolled,
  foot,
  field,
  onTyped,
  onContinue,
  onLeft,
}: StepProps & {
  field: RefObject<TextInputInstance | null>;
  onTyped: (name: string) => void;
  onContinue: () => void;
  onLeft?: () => void;
}) {
  const { t } = useTranslation();
  const sizes = sizesOf(look);
  const [focused, setFocused] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);
  const [inSight] = useState(() => nameScroll(tokens.spaceLg, afterMount));
  const [labelWidth, setLabelWidth] = useState(0);
  const { beside } = nameRow(look);
  const underField = beside ? { marginLeft: labelWidth + tokens.spaceXl } : null;
  const refusal = walk.refusal;
  const edge = focused || refusal != null ? 2 : 1.5;
  const help = t('createOrganisation.nameHelp');

  const reveal = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    inSight.group(y, height);
  };
  const placeField = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    inSight.row(y, height, sizes.field);
  };

  useLayoutEffect(() => {
    inSight.scrollWith((y) => scroller.current?.scrollTo({ y, animated: true }));
    const shown = Keyboard.addListener('keyboardDidShow', inSight.keysUp);

    return () => shown.remove();
  }, [inSight]);

  return (
    <StepScroll
      look={look}
      gap={18}
      scroller={scroller}
      onScrolled={onScrolled}
      onLayout={(event) => inSight.viewport(event.nativeEvent.layout.height)}
      onContentSizeChange={inSight.contentSized}
    >
      <StepWords look={look} words={stepWords} />
      <Question ref={question} words={t('createOrganisation.whatTitle')} size={sizes.question} />
      {look.phone && !look.large && <Preview name={walk.name} />}
      <View style={{ gap: sizes.gap }} onLayout={reveal}>
        <View style={beside ? styles.nameBeside : { gap: sizes.gap }} onLayout={placeField}>
          <Text
            maxFontSizeMultiplier={TWICE}
            size={sizes.label}
            weight="semibold"
            {...hidden}
            accessible={false}
            onLayout={(event) => setLabelWidth(event.nativeEvent.layout.width)}
            style={[{ lineHeight: sizes.label * 1.3 }, beside && styles.nameLabelBeside]}
          >
            {t('createOrganisation.name')}
          </Text>
          <TextField
            maxFontSizeMultiplier={TWICE}
            ref={field}
            value={walk.name}
            onChangeText={onTyped}
            onSubmitEditing={onContinue}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onLeft?.();
            }}
            submitBehavior="submit"
            wrong={refusal != null}
            autoComplete="organization"
            textContentType="organizationName"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="next"
            accessibilityLabel={t('createOrganisation.name')}
            accessibilityHint={refusal ?? help}
            style={[
              styles.name,
              {
                height: sizes.field,
                minHeight: sizes.field,
                borderRadius: look.large ? 16 : 14,
                borderWidth: edge,
                borderColor:
                  refusal != null
                    ? tokens.colorBroken
                    : focused
                      ? tokens.colorAccent
                      : tokens.colorFieldBorder,
                paddingLeft: (look.large ? 18 : 16) - edge,
                paddingRight: (look.large ? 14 : 12) - edge,
                fontSize: sizes.fieldText,
              },
              beside && styles.nameFieldBeside,
            ]}
            testID="createWalk.name"
          />
        </View>
        {refusal != null ? (
          <View style={underField}>
            <Refusal words={refusal} size={sizes.help} answer={answer} />
          </View>
        ) : (
          <Text
            maxFontSizeMultiplier={TWICE}
            size={sizes.help}
            weight="medium"
            muted
            {...hidden}
            accessible={false}
            style={[{ lineHeight: sizes.help * 1.4 }, underField]}
          >
            {help}
          </Text>
        )}
      </View>
      {foot}
    </StepScroll>
  );
}

type Item = { kind: 'heading' } | { kind: 'country'; country: Country };

const HEADING: Item = { kind: 'heading' };

function GroupHeading({
  words,
  ruled = false,
  first = false,
}: {
  words: string;
  ruled?: boolean;
  first?: boolean;
}) {
  return (
    <View style={[styles.group, ruled && styles.groupRuled, first && styles.groupFirst]}>
      <Text
        maxFontSizeMultiplier={TWICE}
        size={12.5}
        weight="semibold"
        muted
        accessibilityRole="header"
        style={styles.groupWords}
      >
        {words}
      </Text>
    </View>
  );
}

function CountryRow({
  country,
  naming,
  picked,
  ruled,
  onPick,
}: {
  country: Country;
  naming: Naming;
  picked: boolean;
  ruled: boolean;
  onPick: (code: string) => void;
}) {
  const { t } = useTranslation();
  const currency = foundingCurrencyWords(country.code, naming.currencies, naming.locale, t);

  return (
    <Pressable
      onPress={() => onPick(country.code)}
      style={({ pressed }) => [
        styles.row,
        picked ? styles.rowPicked : ruled && styles.rowRuled,
        pressed && !picked && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={rowLabel(country, naming, t)}
      accessibilityState={{ selected: picked }}
      testID={`createWalk.country.${country.code}`}
    >
      <View style={styles.rowWords}>
        <Text
          maxFontSizeMultiplier={TWICE}
          size={16}
          weight="semibold"
          accessible={false}
          style={styles.rowName}
        >
          {country.name}
        </Text>
        {currency != null && (
          <Text
            maxFontSizeMultiplier={TWICE}
            size={13.5}
            weight="medium"
            muted
            accessible={false}
            style={styles.rowCurrency}
          >
            {currency.words}
          </Text>
        )}
      </View>
      {picked && (
        <View style={styles.disc} {...hidden}>
          <Glyph name="tick" size={15} ink={tokens.colorInkOnDark} weight={3} />
        </View>
      )}
    </Pressable>
  );
}

function CountrySearch({
  value,
  field,
  onQuery,
  onFocused,
}: {
  value: string;
  field: RefObject<TextInputInstance | null>;
  onQuery: (query: string) => void;
  onFocused: (focused: boolean) => void;
}) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const words = t('countryPicker.search');

  return (
    <View style={[styles.search, focused && styles.searchFocused]}>
      <Glyph name="search" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
      <TextField
        maxFontSizeMultiplier={TWICE}
        ref={field}
        value={value}
        onChangeText={onQuery}
        onFocus={() => {
          setFocused(true);
          onFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          onFocused(false);
        }}
        onSubmitEditing={() => Keyboard.dismiss()}
        placeholder={words}
        placeholderTextColor={tokens.colorInkSecondary}
        clearButtonMode="always"
        returnKeyType="search"
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="none"
        accessibilityRole="search"
        accessibilityLabel={words}
        style={styles.searchInput}
        testID="createWalk.search"
      />
      {Platform.OS !== 'ios' && value !== '' && (
        <Pressable
          onPress={() => {
            onQuery('');
            field.current?.focus();
          }}
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel={t('switcher.clearSearch')}
          testID="createWalk.search.clear"
        >
          <View style={styles.clearDot}>
            <Glyph name="x" size={11} ink={tokens.colorInkOnDark} weight={3} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

const PINNED = 40;

export function CountryStep({
  walk,
  look,
  naming,
  stepWords,
  question,
  answer,
  onScrolled,
  field,
  toPick,
  onQuery,
  onPick,
  onSearchFocused,
}: Omit<StepProps, 'foot'> & {
  field: RefObject<TextInputInstance | null>;
  /** Reached by Back, or opened at the list: it scrolls to the pick, unless the device's own is ticked at the top. */
  toPick: boolean;
  onQuery: (query: string) => void;
  onPick: (code: string) => void;
  onSearchFocused: (focused: boolean) => void;
}) {
  const { t } = useTranslation();
  const sizes = sizesOf(look);
  const list = useRef<FlatListInstance>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [pinned, setPinned] = useState(false);
  const scrolledToPick = useRef(false);
  const all = countries(naming.locale);
  const searching = walk.query.trim() !== '';
  const items: readonly Item[] = searching
    ? countrySearch(all, walk.query, naming.locale).map((country) => ({ kind: 'country', country }))
    : [HEADING, ...all.map((country): Item => ({ kind: 'country', country }))];
  const noMatch = countryNoMatch(walk.query, items.length, t);
  const device = all.find((country) => country.code === walk.device.country) ?? null;
  useReadOut(noMatch, { afterTyping: walk.query, quietAtMount: true });
  const pick = (code: string) => {
    Keyboard.dismiss();
    onPick(code);
  };

  useEffect(() => {
    const atTop = walk.country === device?.code;
    if (!toPick || searching || walk.country == null || atTop || scrolledToPick.current) return;
    const index = all.findIndex((country) => country.code === walk.country);
    if (index < 0) return;
    scrolledToPick.current = true;
    const wait = setTimeout(
      () => list.current?.scrollToIndex({ index: index + 1, viewPosition: 0.5, animated: false }),
      tokens.motionFast,
    );

    return () => clearTimeout(wait);
  }, [toPick, searching, walk.country, device?.code, all]);

  const top = (
    <>
      <StepWords look={look} words={stepWords} />
      <Question ref={question} words={t('createOrganisation.whereTitle')} size={sizes.question} />
      {walk.refusal != null && <Refusal words={walk.refusal} size={sizes.help} answer={answer} />}
      <CountrySearch
        value={walk.query}
        field={field}
        onQuery={onQuery}
        onFocused={onSearchFocused}
      />
    </>
  );
  const deviceGroup = !searching && device != null && (
    <View style={styles.deviceGroup}>
      <GroupHeading words={t('createOrganisation.fromDevice')} first />
      <CountryRow
        country={device}
        naming={naming}
        picked={walk.country === device.code}
        ruled={false}
        onPick={pick}
      />
    </View>
  );
  const header = (
    <View
      style={[styles.header, !look.phone && styles.headerWide]}
      onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
    >
      {look.phone && top}
      {deviceGroup}
    </View>
  );

  return (
    <View style={!look.phone && searching ? styles.shrink : styles.fill}>
      {!look.phone && <View style={styles.wideTop}>{top}</View>}
      <FlatList
        ref={list}
        data={items}
        keyExtractor={(item) => (item.kind === 'heading' ? 'all' : item.country.code)}
        renderItem={({ item, index }) =>
          item.kind === 'heading' ? (
            <GroupHeading words={t('createOrganisation.allCountries')} ruled={pinned} />
          ) : (
            <CountryRow
              country={item.country}
              naming={naming}
              picked={walk.country === item.country.code}
              ruled={index < items.length - 1}
              onPick={pick}
            />
          )
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          noMatch == null ? undefined : (
            <View style={styles.noMatch}>
              <Text
                size={15}
                weight="medium"
                style={styles.noMatchWords}
                testID="createWalk.countries.noMatch"
              >
                {noMatch}
              </Text>
            </View>
          )
        }
        stickyHeaderIndices={searching ? undefined : [1]}
        style={look.phone ? styles.fill : styles.wideList}
        contentContainerStyle={look.phone && styles.phoneList}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        initialNumToRender={24}
        onScroll={(event) => {
          const offset = event.nativeEvent.contentOffset.y;
          const pins = !searching && offset > headerHeight;
          onScrolled(offset > 0 && !pins);
          setPinned(pins);
        }}
        onScrollToIndexFailed={(failed) => {
          list.current?.scrollToOffset({
            offset: headerHeight + failed.averageItemLength * failed.index,
            animated: false,
          });
          setTimeout(
            () =>
              list.current?.scrollToIndex({
                index: failed.index,
                viewPosition: 0.5,
                animated: false,
              }),
            tokens.motionFast,
          );
        }}
        testID="createWalk.countries"
      />
    </View>
  );
}

/** What the country brings, over Continue on the phone: one element, said again when the pick changes. */
export function Brings({ walk, naming }: { walk: Walk; naming: Naming }) {
  const { t } = useTranslation();
  const words = boxWords(walk, t, naming);
  const currency = foundingCurrencyWords(walk.country, naming.currencies, naming.locale, t);

  useReadOut(words, { quietAtMount: true });

  return (
    <View style={styles.brings} accessible accessibilityLabel={words} testID="createWalk.brings">
      {currency != null && (
        <View style={styles.bringsPart}>
          <Text
            maxFontSizeMultiplier={TWICE}
            size={13}
            weight="medium"
            muted
            accessible={false}
            style={styles.factLabel}
          >
            {t('orgGeneral.currency')}
          </Text>
          <Text
            maxFontSizeMultiplier={TWICE}
            size={15}
            weight="semibold"
            muted={currency.none}
            accessible={false}
            style={styles.factValue}
          >
            {currency.words}
          </Text>
        </View>
      )}
      <View style={styles.bringsPart}>
        <View style={styles.tagged}>
          <Text
            maxFontSizeMultiplier={TWICE}
            size={13}
            weight="medium"
            muted
            accessible={false}
            style={styles.factLabel}
          >
            {t('orgGeneral.timezone')}
          </Text>
          <Tag />
        </View>
        <ZoneLine label={timezoneLabel(walk.device.zone)} />
      </View>
    </View>
  );
}

/** Where the panel's card sits, for its one element to be read after the question while it is drawn on the left. */
export interface CardFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function ReadyStep({
  walk,
  look,
  naming,
  stepWords,
  question,
  onScrolled,
  foot,
  email,
  locale,
  card,
}: StepProps & { email: string; locale: string; card: CardFrame | null }) {
  const { t } = useTranslation();
  const sizes = sizesOf(look);
  const limited = walk.sent === 'limited' ? newOrganisationLimit(walk.lifts, locale, t) : null;
  const failed = t('createOrganisation.failed');
  const words = cardWords(walk, email, t, naming);

  return (
    <StepScroll look={look} gap={16} onScrolled={onScrolled}>
      <StepWords look={look} words={stepWords} />
      <Question ref={question} words={t('createOrganisation.readyTitle')} size={sizes.question} />
      {limited != null && (
        <EventNotice
          tone="attention"
          words={limited.title}
          body={limited.body ?? undefined}
          interrupts
        />
      )}
      {walk.sent === 'failed' && <EventNotice tone="broken" words={failed} interrupts />}
      {look.phone ? (
        <View style={styles.card} accessible accessibilityLabel={words} testID="createWalk.card">
          <DraftTile name={walk.name} side={56} radius={19} initials={22} />
          <Text
            maxFontSizeMultiplier={TWICE}
            size={24}
            weight="bold"
            accessible={false}
            style={styles.cardName}
          >
            {walk.name.trim()}
          </Text>
          <Text
            maxFontSizeMultiplier={TWICE}
            size={14.5}
            weight="semibold"
            muted
            accessible={false}
            style={styles.cardRole}
          >
            {t('switcher.yourRole', { role: t('roles.owner') })}
          </Text>
          <View style={styles.facts}>
            {factsOf(walk, email, t, true, naming).map((fact) => (
              <View key={fact.key} style={look.large ? styles.factWhole : styles.factHalf}>
                <FactLine fact={fact} />
              </View>
            ))}
          </View>
        </View>
      ) : (
        card != null && (
          <View
            style={[styles.proxy, card]}
            pointerEvents="none"
            accessible
            accessibilityLabel={words}
            testID="createWalk.card"
          />
        )
      )}
      <Text maxFontSizeMultiplier={TWICE} size={15} weight="medium" style={styles.intro}>
        {t('createOrganisation.intro')}
      </Text>
      <Text maxFontSizeMultiplier={TWICE} size={14} weight="medium" muted style={styles.defaults}>
        {t('createOrganisation.defaults', { email })}
      </Text>
      {foot}
    </StepScroll>
  );
}

function FadeIn({ children }: { children: ReactNode }) {
  const [shown] = useState(() => new Animated.Value(0));

  useEffect(() => {
    glide(shown, 1, tokens.motionBase).start();
  }, [shown]);

  return <Animated.View style={{ opacity: shown }}>{children}</Animated.View>;
}

/** The panel's card on the left, built as the walk is answered; the steps' controls say all of it, so it is never read itself. */
export function WideCard({ walk, email, naming }: { walk: Walk; email: string; naming: Naming }) {
  const { t } = useTranslation();
  const name = walk.name.trim();
  const size = cardNameSize(name);
  const facts = walk.step === 1 ? [] : factsOf(walk, email, t, walk.step === 3, naming);

  return (
    <View style={styles.wide} {...hidden}>
      <DraftTile name={name} side={72} radius={24} initials={28} />
      <View style={styles.wideNamed}>
        {name !== '' && (
          <Text
            maxFontSizeMultiplier={TWICE}
            size={size}
            weight="bold"
            accessible={false}
            style={{ lineHeight: size * 1.15 }}
          >
            {name}
          </Text>
        )}
        <Text
          maxFontSizeMultiplier={TWICE}
          size={15}
          weight="semibold"
          muted
          accessible={false}
          style={styles.wideRole}
        >
          {t('switcher.yourRole', { role: t('roles.owner') })}
        </Text>
      </View>
      {facts.length > 0 && (
        <View style={styles.wideFacts}>
          {facts.map((fact) => (
            <FadeIn key={fact.key}>
              <FactLine fact={fact} tagged />
            </FadeIn>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shrink: { flexGrow: 0, flexShrink: 1 },
  noMatch: { paddingTop: tokens.spaceXxl, paddingHorizontal: tokens.spaceSm },
  noMatchWords: {
    textAlign: 'center',
    lineHeight: 15 * 1.4,
    color: tokens.colorInkSecondary,
  },
  phoneBody: { paddingHorizontal: tokens.spaceXxl, paddingVertical: tokens.spaceLg },
  phoneList: { paddingHorizontal: tokens.spaceXxl, paddingBottom: tokens.spaceLg },
  stepWords: { lineHeight: 13 * 1.3 },
  preview: { alignItems: 'center', gap: tokens.spaceSm },
  previewName: {
    textAlign: 'center',
    lineHeight: 22 * 1.2,
    letterSpacing: 22 * -0.01,
    marginTop: tokens.spaceXxs,
  },
  previewRole: { textAlign: 'center', lineHeight: 14 * 1.4 },
  name: { paddingVertical: 0, ...weight('medium') },
  nameBeside: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXl },
  nameLabelBeside: { maxWidth: '40%' },
  nameFieldBeside: { flex: 1 },
  header: { gap: tokens.spaceXl, paddingTop: tokens.spaceLg },
  headerWide: { paddingTop: tokens.spaceXl },
  wideTop: { gap: 18 },
  wideList: { flexGrow: 0, flexShrink: 1 },
  deviceGroup: { gap: tokens.spaceSm },
  group: { paddingTop: 13, paddingBottom: tokens.spaceXxs, backgroundColor: tokens.colorCard },
  groupFirst: { paddingTop: 0, paddingBottom: 0 },
  groupRuled: {
    minHeight: PINNED,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  groupWords: {
    lineHeight: 12.5 * 1.2,
    letterSpacing: 12.5 * 0.08,
    textTransform: 'uppercase',
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceHair,
    paddingVertical: tokens.spaceSm,
  },
  rowRuled: { borderBottomWidth: 1, borderBottomColor: tokens.colorBorder },
  rowPicked: {
    minHeight: 62,
    paddingHorizontal: tokens.spacePillEnd,
    borderRadius: 14,
    backgroundColor: tokens.colorAccentTint,
  },
  rowPressed: { backgroundColor: tokens.colorInset },
  rowWords: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  rowName: { lineHeight: 16 * 1.3 },
  rowCurrency: { lineHeight: 13.5 * 1.35 },
  disc: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccent,
  },
  search: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: tokens.spaceLg,
    borderRadius: tokens.spaceLg,
    backgroundColor: tokens.colorInset,
  },
  searchFocused: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    paddingLeft: tokens.spaceLg - 2,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingRight: tokens.spaceSm,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    ...weight('medium'),
  },
  clear: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInkSecondary,
  },
  brings: {
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorInset,
  },
  bringsPart: { gap: tokens.spaceHair },
  tagged: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  factLabel: { lineHeight: 13 * 1.3 },
  factValue: { lineHeight: 15 * 1.3 },
  card: {
    paddingTop: 18,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceXxl,
    borderRadius: 26,
    backgroundColor: tokens.colorInset,
  },
  cardName: {
    marginTop: tokens.spacePillEnd,
    lineHeight: 24 * 1.15,
    letterSpacing: 24 * -0.015,
  },
  cardRole: { marginTop: tokens.spaceXxs, lineHeight: 14.5 * 1.4 },
  facts: {
    marginTop: tokens.spacePillEnd,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spaceXl,
    rowGap: tokens.spaceLg,
  },
  factHalf: { flexGrow: 1, flexBasis: '40%', minWidth: 0 },
  factWhole: { flexBasis: '100%' },
  proxy: { position: 'absolute' },
  intro: { lineHeight: 15 * 1.45 },
  defaults: { lineHeight: 14 * 1.45 },
  wide: {
    width: 300,
    padding: tokens.space4xl,
    borderRightWidth: 1,
    borderRightColor: tokens.colorBorder,
    backgroundColor: tokens.colorInset,
  },
  wideNamed: { marginTop: 18, gap: tokens.spaceXxs },
  wideRole: { lineHeight: 15 * 1.4 },
  wideFacts: { marginTop: 18, gap: tokens.spaceLg },
});
