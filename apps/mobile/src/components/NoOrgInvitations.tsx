import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { type InvitationRow, NO_ORG_IDS } from '../kit/noOrgInvitations.ts';
import { tokens } from '../theme/tokens.ts';
import { Initials } from './Initials.tsx';
import { Notice } from './Notice.tsx';
import { Pill } from './SettingsParts.tsx';
import { Text } from './Text.tsx';

const TILE = 48;

/** Invitations, in place of the way on: the rows with a hairline between (sc-75471). */
export function NoOrgInvitationList({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <View testID={NO_ORG_IDS.list}>
      <Text size={14} weight="semibold" muted accessibilityRole="header" style={styles.heading}>
        {t('invitations.heading')}
      </Text>
      <View style={styles.list}>{children}</View>
    </View>
  );
}

/** One invitation waiting: its dashed tile, its lines, and the switcher's own answers under them. A refusal or a failed answer is `said`, in the switcher's words. */
export function NoOrgInvitationRow({
  id,
  organisation,
  role,
  line,
  until,
  note,
  declined,
  row,
  said,
  onAnswer,
  onOpen,
}: {
  id: string;
  organisation: string;
  role: string;
  line: string;
  until: string;
  note: string;
  declined: string;
  row: InvitationRow;
  said?: ReactNode;
  onAnswer: (yes: boolean) => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.row} testID={NO_ORG_IDS.row(id)}>
      <View
        style={styles.tile}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Initials name={organisation} size={20} weight="bold" style={styles.secondary} />
      </View>
      <View style={styles.words}>
        <Text size={16} weight="bold" style={styles.name}>
          {organisation}
        </Text>
        <View style={styles.lines}>
          <Text size={14} weight="medium" muted style={styles.line}>
            {line}
          </Text>
          <Text size={14} weight="medium" muted style={[styles.line, styles.figures]}>
            {until}
          </Text>
        </View>
        {row.kind === 'joined' ? (
          <View style={styles.under}>
            <Notice
              tone="done"
              mark={tokens.marks.done.glyph}
              body={t('invitations.joined', { organisation, role })}
              takesFocus
            />
            <View style={styles.open}>
              <Pill
                label={t('invitations.open', { organisation })}
                full={false}
                height={tokens.sizeHit}
                onPress={onOpen}
                testID={NO_ORG_IDS.open(id)}
              />
            </View>
          </View>
        ) : row.kind === 'declined' ? (
          <View style={styles.under}>
            <Notice tone="quiet" mark="–" body={declined} takesFocus />
          </View>
        ) : row.kind === 'refused' ? (
          <View style={styles.under}>{said}</View>
        ) : (
          <View style={styles.under}>
            {said != null && <View style={styles.said}>{said}</View>}
            <View style={styles.answers}>
              <Pill
                label={t(row.accept.label)}
                accessibilityLabel={t(row.accept.accessibilityLabel, { organisation })}
                kind={row.accept.off ? 'off' : 'primary'}
                busy={row.accept.busy}
                full={false}
                height={tokens.sizeHit}
                onPress={() => !row.accept.off && onAnswer(true)}
                testID={NO_ORG_IDS.accept(id)}
              />
              <Pill
                label={t(row.decline.label)}
                accessibilityLabel={t(row.decline.accessibilityLabel, { organisation })}
                kind={row.decline.off ? 'off' : 'secondary'}
                busy={row.decline.busy}
                full={false}
                height={tokens.sizeHit}
                onPress={() => !row.decline.off && onAnswer(false)}
                testID={NO_ORG_IDS.decline(id)}
              />
            </View>
            <Text size={13} weight="medium" muted style={styles.note}>
              {note}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { lineHeight: 14 * 1.4, marginBottom: tokens.spaceSm },
  list: { borderBottomWidth: 1, borderBottomColor: tokens.colorBorder },
  row: {
    flexDirection: 'row',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceXl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  tile: {
    width: TILE,
    height: TILE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: TILE / 3,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  secondary: { color: tokens.colorInkSecondary },
  words: { flex: 1, minWidth: 0 },
  name: { lineHeight: 16 * 1.3 },
  lines: { marginTop: tokens.spaceXs, gap: tokens.spaceHair },
  line: { lineHeight: 14 * 1.4 },
  figures: { fontVariant: ['tabular-nums'] },
  under: { marginTop: tokens.spaceMd },
  said: { marginBottom: tokens.spaceMd },
  answers: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  open: { marginTop: tokens.spaceMd, alignItems: 'flex-start' },
  note: { marginTop: tokens.spaceSm, lineHeight: 13 * 1.4 },
});
