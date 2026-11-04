import { type RefObject, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ReadOut, readOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';
import { useShell } from '../settings/Frame.tsx';
import { RoleChoices } from '../settings/MembersRequest.tsx';
import { Avatar } from '../settings/parts.tsx';
import {
  Ask,
  type AskProps,
  FocusedScreen,
  Line,
  type RowTag,
  TextAction,
} from '../settings/Summary.tsx';
import {
  EVENT_ROLES,
  type EventRole,
  firstName,
  LEAD_OFF,
  notChangedLine,
  type OnEvent,
  OUTSIDE_ENDS,
  removeLine,
  removeTitle,
  ROLE_LINES,
  rolesOff,
  SAVE_MS,
  savedWords,
  SAVING,
  sheetLine,
} from './PeopleSample.ts';

type Opener = RefObject<ScreenReaderTarget | null>;
type Sending = 'idle' | 'saving' | 'saved';

const PICKED_TAG: Record<Sending, RowTag | null> = {
  idle: null,
  saving: { kind: 'now', word: SAVING, turning: true },
  saved: { kind: 'yes', word: 'Saved' },
};

export function Face({ person, side }: { person: OnEvent; side: number }) {
  return (
    <Avatar
      initials={person.initials ?? ''}
      side={side}
      tone={person.tone}
      glyph={person.initials == null ? 'phone' : undefined}
    />
  );
}

/** The four roles as radios, each with its line, any role not offered dimmed with why, and the picked one's tag while it is sent. */
export function EventRoles({
  picked,
  off,
  sending = 'idle',
  onPick,
  testID,
}: {
  picked: EventRole;
  off: readonly EventRole[];
  sending?: Sending;
  onPick: (role: EventRole) => void;
  testID: string;
}) {
  return (
    <View accessibilityRole="radiogroup">
      <RoleChoices
        roles={EVENT_ROLES}
        picked={picked}
        lines={ROLE_LINES}
        off={{ roles: off, line: LEAD_OFF }}
        pickedTag={PICKED_TAG[sending]}
        onPick={onPick}
        testID={testID}
      />
    </View>
  );
}

/** Done in Violet, 44 square, closing a sheet that applies what is tapped. */
export function DoneAction({ onPress, testID }: { onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.done, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Done"
      testID={testID}
    >
      <Text size={17} weight="semibold" accessible={false} style={styles.accent}>
        Done
      </Text>
    </Pressable>
  );
}

/** A person's row opened: who they are, their role on the event saved as it is picked, and Remove, which asks first. */
export function RoleSheet({
  person,
  open,
  roleFails,
  opener,
  onSaved,
  onClose,
  onRemove,
}: {
  person: OnEvent;
  open: boolean;
  roleFails: boolean;
  opener: Opener;
  onSaved: (role: EventRole) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const { layout } = useShell();
  const phone = layout === 'phone';
  const [picked, setPicked] = useState<EventRole>(person.role);
  const [sending, setSending] = useState<Sending>('idle');
  const [failed, setFailed] = useState<{ line: string; times: number } | null>(null);
  const [removing, setRemoving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nothing is sent in the demo: the timer stands in for the request, and roleFails for its failing.
  function pick(role: EventRole): void {
    if (role === picked) return;
    if (timer.current != null) clearTimeout(timer.current);
    setPicked(role);
    setSending('saving');
    readOut(SAVING);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (roleFails) {
        setPicked(person.role);
        setSending('idle');
        setFailed((was) => ({ line: notChangedLine(person), times: (was?.times ?? 0) + 1 }));
        return;
      }
      onSaved(role);
      setSending('saved');
      setFailed(null);
      readOut(savedWords(person, role));
    }, SAVE_MS);
  }

  const ask: AskProps = {
    title: removeTitle(person),
    line: removeLine(person),
    keep: { label: `Keep ${firstName(person)}`, testID: 'people.remove.keep' },
    confirm: { label: 'Remove', removes: true, testID: 'people.remove.confirm' },
    onKeep: () => setRemoving(false),
    onConfirm: onRemove,
  };
  const parts = (
    <>
      <View style={styles.person}>
        <Face person={person} side={44} />
        <View style={styles.grow}>
          <Text size={18} weight="bold" accessibilityRole="header">
            {person.name}
          </Text>
          <Text size={14} weight="medium" style={styles.secondary}>
            {sheetLine(person)}
          </Text>
        </View>
        {phone && <DoneAction onPress={onClose} testID="people.role.done" />}
      </View>
      {person.outside && <Line text={OUTSIDE_ENDS} size={14} />}
      {failed != null && (
        <ReadOut
          words={failed.line}
          answer={failed.times}
          interrupts
          accessibilityRole="alert"
          style={styles.failed}
        >
          <Glyph name="alert" size={18} ink={tokens.colorBroken} weight={2.3} />
          <Text size={15} weight="medium" style={styles.grow}>
            {failed.line}
          </Text>
        </ReadOut>
      )}
      <EventRoles
        picked={picked}
        off={rolesOff(person)}
        sending={sending}
        onPick={pick}
        testID="people.role"
      />
      <View style={styles.remove}>
        <TextAction
          label="Remove from this event…"
          removes
          onPress={() => setRemoving(true)}
          testID="people.remove"
        />
      </View>
    </>
  );

  if (!phone)
    return (
      <FocusedScreen
        open={open}
        title="Role on this event"
        cancels={false}
        verb={{ label: 'Done', on: true, onPress: onClose, testID: 'people.role.done' }}
        onCancel={onClose}
        opener={opener}
        ask={removing ? ask : null}
        testID="people.roleSheet"
      >
        {parts}
      </FocusedScreen>
    );

  // iOS puts up one window at a time, so on the phone the Ask takes the sheet's place while it asks.
  return (
    <>
      <Sheet
        open={open && !removing}
        onClose={onClose}
        scrimLabel="Close"
        opener={opener}
        headingTakesFocus
        testID="people.roleSheet"
      >
        <View style={styles.sheetBody}>{parts}</View>
      </Sheet>
      <Ask open={open && removing} opener={opener} {...ask} />
    </>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceHair,
    paddingBottom: tokens.spaceXxs,
  },
  done: {
    minWidth: tokens.sizeHit,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: tokens.spaceLg,
    paddingRight: tokens.spaceXxs,
  },
  failed: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  remove: { borderTopWidth: 1, borderTopColor: tokens.colorBorder, paddingTop: tokens.spaceXxs },
  sheetBody: {
    gap: tokens.spaceLg,
    paddingTop: 27,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceLg,
  },
});
