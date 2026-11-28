import type { ReactNode, Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { LineIcon } from './AccountCard.tsx';
import { AlertLine } from './AlertLine.tsx';
import { SwitchTrack } from './ConfettiSwitch.tsx';
import type { GlyphName } from './Glyph.tsx';
import { Row, RowList, Section, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

export type EventPart =
  'dates' | 'replyBy' | 'venue' | 'hosts' | 'type' | 'currency' | 'name' | 'cover';

export type RefFor = (key: string) => Ref<ViewInstance> | undefined;

const PART_ICON: Record<Exclude<EventPart, 'cover'>, GlyphName> = {
  dates: 'calendar',
  replyBy: 'clock',
  venue: 'pin',
  hosts: 'users',
  type: 'events',
  currency: 'wallet',
  name: 'edit',
};

export interface PartRow {
  part: EventPart;
  title: string;
  line: string;
  /** The cover's own thumbnail; every other part leads with its line icon. */
  lead?: ReactNode;
  /** Off where the part cannot change, or for somebody who cannot change it. */
  opens: boolean;
  /** Under the row, at its words: the venue's Open in maps. */
  after?: ReactNode;
}

/** Details, and Name and cover: a titled list of an event's parts, each opening its own edit. */
export function PartsSection({
  title,
  rows,
  rowIDs,
  refFor,
  onEdit,
}: {
  title: string;
  rows: readonly PartRow[];
  rowIDs: string;
  refFor?: RefFor;
  onEdit: (part: EventPart) => void;
}) {
  return (
    <Section title={title}>
      <RowList
        items={rows.map(({ part, title: shown, line, lead, opens, after }) => {
          const row = (
            <Row
              ref={refFor?.(part)}
              title={shown}
              line={line}
              lead={lead ?? (part === 'cover' ? null : <LineIcon name={PART_ICON[part]} />)}
              opens={opens}
              onPress={opens ? () => onEdit(part) : undefined}
              testID={`${rowIDs}.${part}`}
            />
          );

          return {
            key: part,
            inset: 40,
            row:
              after == null ? (
                row
              ) : (
                <View>
                  {row}
                  <View style={styles.after}>{after}</View>
                </View>
              ),
          };
        })}
      />
    </Section>
  );
}

export interface JustForYouWords {
  title: string;
  mute: string;
  note: string;
  notLoaded: string;
  tryAgain: string;
  notSaved: string;
  settings: string;
}

export type MuteShown =
  { kind: 'notLoaded' } | { kind: 'shown'; muted: boolean; notSaved: boolean; busy: boolean };

/** Mute this event, for the viewer alone, and the way to their notification settings. */
export function JustForYou({
  words,
  mute,
  onToggle,
  onRetry,
  onSettings,
  testIDs,
}: {
  words: JustForYouWords;
  mute: MuteShown;
  onToggle: () => void;
  onRetry: () => void;
  onSettings: () => void;
  testIDs: { row: string; retry: string; settings: string };
}) {
  return (
    <Section title={words.title}>
      {mute.kind === 'notLoaded' ? (
        <View style={styles.notLoaded}>
          <Text size={15} weight="medium">
            {words.notLoaded}
          </Text>
          <TextAction label={words.tryAgain} onPress={onRetry} testID={testIDs.retry} />
        </View>
      ) : (
        <>
          <Row
            title={words.mute}
            line={words.note}
            lead={<LineIcon name="bell" />}
            trail={<SwitchTrack on={mute.muted} />}
            off={mute.busy}
            onPress={mute.busy ? undefined : onToggle}
            accessibilityRole="switch"
            accessibilityState={{ checked: mute.muted, busy: mute.busy, disabled: mute.busy }}
            accessibilityLabel={`${words.mute}. ${words.note}`}
            testID={testIDs.row}
          />
          {mute.notSaved && (
            <View style={styles.notSaved}>
              <AlertLine text={words.notSaved} />
            </View>
          )}
        </>
      )}
      <TextAction label={words.settings} onPress={onSettings} testID={testIDs.settings} />
    </Section>
  );
}

export interface ManageItem<K extends string> {
  key: K;
  label: string;
  line: string;
  removes: boolean;
  /** While what it opens is still being read. */
  off?: boolean;
  testID: string;
}

/** The event's own moves, each saying what it does; red where it cannot be undone. */
export function Manage<K extends string>({
  title,
  items,
  refFor,
  onManage,
}: {
  title: string;
  items: readonly ManageItem<K>[];
  refFor?: RefFor;
  onManage: (key: K) => void;
}) {
  return (
    <Section title={title}>
      <View style={styles.manage}>
        {items.map((item) => (
          <TextAction
            key={item.key}
            ref={refFor?.(item.key)}
            label={item.label}
            consequence={item.line}
            removes={item.removes}
            plain={!item.removes}
            off={item.off === true}
            onPress={() => onManage(item.key)}
            testID={item.testID}
          />
        ))}
      </View>
    </Section>
  );
}

/** The page's sections: on a tablet on its side, the card across and two columns under it; one column elsewhere. */
export function OverviewColumns({
  landscape,
  card,
  left,
  right,
  stacked,
}: {
  landscape: boolean;
  card: ReactNode;
  left: ReactNode;
  right: ReactNode;
  stacked: ReactNode;
}) {
  return landscape ? (
    <>
      {card}
      <View style={styles.columns}>
        <View style={styles.left}>{left}</View>
        <View style={styles.right}>{right}</View>
      </View>
    </>
  ) : (
    <>
      {card}
      {stacked}
    </>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space5xl },
  left: { flex: 1, minWidth: 0, gap: 18 },
  right: { width: 328, gap: 18 },
  after: { paddingLeft: 40, marginTop: -tokens.spaceSm, paddingBottom: tokens.spaceXs },
  notLoaded: { gap: tokens.spaceHair },
  notSaved: { paddingTop: tokens.spaceXxs },
  manage: { gap: tokens.spaceSm },
});
