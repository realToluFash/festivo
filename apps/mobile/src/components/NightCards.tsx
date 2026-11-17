import { type LaterRow, type NightView, timeSlot } from '@soirely/domain';
import type { ReactNode, Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import {
  type NightShownItem,
  clockOf,
  elapsedWords,
  endWords,
  headerWords,
  lastsWords,
  nextTimes,
  ownerWords,
  pressLabels,
  rowWords,
  startAction,
} from '../kit/night.ts';
import type { LayoutKind } from '../layout/classify.ts';
import { tokens } from '../theme/tokens.ts';
import { SecondaryButton } from './Buttons.tsx';
import { Text, type TextHandle } from './Text.tsx';

type Shown = NightView<NightShownItem>;
type Row = LaterRow<NightShownItem>;

const PATHS = {
  tick: ['M20 6 9 17l-5-5'],
  clock: ['M12 7v5l3 2'],
  arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
  pause: ['M10 9v6', 'M14 9v6'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  chevron: ['m6 9 6 6 6-6'],
  chevronRight: ['m9 6 6 6-6 6'],
  strike: ['M5.6 18.4 18.4 5.6'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
} as const;

export interface NightActs {
  done: (item: NightShownItem) => void;
  skip: (item: NightShownItem) => void;
  start: (item: NightShownItem) => void;
  choose: (item: NightShownItem) => void;
  row: (itemId: string, node: ViewInstance | null) => void;
}

export interface NightTrackShown {
  key: string;
  label: string;
}

export function Glyph({
  paths,
  ink,
  side = 18,
  circle = false,
}: {
  paths: readonly string[];
  ink: string;
  side?: number;
  circle?: boolean;
}) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg
        width={side}
        height={side}
        viewBox="0 0 24 24"
        fill="none"
        stroke={ink}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {circle && <Circle cx={12} cy={12} r={9} />}
        {paths.map((d) => (
          <Path key={d} d={d} />
        ))}
      </Svg>
    </View>
  );
}

export function NightHead({
  titleRef,
  subtitle,
  view,
  label,
  sub,
  many,
  menuOpen,
  onMenu,
}: {
  titleRef?: Ref<TextHandle> | undefined;
  subtitle: string | null;
  view: Shown | null;
  label: string;
  sub: string;
  many: boolean;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const { t } = useTranslation();
  const words = view == null ? null : headerWords(view.header, t);
  const behind = view?.header.kind === 'behind';

  return (
    <View style={styles.head}>
      <View style={styles.headTop}>
        <View style={styles.grow}>
          <Text size={28} weight="bold" accessibilityRole="header" ref={titleRef}>
            {t('runView.title')}
          </Text>
          {subtitle != null && (
            <Text size={15} weight="medium" style={[styles.secondary, styles.num]}>
              {subtitle}
            </Text>
          )}
        </View>
        {words != null && (
          <View style={[styles.pill, behind ? styles.behind : styles.onTime]}>
            {behind ? (
              <Glyph paths={[]} ink={tokens.colorAttentionText} side={14} circle />
            ) : (
              <View style={styles.dot} />
            )}
            <Text
              size={14}
              weight="semibold"
              style={[styles.num, behind ? styles.attention : styles.accentText]}
            >
              {words}
            </Text>
          </View>
        )}
      </View>
      {view != null && (
        <View style={styles.headLine}>
          {many ? (
            <Pressable
              onPress={onMenu}
              accessibilityRole="button"
              accessibilityState={{ expanded: menuOpen }}
              accessibilityLabel={t('night.picker', { place: label })}
              style={styles.picker}
              testID="night.picker"
            >
              <Text size={15} weight="semibold" style={styles.shrink}>
                {label}
              </Text>
              <Glyph paths={PATHS.chevron} ink={tokens.colorInk} side={16} />
            </Pressable>
          ) : (
            <Text size={15} weight="semibold">
              {label}
            </Text>
          )}
          <Text size={14} style={[styles.secondary, styles.num]}>
            {sub}
          </Text>
        </View>
      )}
    </View>
  );
}

export function TrackMenu({
  tracks,
  current,
  onChoose,
}: {
  tracks: readonly NightTrackShown[];
  current: string;
  onChoose: (key: string) => void;
}) {
  return (
    <View style={styles.menu} accessibilityRole="menu">
      {tracks.map((one) => {
        const on = one.key === current;

        return (
          <Pressable
            key={one.key}
            accessibilityRole="menuitem"
            accessibilityState={{ selected: on }}
            onPress={() => onChoose(one.key)}
            style={styles.menuRow}
            testID={`night.track.${one.key}`}
          >
            <Text size={16} weight={on ? 'semibold' : 'regular'} style={styles.grow}>
              {one.label}
            </Text>
            {on && <Glyph paths={PATHS.tick} ink={tokens.colorAccentText} side={18} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export function NightStrip({
  online,
  age,
  waiting,
  onTry,
}: {
  online: boolean;
  age: number;
  waiting: number;
  onTry: () => void;
}) {
  const { t } = useTranslation();

  if (online)
    return (
      <View style={styles.strip}>
        <View style={styles.dot} />
        <Text size={13} weight="semibold" style={styles.secondary}>
          {t('night.live')}
        </Text>
      </View>
    );

  return (
    <View style={[styles.strip, styles.stripOff]}>
      <Glyph paths={[]} ink={tokens.colorAttentionText} side={14} circle />
      <View style={styles.grow}>
        <Text size={14} weight="semibold" style={styles.attention}>
          {t('night.reconnecting', { count: age })}
        </Text>
        {waiting > 0 && (
          <Text size={14} style={styles.attention}>
            {t('night.waiting', { count: waiting })}
          </Text>
        )}
      </View>
      <SecondaryButton label={t('night.tryNow')} onPress={onTry} testID="night.try" />
    </View>
  );
}

export function ViewOnly() {
  const { t } = useTranslation();

  return (
    <View style={styles.viewOnly}>
      <View style={styles.pill}>
        <Glyph paths={PATHS.eye} ink={tokens.colorInkSecondary} side={14} />
        <Text size={13} weight="semibold" style={styles.secondary}>
          {t('night.viewOnly')}
        </Text>
      </View>
      <Text size={14} style={[styles.secondary, styles.grow]}>
        {t('night.viewOnlyLine')}
      </Text>
    </View>
  );
}

export function LostAlert({
  title,
  words,
  onDismiss,
}: {
  title: string;
  words: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.alert} accessibilityRole="alert">
      <View style={styles.grow}>
        <Text size={15} weight="bold">
          {title}
        </Text>
        <Text size={14} weight="semibold" style={styles.attention}>
          {words}
        </Text>
      </View>
      <SecondaryButton label={t('night.dismiss')} onPress={onDismiss} testID="night.dismiss" />
    </View>
  );
}

export function NothingToday() {
  const { t } = useTranslation();

  return (
    <View style={styles.card} testID="night.empty">
      <Glyph paths={PATHS.calendar} ink={tokens.colorInkSecondary} side={24} />
      <Text size={18} weight="semibold">
        {t('night.nothingToday')}
      </Text>
      <Text size={15} style={styles.secondary}>
        {t('night.addedOnWeb')}
      </Text>
    </View>
  );
}

export function NightCards({
  view,
  label,
  layout,
  locale,
  manage,
  endNow,
  chosen,
  acts,
  onEndNow,
}: {
  view: Shown;
  label: string;
  layout: LayoutKind;
  locale: string;
  manage: boolean;
  endNow: boolean;
  chosen: string | null;
  acts: NightActs;
  onEndNow: () => void;
}) {
  const { t } = useTranslation();

  if (view.end != null) {
    const { sentence, workedOut } = endWords(view.end, locale, t);

    return (
      <View style={[styles.card, styles.endCard]} testID="night.end">
        <View style={styles.endTick}>
          <Glyph paths={PATHS.tick} ink={tokens.colorInkOnDark} side={22} />
        </View>
        <Text size={22} weight="bold">
          {t('night.everything')}
        </Text>
        {sentence != null && (
          <Text size={17} weight="semibold">
            {sentence}
          </Text>
        )}
        {workedOut != null && (
          <Text size={14} style={[styles.secondary, styles.num]}>
            {workedOut}
          </Text>
        )}
        {endNow && (
          <Pressable
            accessibilityRole="link"
            style={styles.link}
            onPress={onEndNow}
            testID="night.endNow"
          >
            <Text size={15} weight="semibold" style={styles.accentText}>
              {t('eventEnd.endNow')}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  const now = <NowCard view={view} label={label} locale={locale} manage={manage} acts={acts} />;
  const next = <NextCard view={view} label={label} locale={locale} manage={manage} acts={acts} />;
  const later = (
    <LaterCard
      view={view}
      label={label}
      locale={locale}
      manage={manage}
      chosen={chosen}
      acts={acts}
    />
  );

  if (layout === 'tabletLandscape')
    return (
      <View style={styles.row}>
        <View style={styles.column}>
          {now}
          {next}
        </View>
        <View style={styles.grow}>{later}</View>
      </View>
    );
  if (layout === 'tabletPortrait')
    return (
      <>
        <View style={styles.row}>
          <View style={styles.grow}>{now}</View>
          <View style={styles.grow}>{next}</View>
        </View>
        {later}
      </>
    );

  return (
    <>
      {now}
      {next}
      {later}
    </>
  );
}

function NowCard({
  view,
  label,
  locale,
  manage,
  acts,
}: {
  view: Shown;
  label: string;
  locale: string;
  manage: boolean;
  acts: NightActs;
}) {
  const { t } = useTranslation();
  const { now, elapsed } = view;
  const upperNow = t('runView.now').toLocaleUpperCase(locale);

  if (now == null || elapsed == null)
    return (
      <View style={[styles.card, styles.dark]} testID="night.now">
        <Text size={13} weight="semibold" style={styles.onDarkSecondary}>
          {upperNow}
        </Text>
        <Text size={22} weight="bold" style={styles.onDark}>
          {t('runView.nothingNow')}
        </Text>
        {view.lastFinished != null && (
          <Text size={15} style={[styles.onDarkSecondary, styles.num]}>
            {t('night.lastFinished', {
              title: view.lastFinished.item.title,
              ...timeSlot(view.lastFinished.at, locale),
            })}
          </Text>
        )}
      </View>
    );

  const over = elapsed.over > 0;
  const share = elapsed.share ?? 0;

  return (
    <View style={[styles.card, styles.dark]} testID="night.now">
      <Text size={13} weight="semibold" style={[styles.onDarkSecondary, styles.num]}>
        {t('night.since', { now: upperNow, ...timeSlot(now.startedAt ?? now.planned, locale) })}
      </Text>
      <Text size={24} weight="bold" style={styles.onDark}>
        {now.title}
      </Text>
      <Text size={15} style={styles.onDarkSecondary}>
        {t('night.ownerPlace', { owner: ownerWords(now, t), place: label })}
      </Text>
      {view.startedBefore != null && (
        <Text size={14} style={styles.onDarkSecondary}>
          {t('runView.startedBefore', { title: view.startedBefore.title })}
        </Text>
      )}
      <View style={styles.elapsed}>
        <Glyph
          paths={over ? [] : PATHS.clock}
          ink={over ? tokens.colorAttentionOnDark : tokens.colorInkOnDark}
          side={18}
          circle
        />
        <Text
          size={18}
          weight="bold"
          style={[styles.num, over ? styles.overOnDark : styles.onDark]}
        >
          {elapsedWords(elapsed, t)}
        </Text>
      </View>
      {now.lengthMinutes == null ? (
        <Text size={14} style={styles.onDarkSecondary}>
          {t('runView.noLength')}
        </Text>
      ) : (
        <View style={styles.lasts}>
          <Text size={14} style={[styles.onDarkSecondary, styles.num]}>
            {t('night.lasts', { count: now.lengthMinutes })}
          </Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { flex: share }]} />
            <View style={{ flex: 1 - share }} />
          </View>
        </View>
      )}
      {manage && (
        <View style={styles.pair}>
          <Big
            label={t('night.done')}
            said={pressLabels(now.title, t).done}
            onPress={() => acts.done(now)}
            testID={`night.done.${now.id}`}
            wide
          />
          <Big
            label={t('night.skip')}
            said={pressLabels(now.title, t).skip}
            onPress={() => acts.skip(now)}
            testID={`night.skip.${now.id}`}
            outlined
            onDark
          />
        </View>
      )}
    </View>
  );
}

function NextCard({
  view,
  label,
  locale,
  manage,
  acts,
}: {
  view: Shown;
  label: string;
  locale: string;
  manage: boolean;
  acts: NightActs;
}) {
  const { t } = useTranslation();
  const { next } = view;
  const action = startAction(view, manage);

  return (
    <View style={styles.card} testID="night.next">
      <Text size={13} weight="semibold" style={styles.secondary}>
        {t('runView.next').toLocaleUpperCase(locale)}
      </Text>
      {next == null ? (
        <Text size={15} style={styles.secondary}>
          {t('night.nothingElse', { place: label })}
        </Text>
      ) : (
        <NextBody
          next={next}
          locale={locale}
          action={action}
          onStart={() => acts.start(next.item)}
        />
      )}
    </View>
  );
}

function NextBody({
  next,
  locale,
  action,
  onStart,
}: {
  next: NonNullable<Shown['next']>;
  locale: string;
  action: ReturnType<typeof startAction>;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  const times = nextTimes(next, locale, t);

  return (
    <>
      <View style={styles.time} accessible accessibilityLabel={times.said}>
        <Text size={17} weight="semibold" style={styles.num}>
          {times.planned}
        </Text>
        {times.about != null && (
          <>
            <Glyph paths={PATHS.arrow} ink={tokens.colorAttentionText} side={16} />
            <Text size={17} weight="semibold" style={[styles.num, styles.attention]}>
              {times.about}
            </Text>
          </>
        )}
      </View>
      <Text size={20} weight="bold">
        {next.item.title}
      </Text>
      <Text size={14} style={styles.secondary}>
        {t('night.ownerLasts', {
          owner: ownerWords(next.item, t),
          lasts: lastsWords(next.item, t),
        })}
      </Text>
      {action === 'startNow' && (
        <Big
          label={t('night.startNow')}
          said={pressLabels(next.item.title, t).startNow}
          onPress={onStart}
          testID={`night.start.${next.item.id}`}
        />
      )}
      {action === 'finishFirst' && <FinishFirst />}
    </>
  );
}

function FinishFirst() {
  const { t } = useTranslation();

  return (
    <View style={styles.inset}>
      <Glyph paths={PATHS.pause} ink={tokens.colorInkSecondary} side={18} circle />
      <Text size={15} weight="semibold" style={[styles.secondary, styles.grow]}>
        {t('night.finishFirst')}
      </Text>
    </View>
  );
}

function LaterCard({
  view,
  label,
  locale,
  manage,
  chosen,
  acts,
}: {
  view: Shown;
  label: string;
  locale: string;
  manage: boolean;
  chosen: string | null;
  acts: NightActs;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.card} testID="night.later">
      <View>
        <Text size={13} weight="semibold" style={styles.secondary} accessibilityRole="header">
          {t('runView.then').toLocaleUpperCase(locale)}
        </Text>
        <Text size={13} style={styles.secondary}>
          {t('night.laterNote')}
        </Text>
      </View>
      {view.later.length === 0 ? (
        <Text size={15} style={styles.secondary}>
          {t('night.nothingElse', { place: label })}
        </Text>
      ) : (
        view.later.map((row) => (
          <LaterLine
            key={row.item.id}
            row={row}
            locale={locale}
            on={row.item.id === chosen}
            choosable={manage && row.mark === 'notStarted'}
            onChoose={() => acts.choose(row.item)}
            onRef={(node) => acts.row(row.item.id, node)}
          />
        ))
      )}
    </View>
  );
}

function LaterLine({
  row,
  locale,
  on,
  choosable,
  onChoose,
  onRef,
}: {
  row: Row;
  locale: string;
  on: boolean;
  choosable: boolean;
  onChoose: () => void;
  onRef: (node: ViewInstance | null) => void;
}) {
  const { t } = useTranslation();
  const inner = (
    <>
      <View style={styles.markCol}>
        {row.mark === 'done' ? (
          <View
            style={styles.markDone}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Glyph paths={PATHS.tick} ink={tokens.colorInkOnDark} side={12} />
          </View>
        ) : (
          <Glyph
            paths={row.mark === 'skipped' ? PATHS.strike : []}
            ink={tokens.colorInkSecondary}
            side={20}
            circle
          />
        )}
      </View>
      <View style={styles.grow}>
        <Text
          size={16}
          weight="semibold"
          style={row.mark === 'skipped' ? [styles.secondary, styles.struck] : undefined}
        >
          {row.item.title}
        </Text>
        <Text size={13} style={[styles.secondary, styles.num]}>
          {rowWords(row, locale, t)}
        </Text>
      </View>
      {choosable && <Glyph paths={PATHS.chevronRight} ink={tokens.colorInkSecondary} side={16} />}
    </>
  );

  return choosable ? (
    <Pressable
      onPress={onChoose}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.laterRow, on && styles.laterOn]}
      testID={`night.later.${row.item.id}`}
      ref={onRef}
    >
      {inner}
    </Pressable>
  ) : (
    <View style={styles.laterRow} accessible ref={onRef} testID={`night.later.${row.item.id}`}>
      {inner}
    </View>
  );
}

export function ChosenPanel({
  row,
  view,
  locale,
  manage,
  moving,
  onMove,
  onClose,
  acts,
}: {
  row: Row;
  view: Shown;
  locale: string;
  manage: boolean;
  moving: boolean;
  onMove: (moving: boolean) => void;
  onClose: () => void;
  acts: NightActs;
}) {
  const { t } = useTranslation();
  const { item } = row;

  if (moving)
    return (
      <Panel title={t('night.moveNamed', { title: item.title })} onClose={onClose}>
        <SecondaryButton
          label={t('night.leaveIt')}
          onPress={() => onMove(false)}
          testID="night.leaveIt"
          stacked
        />
      </Panel>
    );

  const action = startAction(view, manage);

  return (
    <Panel title={item.title} onClose={onClose}>
      <Text size={15} style={[styles.secondary, styles.num]}>
        {t('night.chosenLine', {
          time: row.at == null ? '' : clockOf(row.at, locale),
          owner: ownerWords(item, t),
          lasts: lastsWords(item, t),
        })}
      </Text>
      {action === 'startNow' && (
        <Big
          label={t('night.startNow')}
          said={pressLabels(item.title, t).startNow}
          onPress={() => acts.start(item)}
          testID={`night.chosen.start.${item.id}`}
        />
      )}
      {action === 'finishFirst' && <FinishFirst />}
      {manage && (
        <>
          <Big
            label={t('night.skip')}
            said={pressLabels(item.title, t).skip}
            onPress={() => acts.skip(item)}
            testID={`night.chosen.skip.${item.id}`}
            outlined
          />
          <Big
            label={t('night.move')}
            said={pressLabels(item.title, t).move}
            onPress={() => onMove(true)}
            testID={`night.chosen.move.${item.id}`}
            outlined
          />
        </>
      )}
    </Panel>
  );
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
          {title}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('toast.close')}
          style={styles.close}
          testID="night.close"
        >
          <Glyph paths={PATHS.close} ink={tokens.colorInk} side={20} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function Big({
  label,
  said,
  onPress,
  testID,
  outlined = false,
  onDark = false,
  wide = false,
}: {
  label: string;
  said: string;
  onPress: () => void;
  testID: string;
  outlined?: boolean;
  onDark?: boolean;
  wide?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={said}
      style={({ pressed }) => [
        styles.big,
        outlined ? styles.bigOutlined : styles.bigFilled,
        onDark && styles.bigOnDark,
        wide && styles.bigWide,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <Text size={17} weight="bold" style={outlined && !onDark ? undefined : styles.onDark}>
        {label}
      </Text>
    </Pressable>
  );
}

export function NightSkeleton({ layout }: { layout: LayoutKind }) {
  const { t } = useTranslation();
  const block = (height: number, dark = false) => (
    <View style={[styles.card, dark ? styles.dark : null, { height }]}>
      <View style={[styles.bone, dark && styles.boneDark]} />
      <View style={[styles.bone, styles.boneShort, dark && styles.boneDark]} />
    </View>
  );

  return (
    <View
      accessible
      accessibilityLabel={t('runView.loading')}
      accessibilityRole="progressbar"
      style={layout === 'tabletLandscape' ? styles.row : styles.stack}
      testID="night.loading"
    >
      <View style={layout === 'tabletLandscape' ? styles.column : styles.stack}>
        {block(240, true)}
        {block(160)}
      </View>
      <View style={styles.grow}>{block(320)}</View>
    </View>
  );
}

export const nightStyles = StyleSheet.create({
  docked: {
    width: tokens.sizePanel,
    borderLeftWidth: 1,
    borderLeftColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  scrim: { flex: 1 },
  scrimPhone: { justifyContent: 'flex-end', backgroundColor: tokens.scrimSheet },
  scrimDialog: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.scrimDialog,
  },
  sheet: {
    borderTopLeftRadius: tokens.radiusSheet,
    borderTopRightRadius: tokens.radiusSheet,
    backgroundColor: tokens.colorCard,
  },
  dialog: {
    width: 480,
    maxWidth: '90%',
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorCard,
  },
});

const styles = StyleSheet.create({
  accentText: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  onDark: { color: tokens.colorInkOnDark },
  onDarkSecondary: { color: tokens.colorInkOnDarkSecondary },
  overOnDark: { color: tokens.colorAttentionOnDark },
  num: { fontVariant: ['tabular-nums'] },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  struck: { textDecorationLine: 'line-through' },
  head: { gap: tokens.spaceSm },
  headTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  headLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizePill,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  onTime: { backgroundColor: tokens.colorAccentTint, borderColor: tokens.colorAccentTintBorder },
  behind: { backgroundColor: tokens.colorAttentionTint, borderColor: tokens.colorAttentionBorder },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.colorAccent,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  menu: {
    alignSelf: 'flex-start',
    minWidth: 240,
    paddingVertical: tokens.spaceXs,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  stripOff: {
    padding: tokens.spaceMd,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorAttentionTint,
  },
  viewOnly: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  alert: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorAttentionTint,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  column: { width: '42%', gap: tokens.spaceLg },
  stack: { gap: tokens.spaceLg },
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceXl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
  },
  dark: { backgroundColor: tokens.colorDark, borderColor: tokens.colorDark },
  endCard: { alignItems: 'flex-start' },
  endTick: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentHover,
  },
  link: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  elapsed: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  lasts: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  bar: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: tokens.colorDarkInset,
  },
  barFill: { backgroundColor: tokens.colorInkOnDark },
  pair: { flexDirection: 'row', gap: tokens.spaceMd, marginTop: tokens.spaceXs },
  time: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceXs },
  inset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  laterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: tokens.sizeListRow,
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXs,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  laterOn: { backgroundColor: tokens.colorRowSelected, borderRadius: tokens.radiusSmall },
  markCol: { width: 24, alignItems: 'center' },
  markDone: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInkSecondary,
  },
  big: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 28,
  },
  bigFilled: { backgroundColor: tokens.colorAccentHover },
  bigOutlined: {
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  bigOnDark: {
    flex: 1,
    backgroundColor: tokens.colorDark,
    borderColor: tokens.colorInkOnDarkSecondary,
  },
  bigWide: { flex: 2 },
  pressed: { opacity: 0.8 },
  panel: { gap: tokens.spaceMd, padding: tokens.spaceXl },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bone: { height: 14, borderRadius: 7, backgroundColor: tokens.colorInset },
  boneShort: { width: '60%' },
  boneDark: { backgroundColor: tokens.colorDarkInset },
});
