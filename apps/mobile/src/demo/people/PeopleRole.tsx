import { type RefObject, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ReadOut, readOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { RoleChoices } from '../settings/MembersRequest.tsx';
import {
  EVENT_ROLES,
  type EventRole,
  firstName,
  HELD_MS,
  joinedWithLine,
  LEAD_OFF,
  leadOff,
  notChangedLine,
  type OnEvent,
  ORGANISATION,
  OUTSIDE_ENDS,
  REMOVING,
  removeLine,
  type Removing,
  removeTitle,
  ROLE_LINES,
  rolesOff,
  SAVE_MS,
  savedWords,
  SAVING,
  sheetLine,
} from './PeopleSample.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Avatar } from '../../components/SettingsParts.tsx';
import {
  Ask,
  type AskProps,
  FocusedScreen,
  Line,
  type RowTag,
  TextAction,
} from '../../components/Summary.tsx';

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
  offLine = LEAD_OFF,
  sending = 'idle',
  onPick,
  testID,
}: {
  picked: EventRole;
  off: readonly EventRole[];
  offLine?: string;
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
        off={{ roles: off, line: offLine }}
        pickedTag={PICKED_TAG[sending]}
        onPick={onPick}
        testID={testID}
      />
    </View>
  );
}

/** Done in Violet, 44 square, closing a sheet that applies what is tapped. */
export function DoneAction({
  label = 'Done',
  onPress,
  testID,
}: {
  label?: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.done, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text size={17} weight="semibold" accessible={false} style={styles.accent}>
        {label}
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
  organisation = ORGANISATION,
  removingAtStart = null,
  locale = 'en',
  today,
  onSaved,
  onClose,
  onRemove,
}: {
  person: OnEvent;
  open: boolean;
  roleFails: boolean;
  opener: Opener;
  organisation?: string;
  removingAtStart?: Removing;
  locale?: string;
  today?: string | undefined;
  onSaved: (role: EventRole) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const { layout } = useShell();
  const phone = layout === 'phone';
  const [picked, setPicked] = useState<EventRole>(person.role);
  const [sending, setSending] = useState<Sending>('idle');
  const [failed, setFailed] = useState<{ line: string; times: number } | null>(null);
  const [removing, setRemoving] = useState<Removing>(removingAtStart);
  const held = useRef(removingAtStart === 'sending');
  const removeNow = useRef(onRemove);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    removeNow.current = onRemove;
  }, [onRemove]);

  useEffect(() => {
    if (removing !== 'sending') return;
    const gone = setTimeout(() => removeNow.current(), held.current ? HELD_MS : SAVE_MS);
    held.current = false;

    return () => clearTimeout(gone);
  }, [removing]);

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
    keep: {
      label: `Keep ${firstName(person)}`,
      off: removing === 'sending',
      testID: 'people.remove.keep',
    },
    confirm: {
      label: 'Remove',
      removes: true,
      busy: removing === 'sending' ? REMOVING : undefined,
      testID: 'people.remove.confirm',
    },
    onKeep: () => setRemoving((now) => (now === 'sending' ? now : null)),
    onConfirm: () => setRemoving('sending'),
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
            {sheetLine(person, organisation)}
          </Text>
        </View>
        {phone && <DoneAction onPress={onClose} testID="people.role.done" />}
      </View>
      {person.outside && (
        <View style={styles.outside}>
          {person.byCode != null && (
            <Line text={joinedWithLine(person.byCode, locale, today)} size={14} />
          )}
          <Line text={OUTSIDE_ENDS} size={14} />
        </View>
      )}
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
        offLine={leadOff(organisation)}
        sending={sending}
        onPick={pick}
        testID="people.role"
      />
      <View style={styles.remove}>
        <TextAction
          label="Remove from this event…"
          removes
          onPress={() => setRemoving('ask')}
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
        ask={removing != null ? ask : null}
        testID="people.roleSheet"
      >
        {parts}
      </FocusedScreen>
    );

  // iOS puts up one window at a time, so on the phone the Ask takes the sheet's place while it asks.
  return (
    <>
      <Sheet
        open={open && removing == null}
        onClose={onClose}
        scrimLabel="Close"
        opener={opener}
        headingTakesFocus
        testID="people.roleSheet"
      >
        <View style={styles.sheetBody}>{parts}</View>
      </Sheet>
      <Ask open={open && removing != null} opener={opener} {...ask} />
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
  outside: { gap: tokens.spaceHair },
  remove: { borderTopWidth: 1, borderTopColor: tokens.colorBorder, paddingTop: tokens.spaceXxs },
  sheetBody: {
    gap: tokens.spaceLg,
    paddingTop: 27,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceLg,
  },
});
