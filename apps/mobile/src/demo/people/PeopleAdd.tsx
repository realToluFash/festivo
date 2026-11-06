import { type ReactNode, type RefObject, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field, TextField } from '../../components/Field.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';
import { useShell } from '../settings/Frame.tsx';
import { Avatar } from '../settings/parts.tsx';
import { CheckMark } from '../settings/SecurityTwoFactor.tsx';
import {
  type AskProps,
  FocusedScreen,
  type Layer,
  Row,
  RowList,
  SectionHead,
} from '../settings/Summary.tsx';
import {
  addView,
  type EventRole,
  FIRST_ROLE,
  IN_ORGANISATION,
  NAME_LABEL,
  noMatchLine,
  offerLine,
  type OnEvent,
  type OrgMember,
  type PeopleViewer,
  ROLE_LINES,
} from './PeopleSample.ts';
import { DoneAction, EventRoles } from './PeopleRole.tsx';

const THEIR_ROLE = 'Their role';
const TICKED_INSET = 24 + tokens.spaceLg + 40 + tokens.spaceLg;

/** Add people on its own screen: their role first, then members found by name to tick. */
export function AddScreen({
  open,
  members,
  onEvent,
  viewer,
  opener,
  onClose,
  onAdd,
}: {
  open: boolean;
  members: readonly OrgMember[];
  onEvent: readonly OnEvent[];
  viewer: PeopleViewer;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onAdd: (role: EventRole, adding: readonly OrgMember[]) => void;
}) {
  const [role, setRole] = useState<EventRole>(FIRST_ROLE);
  const [picking, setPicking] = useState(false);
  const [typed, setTyped] = useState('');
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [discarding, setDiscarding] = useState(false);
  const roleRow = useRef<ViewInstance>(null);
  const view = addView(typed, members, onEvent);
  const tickedMembers = members.filter((one) => ticked.includes(one.id));
  const canAdd = view.kind === 'members' && tickedMembers.length > 0;

  function add(): void {
    if (canAdd) onAdd(role, tickedMembers);
  }

  function cancel(): void {
    if (typed.trim() !== '' || ticked.length > 0) setDiscarding(true);
    else onClose();
  }

  function tick(id: string): void {
    setTicked((now) => (now.includes(id) ? now.filter((one) => one !== id) : [...now, id]));
  }

  const ask: AskProps | null = discarding
    ? {
        title: 'Discard your changes?',
        line: 'Nobody is added to this event.',
        keep: { label: 'Keep editing', testID: 'people.add.keep' },
        confirm: { label: 'Discard', removes: true, testID: 'people.add.discard' },
        onKeep: () => setDiscarding(false),
        onConfirm: onClose,
      }
    : null;
  const over: Layer | null = picking
    ? {
        layer: (
          <RoleLayer onClose={() => setPicking(false)}>
            <View style={styles.layerHead}>
              <Text size={18} weight="bold" accessibilityRole="header" style={styles.grow}>
                {THEIR_ROLE}
              </Text>
              <DoneAction onPress={() => setPicking(false)} testID="people.add.roles.done" />
            </View>
            <EventRoles picked={role} off={[]} onPick={setRole} testID="people.add.roles" />
          </RoleLayer>
        ),
        onClose: () => setPicking(false),
      }
    : null;

  return (
    <FocusedScreen
      open={open}
      title="Add people"
      verb={{ label: 'Add', on: canAdd, onPress: add, testID: 'people.add.add' }}
      onCancel={cancel}
      cancelTestID="people.add.cancel"
      opener={opener}
      ask={ask}
      over={over}
      testID="people.add"
    >
      <View>
        <SectionHead title={THEIR_ROLE} />
        <Row
          ref={roleRow}
          title={role}
          line={ROLE_LINES[role]}
          accent
          trail={<Glyph name="down" size={18} ink={tokens.colorAccentText} weight={2.3} />}
          onPress={() => {
            Keyboard.dismiss();
            setPicking(true);
          }}
          accessibilityLabel={`${THEIR_ROLE}: ${role}. ${ROLE_LINES[role]}`}
          testID="people.add.role"
        />
      </View>
      <Field label={NAME_LABEL}>
        <TextField
          autoFocus
          autoCapitalize="words"
          autoComplete="off"
          onChangeText={setTyped}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={add}
          accessibilityLabel={NAME_LABEL}
          testID="people.add.who"
        />
      </Field>
      {view.kind === 'members' && view.offered.length > 0 && (
        <View>
          <SectionHead title={IN_ORGANISATION} />
          <RowList
            items={view.offered.map((member) => ({
              key: member.id,
              inset: TICKED_INSET,
              row: (
                <Ticked
                  on={ticked.includes(member.id)}
                  face={<Avatar initials={member.initials} side={40} tone={member.tone} />}
                  title={member.name}
                  line={offerLine(member, viewer)}
                  onPress={() => tick(member.id)}
                  testID={`people.add.member.${member.id}`}
                />
              ),
            }))}
          />
        </View>
      )}
      {view.kind === 'nobody' && (
        <Text size={16} weight="semibold">
          {noMatchLine(view.typed)}
        </Text>
      )}
    </FocusedScreen>
  );
}

function Ticked({
  on,
  face,
  title,
  line,
  onPress,
  testID,
}: {
  on: boolean;
  face: ReactNode;
  title: string;
  line: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Row
      title={title}
      line={line}
      lead={
        <View style={styles.ticked}>
          <CheckMark on={on} />
          {face}
        </View>
      }
      onPress={onPress}
      accessibilityLabel={`${title}. ${line}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      testID={testID}
    />
  );
}

/** A sheet over the screen inside its window: the bottom sheet on a phone, a 540 card on an iPad; Done or a tap on the dimmed screen closes it. */
function RoleLayer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { layout } = useShell();
  const insets = useSafeAreaInsets();
  const phone = layout === 'phone';

  return (
    <View style={[StyleSheet.absoluteFill, phone ? styles.under : styles.underCard]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View
        style={
          phone
            ? [styles.sheet, { paddingBottom: insets.bottom + tokens.spaceLg }]
            : [styles.card, { marginTop: insets.top }]
        }
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
      >
        {phone && <View style={styles.grabber} pointerEvents="none" />}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  ticked: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  layerHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  under: { justifyContent: 'flex-end', backgroundColor: tokens.scrimSheet },
  underCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spaceXxl,
    backgroundColor: tokens.scrimDialog,
  },
  sheet: {
    gap: tokens.spaceLg,
    paddingTop: 27,
    paddingHorizontal: tokens.spaceXxl,
    borderTopLeftRadius: tokens.radiusSheet,
    borderTopRightRadius: tokens.radiusSheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  card: {
    width: '100%',
    maxWidth: 540,
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space5xl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
  },
  grabber: {
    position: 'absolute',
    top: tokens.spaceSm,
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: tokens.colorControlBorder,
  },
});
