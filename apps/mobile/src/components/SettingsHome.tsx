import { initials } from '@soirely/domain';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { SettingsSection } from '../kit/appNav.ts';
import { useAccountChoice } from '../colourScheme.ts';
import { inUse } from '../kit/personalisation.ts';
import { schemeOf } from '../kit/schemes.ts';
import { schemeAtLaunch, tokens } from '../theme/tokens.ts';
import { CARD_PIECES, Confetti, Cover } from './Cover.tsx';
import { Glyph } from './Glyph.tsx';
import { SchemeTile } from './SchemeParts.tsx';
import { Pill, Tile, TYPE } from './SettingsParts.tsx';
import { SELECTED_ROW } from './SummaryRows.tsx';
import { Text } from './Text.tsx';
import { Glass } from './TodayCover.tsx';

/** Who the card at the top of Settings is: no role outside an organisation. */
export interface SettingsPerson {
  name: string;
  initials: string;
  email: string;
  role: string | null;
  organisation: string | null;
}

export interface SettingsRow {
  key: string;
  title: string;
  line: string;
  tile: ReactNode;
}

export type ListedSection = Exclude<SettingsSection, 'account'>;

/** How far the Tint reaches past the open card on its side, as a lit row's does. */
const LIT_PAST = tokens.spaceMd;

const CARD_LOOK = {
  phone: { height: 148, avatar: 60, name: 22, mail: 15, radius: 26, scale: 1, pad: tokens.spaceXl },
  portrait: {
    height: 180,
    avatar: 76,
    name: 28,
    mail: 16,
    radius: 28,
    scale: 1.3,
    pad: tokens.spaceXl,
  },
  column: {
    height: 104,
    avatar: 48,
    name: 18,
    mail: 13.5,
    radius: 22,
    scale: 0.8,
    pad: tokens.spaceLg,
  },
} as const;

/** You, as the Confetti card at the top of Settings: it opens Your account. */
export function PersonCard({
  person,
  size,
  open = false,
  onPress,
}: {
  person: SettingsPerson;
  size: keyof typeof CARD_LOOK;
  open?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const look = CARD_LOOK[size];
  const role =
    person.role == null || person.organisation == null
      ? null
      : { role: person.role, organisation: person.organisation };

  return (
    <View
      style={[
        styles.personPlate,
        open && { backgroundColor: tokens.colorAccentTint, borderRadius: look.radius + LIT_PAST },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.person,
          { minHeight: look.height, borderRadius: look.radius, paddingVertical: look.pad },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: open }}
        accessibilityLabel={
          role == null
            ? t('settings.personLabel', { name: person.name, email: person.email })
            : t('settings.personLabelWithRole', { name: person.name, email: person.email, ...role })
        }
        testID="settings.account"
      >
        <View style={[StyleSheet.absoluteFill, { borderRadius: look.radius, overflow: 'hidden' }]}>
          <Cover shade="side" pieces={[]} />
          <Confetti pieces={CARD_PIECES} scale={look.scale} />
        </View>
        <View
          style={[
            styles.personAvatar,
            { width: look.avatar, height: look.avatar, borderRadius: look.avatar / 2 },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            size={Math.round(look.avatar * 0.36)}
            weight="bold"
            accessible={false}
            style={styles.accent}
          >
            {person.initials}
          </Text>
        </View>
        <View style={styles.personWords}>
          <Text
            size={look.name}
            weight="bold"
            accessible={false}
            style={[styles.white, styles.tight]}
          >
            {person.name}
          </Text>
          <Text size={look.mail} weight="medium" accessible={false} style={styles.white}>
            {person.email}
          </Text>
          {role != null && (
            <Glass height={28} grows style={styles.roleChip}>
              <Text size={13} weight="semibold" accessible={false} style={styles.white}>
                {t('settings.personRole', role)}
              </Text>
            </Glass>
          )}
        </View>
        <Glass height={36} style={styles.personChevron}>
          <Glyph name="chevron" size={18} ink={tokens.colorInkOnDark} weight={2.4} />
        </Glass>
      </Pressable>
    </View>
  );
}

/** Each listed section's title and line; the organisation's row carries its name. */
export function useSectionRows(organisation: string | null) {
  const { t } = useTranslation();

  return (section: ListedSection, side: number): SettingsRow => ({
    key: section,
    title: section === 'organisation' ? (organisation ?? '') : t(`settings.${section}`),
    line: t(`settings.${section}Line`),
    tile: <SectionTile section={section} side={side} organisation={organisation} />,
  });
}

function SectionTile({
  section,
  side,
  organisation,
}: {
  section: ListedSection;
  side: number;
  organisation: string | null;
}) {
  if (section === 'personalisation') return <PersonTile side={side} />;

  return (
    <Tile
      of={section}
      side={side}
      initials={
        section === 'organisation' && organisation != null ? initials(organisation) : undefined
      }
    />
  );
}

/** Personalisation's tile: the account's scheme once it has answered, the device's until then. */
function PersonTile({ side }: { side: number }) {
  const choice = useAccountChoice();

  return (
    <SchemeTile
      side={side}
      scheme={inUse(choice === undefined ? schemeOf(schemeAtLaunch) : choice)}
    />
  );
}

export function rowSide(dense: boolean): number {
  return dense ? 32 : 36;
}

function Row({
  row,
  dense,
  first,
  open,
  onPress,
}: {
  row: SettingsRow;
  dense: boolean;
  first: boolean;
  open: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        dense && styles.rowDense,
        open && styles.rowOpen,
        pressed && !open && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: open }}
      accessibilityLabel={`${row.title}. ${row.line}`}
      testID={`settings.${row.key}`}
    >
      {!first && !open && (
        <View style={[styles.rule, { left: tokens.spaceXl + rowSide(dense) + 12 }]} />
      )}
      {row.tile}
      <View style={styles.rowWords}>
        <Text
          size={dense ? 15.5 : TYPE.row}
          weight="semibold"
          accessible={false}
          style={open ? styles.accent : undefined}
        >
          {row.title}
        </Text>
        <Text
          size={dense ? 13 : TYPE.small}
          weight="medium"
          accessible={false}
          style={styles.secondary}
        >
          {row.line}
        </Text>
      </View>
      <Glyph
        name="chevron"
        size={18}
        ink={open ? tokens.colorAccent : tokens.colorInkTertiary}
        weight={2.2}
      />
    </Pressable>
  );
}

/** One group's rows on their Inset ground; the rule under an open row gives way to its Tint. */
export function SettingsGroup({
  rows,
  dense,
  open,
  onOpen,
}: {
  rows: readonly SettingsRow[];
  dense: boolean;
  open: string | null;
  onOpen: (key: string) => void;
}) {
  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <Row
          key={row.key}
          row={row}
          dense={dense}
          first={index === 0 || rows[index - 1]?.key === open}
          open={row.key === open}
          onPress={() => onOpen(row.key)}
        />
      ))}
    </View>
  );
}

