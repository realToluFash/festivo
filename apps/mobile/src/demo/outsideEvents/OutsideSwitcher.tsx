import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EventThumb } from '../../components/EventThumb.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Initials } from '../../components/Initials.tsx';
import { OrgMark } from '../../components/OrgMark.tsx';
import { Row, RowList, SectionHead } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { meshFor } from '../../kit/today.ts';
import { tokens } from '../../theme/tokens.ts';
import {
  CELL_GAP,
  cellWidth,
  columnsFor,
  type DropFrame,
  type Invite,
  type Place,
  rowsOf,
} from '../OrgSwitcherModel.ts';
import { Marks } from './Marks.tsx';
import {
  inOrder,
  NOW,
  type OutsideEvent,
  rowLabel,
  rowLine,
  underWay,
  WORDS,
} from './OutsideModel.ts';

type Tile =
  | { kind: 'place'; place: Place; current: boolean }
  | { kind: 'invitation'; invite: Invite }
  | { kind: 'create' };

const TILE = 48;
const BADGE = 20;

/** The Places drop-down with the member's events from outside between their organisations and the rest. */
export function OutsideSwitcher({
  frame,
  places,
  current,
  invitations,
  events,
  locale,
  onClose,
  onPlace,
  onInvitation,
  onCreate,
  onEvent,
}: {
  frame: DropFrame;
  places: readonly Place[];
  current: string;
  invitations: readonly Invite[];
  events: readonly OutsideEvent[];
  locale: string;
  onClose: () => void;
  onPlace: (place: Place) => void;
  onInvitation: (invite: Invite) => void;
  onCreate: () => void;
  onEvent: (event: OutsideEvent) => void;
}) {
  const { t } = useTranslation();
  const across = columnsFor(frame.width);
  const cell = cellWidth(frame.width);
  const press = (tile: Tile) => {
    if (tile.kind === 'create') onCreate();
    else if (tile.kind === 'invitation') onInvitation(tile.invite);
    else if (tile.current) onClose();
    else onPlace(tile.place);
  };
  const grid = (tiles: readonly Tile[]) =>
    rowsOf(tiles, across).map((row, index) => (
      <View key={row.map(keyOf).join(':')} style={[styles.row, index > 0 && styles.rowGap]}>
        {row.map((tile) => (
          <Cell key={keyOf(tile)} tile={tile} width={cell} onPress={() => press(tile)} />
        ))}
      </View>
    ));

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('switcher.close')}
        testID="outside.switcher.close"
      />
      <View
        style={[
          styles.drop,
          { left: frame.left, top: frame.top, width: frame.width, maxHeight: frame.maxHeight },
        ]}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        testID="outside.switcher"
      >
        <View style={styles.clip}>
          <View style={styles.head}>
            <Text size={18} weight="bold" accessibilityRole="header" style={styles.question}>
              {t('switcher.asks')}
            </Text>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <View>
              {grid(
                places.map((place) => ({ kind: 'place', place, current: place.id === current })),
              )}
            </View>
            <View testID="outside.switcher.events">
              <SectionHead title={WORDS.fromOutside} />
              <RowList
                items={inOrder(events, NOW).map((event) => {
                  const now = underWay(event, NOW);

                  return {
                    key: event.id,
                    inset: 40 + tokens.spaceLg,
                    row: (
                      <Row
                        title={event.name}
                        line={rowLine(event, locale)}
                        below={<Marks underWay={now} here={false} />}
                        lead={
                          <EventThumb
                            event={{ id: event.id, mesh: meshFor(event.id), photo: null }}
                            side={40}
                            radius={12}
                          />
                        }
                        onPress={() => onEvent(event)}
                        accessibilityLabel={rowLabel(event, locale, { underWay: now, here: false })}
                        testID={`outside.switcher.event.${event.id}`}
                      />
                    ),
                  };
                })}
              />
            </View>
            <View>
              {grid([
                ...invitations.map((invite): Tile => ({ kind: 'invitation', invite })),
                { kind: 'create' },
              ])}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function keyOf(tile: Tile): string {
  if (tile.kind === 'create') return 'create';

  return tile.kind === 'place' ? tile.place.id : tile.invite.id;
}

