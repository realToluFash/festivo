import { type RefObject, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RadioMark } from '../../components/RadioMark.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  approvalRoles,
  DEADLINES,
  firstName,
  type MembersSay,
  ORGANISATION,
  type Person,
  ROLE_MEANS,
} from './MembersSample.ts';
import { Avatar } from './parts.tsx';
import {
  type AskProps,
  FocusedScreen,
  Line,
  Row,
  RowList,
  type RowTag,
  Section,
  TextAction,
} from './Summary.tsx';

const NOW_TAG: RowTag = { kind: 'now', word: 'Now' };

const NOTE =
  'Only people who manage members see these requests. Nobody is added until one of you approves them.';
const FIRST_ROLE = 'Member';

/** A request to join, on its own screen: Approve with a role, Member first; turning it down asks first. */
export function RequestScreen({
  person,
  open,
  turningDown,
  say,
  opener,
  onTurningDown,
  onClose,
  onApprove,
  onTurnDown,
}: {
  person: Person;
  open: boolean;
  turningDown: boolean;
  say: MembersSay;
  opener: RefObject<ScreenReaderTarget | null>;
  onTurningDown: (asking: boolean) => void;
  onClose: () => void;
  onApprove: (role: string) => void;
  onTurnDown: () => void;
}) {
  const [role, setRole] = useState(FIRST_ROLE);
  const [discarding, setDiscarding] = useState(false);
  const ask: AskProps | null = turningDown
    ? {
        title: `Turn down ${person.name}?`,
        line: 'They are not added, and they are listed under Former.',
        keep: { label: 'Keep the request', testID: 'members.turnDown.keep' },
        confirm: { label: 'Turn down', testID: 'members.turnDown.confirm', removes: true },
        onKeep: () => onTurningDown(false),
        onConfirm: onTurnDown,
      }
    : discarding
      ? {
          title: 'Discard your change?',
          line: `${firstName(person)}'s request keeps waiting.`,
          keep: { label: 'Keep editing', testID: 'members.approve.keep' },
          confirm: { label: 'Discard', testID: 'members.approve.discard', removes: true },
          onKeep: () => setDiscarding(false),
          onConfirm: onClose,
        }
      : null;

  return (
    <FocusedScreen
      open={open}
      title={`${firstName(person)}'s request`}
      verb={{
        label: 'Approve',
        on: true,
        onPress: () => onApprove(role),
        testID: 'members.approve.confirm',
      }}
      onCancel={() => (role === FIRST_ROLE ? onClose() : setDiscarding(true))}
      cancelTestID="members.approve.cancel"
      opener={opener}
      ask={ask}
    >
      <View style={styles.head}>
        <Avatar initials={person.initials} side={56} tone={person.tone} />
        <View style={styles.headWords}>
          <Text size={22} weight="bold">
            {person.name}
          </Text>
          <Text size={15} weight="medium" style={styles.secondary}>
            {person.email}
          </Text>
        </View>
      </View>
      <Line
        quiet={false}
        text={`Asked to join ${ORGANISATION} on ${say.day(person.when)}. Removed on ${say.deadline(DEADLINES.lucia)} if nobody answers.`}
      />
      <Line text={NOTE} />
      <Section title="Role" foot="Owner is given from Members once they have joined.">
        <View accessibilityRole="radiogroup">
          <RoleChoices
            roles={approvalRoles()}
            picked={role}
            onPick={setRole}
            testID="members.approveAs"
          />
        </View>
      </Section>
      <TextAction
        label="Turn down the request…"
        removes
        onPress={() => onTurningDown(true)}
        consequence={`${person.name} is emailed that their request to join ${ORGANISATION} was turned down. The email does not say who turned it down.`}
        testID="members.turnDown"
      />
    </FocusedScreen>
  );
}

/** Radio rows, each role with what it means; the picked one in Violet, Now on the role held today, and any role not offered dimmed with why. */
export function RoleChoices<R extends string>({
  roles,
  picked,
  now,
  owned,
  lines = ROLE_MEANS,
  off,
  pickedTag,
  onPick,
  testID,
}: {
  roles: readonly R[];
  picked: R;
  now?: R | null;
  owned?: string;
  lines?: Readonly<Record<string, string>>;
  off?: { roles: readonly R[]; line: string };
  pickedTag?: RowTag | null;
  onPick: (role: R) => void;
  testID: string;
}) {
  return (
    <RowList
      items={roles.map((role) => {
        const on = role === picked;
        const dim = off?.roles.includes(role) === true;
        const means = dim
          ? (off?.line ?? '')
          : [lines[role], role === 'Owner' ? owned : undefined]
              .filter((part) => part != null)
              .join(' ');

        return {
          key: role,
          row: (
            <Row
              title={role}
              line={means === '' ? undefined : means}
              tag={on && pickedTag != null ? pickedTag : role === now ? NOW_TAG : null}
              accent={on}
              off={dim}
              trail={<RadioMark on={on} />}
              onPress={() => onPick(role)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              testID={`${testID}.${role}`}
            />
          ),
        };
      })}
    />
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: tokens.spaceXs },
  headWords: { flex: 1, minWidth: 0, gap: 2 },
});
