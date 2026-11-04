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
  Line,
  Row,
  RowList,
  SectionHead,
} from '../settings/Summary.tsx';
import {
  type Adding,
  type Address,
  addView,
  type EventRole,
  FIRST_ROLE,
  FROM_OUTSIDE,
  fieldLabel,
  IN_ORGANISATION,
  JOB_LABEL,
  JOB_LIMIT,
  jobHelp,
  LEAD_MEMBERS,
  linkLine,
  NOT_AN_ADDRESS,
  noMatchLine,
  offerLine,
  type OnEvent,
  type OrgMember,
  OUT_FOOT,
  outsiderFor,
  type PeopleViewer,
  PICK_ANOTHER,
  ROLE_LINES,
} from './PeopleSample.ts';
import { DoneAction, EventRoles, Face } from './PeopleRole.tsx';

const THEIR_ROLE = 'Their role';
const TICKED_INSET = 24 + tokens.spaceLg + 40 + tokens.spaceLg;

/** Add people on its own screen: their role first, then members to tick or someone from outside by their address. */
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
  onAdd: (role: EventRole, adding: Adding) => void;
}) {
  const [role, setRole] = useState<EventRole>(FIRST_ROLE);
  const [picking, setPicking] = useState(false);
  const [typed, setTyped] = useState('');
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [outsideOff, setOutsideOff] = useState(false);
  const [job, setJob] = useState<{ of: string; text: string } | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const roleRow = useRef<ViewInstance>(null);
  const view = addView(role, typed, members, onEvent);
  const tickedMembers = members.filter((one) => ticked.includes(one.id));
  const address = view.kind === 'outside' && !outsideOff ? view.address : null;
  const jobText = (outsider: OnEvent): string =>
    job?.of === outsider.id ? job.text : (outsider.label ?? '');
  const canAdd =
    (view.kind === 'members' && tickedMembers.length > 0) ||
    (view.kind === 'outside' && (address != null || tickedMembers.length > 0));

  function add(): void {
    if (!canAdd) return;
    const outside =
      address == null ? null : { address, label: jobText(outsiderFor(address, onEvent)) };
    onAdd(role, { members: tickedMembers, outside });
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
      <Field label={fieldLabel(role)}>
        <TextField
          autoFocus
          autoCapitalize="none"
          autoComplete="off"
          onChangeText={(text) => {
            setTyped(text);
            setOutsideOff(false);
          }}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={add}
          accessibilityLabel={fieldLabel(role)}
          testID="people.add.who"
        />
      </Field>
      {view.kind === 'members' && (
        <>
          {view.offered.length > 0 && (
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
          <Line text={role === 'Lead' ? LEAD_MEMBERS : OUT_FOOT} size={14} />
        </>
      )}
      {view.kind === 'outside' && (
        <Outsider
          address={view.address}
          outsider={outsiderFor(view.address, onEvent)}
          on={!outsideOff}
          job={jobText(outsiderFor(view.address, onEvent))}
          onTick={() => setOutsideOff((now) => !now)}
          onJob={(of, text) => setJob({ of, text })}
          onSubmit={add}
        />
      )}
      {view.kind === 'nobody' && (
        <Pair
          title={noMatchLine(view.typed)}
          line={view.notAnAddress ? NOT_AN_ADDRESS : undefined}
        />
      )}
      {view.kind === 'leadAddress' && <Pair title={LEAD_MEMBERS} line={PICK_ANOTHER} />}
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

/** Someone from outside, by the address typed: ticked to start, and the job label beside their name. */
function Outsider({
  address,
  outsider,
  on,
  job,
  onTick,
  onJob,
  onSubmit,
}: {
  address: Address;
  outsider: OnEvent;
  on: boolean;
  job: string;
  onTick: () => void;
  onJob: (of: string, text: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <View>
        <SectionHead title={FROM_OUTSIDE} />
        <Ticked
          on={on}
          face={<Face person={outsider} side={40} />}
          title={address.text}
          line={linkLine(address)}
          onPress={onTick}
          testID="people.add.outside"
        />
      </View>
      <Field label={JOB_LABEL} help={jobHelp(job.length)}>
        <TextField
          key={outsider.id}
          defaultValue={job}
          maxLength={JOB_LIMIT}
          autoCapitalize="sentences"
          onChangeText={(text) => onJob(outsider.id, text)}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={onSubmit}
          accessibilityLabel={JOB_LABEL}
          testID="people.add.job"
        />
      </Field>
    </>
  );
}

function Pair({ title, line }: { title: string; line?: string | undefined }) {
  return (
    <View style={styles.pair}>
      <Text size={16} weight="semibold">
        {title}
      </Text>
      {line != null && <Line text={line} />}
    </View>
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
  pair: { gap: tokens.spaceXs },
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