export function SettingsSignOut({
  label,
  height,
  onSignOut,
  under,
}: {
  label?: string;
  height: number;
  onSignOut: () => void;
  /** What sits under the button, as the demo's Terms · Privacy. */
  under?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <View>
      <Pill
        label={label ?? t('settings.signOut')}
        kind="secondary"
        glyph="signOut"
        height={height}
        onPress={onSignOut}
        testID="settings.signOut"
      />
      {under}
    </View>
  );
}

/** What a tablet on its side shows beside the list before a section is chosen. */
export function ChooseASection() {
  const { t } = useTranslation();

  return (
    <View style={styles.choose}>
      <View
        style={styles.chooseMark}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Glyph name="settings" size={30} ink={tokens.colorAccent} />
        <Confetti
          pieces={[
            [0.02, 0.06, 'half', 18, -18, 'sun'],
            [1.08, 0.02, 'bar', 18, 24, 'rose'],
            [1.16, 0.8, 'half', 14, 200, 'sky'],
            [-0.06, 0.86, 'bar', 14, 62, 'rose'],
          ]}
        />
      </View>
      <Text size={22} weight="bold" accessibilityRole="header">
        {t('settings.choose')}
      </Text>
    </View>
  );
}

export const settingsHomeStyles = StyleSheet.create({
  footPhone: { marginTop: 26, gap: 22 },
  footColumn: { marginTop: tokens.spaceXl, gap: tokens.spaceLg },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space3xl },
  single: { maxWidth: 520 },
  column: {
    paddingTop: tokens.spaceXl,
    paddingLeft: tokens.spaceXl,
    paddingRight: 14,
    paddingBottom: tokens.space6xl,
  },
});

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccent },
  white: { color: tokens.colorInkOnDark },
  tight: { letterSpacing: -0.3 },
  pressed: { opacity: 0.9 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXl,
    paddingLeft: tokens.spaceXxl,
    paddingRight: tokens.spaceXl,
  },
  personPlate: { margin: -LIT_PAST, padding: LIT_PAST },
  personAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInkOnDark,
  },
  personWords: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  roleChip: { marginTop: tokens.spaceXs, paddingHorizontal: 11, paddingVertical: 5 },
  personChevron: { width: 36, justifyContent: 'center' },
  group: {
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorInset,
    padding: tokens.spaceXxs,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    paddingLeft: tokens.spaceXl,
    paddingRight: 14,
    borderRadius: tokens.spaceXl,
  },
  rowDense: { minHeight: tokens.sizeListRow, gap: 12, paddingVertical: 9 },
  // No ring: sc-31724.
  rowOpen: SELECTED_ROW,
  rowPressed: { backgroundColor: tokens.colorNeutralFill },
  rule: { position: 'absolute', right: 0, top: 0, height: 1, backgroundColor: tokens.colorBorder },
  rowWords: { flex: 1, minWidth: 0, gap: 2 },
  choose: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  chooseMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
  },
});

export const settingsRowStyles = {
  group: styles.group,
  row: styles.row,
  rowDense: styles.rowDense,
  rowPressed: styles.rowPressed,
  rowWords: styles.rowWords,
  secondary: styles.secondary,
};