function Cell({ tile, width, onPress }: { tile: Tile; width: number; onPress: () => void }) {
  const { t } = useTranslation();
  const lit = tile.kind === 'place' && tile.current;
  const name =
    tile.kind === 'create'
      ? t('createOrganisation.row')
      : tile.kind === 'place'
        ? tile.place.name
        : tile.invite.name;
  const line =
    tile.kind === 'place'
      ? t('switcher.yourRole', { role: tile.place.role })
      : tile.kind === 'invitation'
        ? t('invitations.fromNobody', { role: tile.invite.role })
        : null;
  const current = t('switcher.current');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.cell, { width }, lit ? styles.lit : pressed && styles.surf]}
      accessibilityRole="button"
      accessibilityLabel={[name, line, lit ? current : null].filter(Boolean).join(', ')}
      accessibilityState={tile.kind === 'invitation' ? { expanded: false } : { selected: lit }}
      testID={`outside.switcher.tile.${keyOf(tile)}`}
    >
      {({ pressed }) => (
        <>
          <Face
            tile={tile}
            ground={lit ? tokens.colorAccentTint : pressed ? tokens.colorInset : tokens.colorCard}
          />
          <View style={styles.cellWords}>
            <Text
              size={15}
              weight="semibold"
              numberOfLines={2}
              accessible={false}
              style={[styles.centred, tile.kind === 'create' && styles.violet]}
            >
              {name}
            </Text>
            {line != null && (
              <Text
                size={13}
                weight={tile.kind === 'invitation' ? 'semibold' : 'medium'}
                accessible={false}
                style={[
                  styles.centred,
                  styles.line,
                  tile.kind === 'invitation' ? styles.invitationInk : styles.secondary,
                ]}
              >
                {line}
              </Text>
            )}
            {lit && (
              <Text
                size={13}
                weight="semibold"
                accessible={false}
                style={[styles.centred, styles.line, styles.violet]}
              >
                {current}
              </Text>
            )}
          </View>
        </>
      )}
    </Pressable>
  );
}

function Face({ tile, ground }: { tile: Tile; ground: string }) {
  const badge = [styles.badge, { borderColor: ground }];

  if (tile.kind === 'create')
    return (
      <View style={[styles.tile, styles.create]} {...hidden}>
        <Glyph name="plus" size={20} ink={tokens.colorAccentText} weight={2.4} />
      </View>
    );

  if (tile.kind === 'place')
    return (
      <View style={styles.face}>
        <OrgMark id={tile.place.id} name={tile.place.name} side={TILE} />
        {tile.current && (
          <View style={[badge, styles.badgeCurrent]} {...hidden}>
            <Glyph name="tick" size={11} ink={tokens.colorInkOnDark} weight={3.2} />
          </View>
        )}
      </View>
    );

  return (
    <View style={styles.face}>
      <View style={[styles.tile, styles.dashed]} {...hidden}>
        <Initials name={tile.invite.name} size={20} weight="bold" style={styles.secondary} />
      </View>
      <View style={[badge, styles.badgeInvited]} {...hidden}>
        <View style={styles.invitedRing} />
      </View>
    </View>
  );
}

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const styles = StyleSheet.create({
  drop: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.dialog.ios,
    elevation: tokens.elevationNative.dialog.android.elevation,
  },
  clip: { flexShrink: 1, borderRadius: tokens.space3xl - 1, overflow: 'hidden' },
  head: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceLg,
    paddingBottom: tokens.spaceLg,
  },
  question: { textAlign: 'center', letterSpacing: -0.18, lineHeight: 18 * 1.25 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: tokens.spaceXl, paddingHorizontal: tokens.spaceLg, paddingBottom: tokens.spaceLg },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: CELL_GAP },
  rowGap: { marginTop: tokens.spaceSm },
  cell: {
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXxs,
    borderRadius: tokens.spaceXl,
  },
  lit: { backgroundColor: tokens.colorAccentTint },
  surf: { backgroundColor: tokens.colorInset },
  cellWords: { alignSelf: 'stretch', marginTop: tokens.spaceSm },
  centred: { textAlign: 'center' },
  line: { marginTop: tokens.spaceHair },
  violet: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  invitationInk: { color: tokens.colorPrimaryHover },
  face: { width: TILE, height: TILE },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: TILE / 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  create: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  dashed: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  badge: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: BADGE + 4,
    height: BADGE + 4,
    borderRadius: (BADGE + 4) / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCurrent: { backgroundColor: tokens.colorAccent },
  badgeInvited: { backgroundColor: tokens.colorAccentTint },
  invitedRing: {
    width: BADGE / 2,
    height: BADGE / 2,
    borderRadius: BADGE / 4,
    borderWidth: 2,
    borderColor: tokens.colorPrimaryHover,
  },
});
