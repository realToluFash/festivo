import { type ReactNode, type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addInTurn } from '../kit/addInTurn.ts';
import { type Address, type OutsideView, outsideView } from '../kit/eventPeople.ts';
import { toneOf } from '../kit/personFace.ts';
import { type PickAnswer, RolePicks } from '../kit/rolePicks.ts';
import { tokens } from '../theme/tokens.ts';
import { Field, TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { ReadOut, readOut, useReadOut } from './ReadOut.tsx';
import { addressRuns, breakableEmail, headingAddress } from '../kit/addressBreaks.ts';
import { RoleChoices } from './RoleChoices.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { CheckMark } from './SecurityTwoFactor.tsx';
import { useShellLayout } from './settingsShell.ts';
import { Avatar } from './SettingsParts.tsx';
import { Sheet } from './Sheet.tsx';
import {
  Ask,
  type AskProps,
  FocusedScreen,
  type Layer,
  Line,
  Row,
  RowList,
  type RowTag,
  SectionHead,
  TextAction,
} from './Summary.tsx';
import { Text } from './Text.tsx';
import { useLeaveAsk } from './useLeaveAsk.ts';

type Opener = RefObject<ScreenReaderTarget | null>;
type Sending = 'idle' | 'saving' | 'saved';
export type Removing = 'ask' | 'sending' | null;

const TICKED_INSET = 24 + tokens.spaceLg + 40 + tokens.spaceLg;

export interface RoleWords<R extends string> {
  roles: readonly R[];
  name: (role: R) => string;
  means: (role: R) => string;
  saving: string;
  saved: string;
}

/** Initials, or with none a mark: mail or phone for an address, a plain person for "Not joined yet". */
export function PersonFace({
  initials,
  tone,
  side,
  mark = 'phone',
}: {
  initials: string | null;
  tone: number;
  side: number;
  mark?: 'mail' | 'phone' | 'user';
}) {
  return (
    <Avatar
      initials={initials ?? ''}
      side={side}
      tone={tone}
      glyph={initials == null ? mark : undefined}
    />
  );
}

export function AddBox({
  ref,
  label,
  onPress,
}: {
  ref: Ref<ViewInstance>;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [styles.addBox, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="people.add.open"
    >
      <Glyph name="plus" size={19} ink={tokens.colorAccent} weight={2.4} />
      <Text size={16} weight="medium" accessible={false} style={styles.secondary}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EventRoles<R extends string>({
  words,
  picked,
  off,
  sending = 'idle',
  onPick,
  testID,
}: {
  words: RoleWords<R>;
  picked: R;
  off?: { roles: readonly R[]; line: string } | undefined;
  sending?: Sending;
  onPick: (role: R) => void;
  testID: string;
}) {
  const lines: Partial<Record<R, string>> = {};
  for (const role of words.roles) lines[role] = words.means(role);
  const tag: RowTag | null =
    sending === 'saving'
      ? { kind: 'now', word: words.saving, turning: true }
      : sending === 'saved'
        ? { kind: 'yes', word: words.saved }
        : null;

  return (
    <View accessibilityRole="radiogroup">
      <RoleChoices
        roles={words.roles}
        name={words.name}
        picked={picked}
        lines={lines}
        off={off}
        pickedTag={tag}
        onPick={onPick}
        testID={testID}
      />
    </View>
  );
}

export function DoneAction({
  label,
  onPress,
  testID,
}: {
  label: string;
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

function Refused({ failed }: { failed: { line: string; times: number } }) {
  return (
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
  );
}

export interface RoleSheetWords<R extends string> extends RoleWords<R> {
  title: string;
  done: string;
  remove: string;
  removeTitle: string;
  removeLine: string;
  keep: string;
  removeConfirm: string;
  removing: string;
  savedHeard: (role: R) => string;
  notChanged: (held: R) => string;
  removeFailed: (error: unknown) => string;
}

/** `save` applies the change wherever it lives before it resolves, so a pick overtaken by a later one still lands. */
export function RoleSheet<R extends string>({
  person,
  notes,
  start,
  off,
  words,
  open,
  opener,
  removingAtStart = null,
  save,
  remove,
  onClose,
  onRemoved,
}: {
  person: { name: string; line: string; face: ReactNode };
  notes?: ReactNode;
  start: R;
  off?: { roles: readonly R[]; line: string } | undefined;
  words: RoleSheetWords<R>;
  open: boolean;
  opener: Opener;
  removingAtStart?: Removing;
  save: (role: R) => Promise<R>;
  remove: () => Promise<void>;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const phone = useShellLayout() === 'phone';
  const [picked, setPicked] = useState<R>(start);
  const [sending, setSending] = useState<Sending>('idle');
  const [failed, setFailed] = useState<{ line: string; times: number } | null>(null);
  const [removing, setRemoving] = useState<Removing>(removingAtStart);
  const [removeFailed, setRemoveFailed] = useState<string | null>(null);
  const [picks] = useState(() => new RolePicks(start));
  const removesAtStart = useRef(removingAtStart === 'sending');

  function sendRemove(): void {
    setRemoving('sending');
    setRemoveFailed(null);
    remove().then(onRemoved, (error: unknown) => {
      setRemoving('ask');
      setRemoveFailed(words.removeFailed(error));
    });
  }

  useEffect(() => {
    if (!removesAtStart.current) return;
    removesAtStart.current = false;
    sendRemove();
  });

  function pick(role: R): void {
    if (role === picked) return;
    const sent = picks.pick();
    setPicked(role);
    setSending('saving');
    setFailed(null);
    readOut(words.saving);
    save(role).then(
      (saved) => shown(picks.saved(sent, saved)),
      () => shown(picks.refused(sent)),
    );
  }

  function shown(answer: PickAnswer<R>): void {
    if (answer == null) return;
    if (answer.kind === 'saved') {
      setSending('saved');
      readOut(words.savedHeard(answer.role));
    } else if (answer.kind === 'overtaken') {
      setPicked(answer.role);
      setFailed((was) => (was == null ? null : { ...was, line: words.notChanged(answer.role) }));
    } else {
      setPicked(answer.held);
      setSending('idle');
      setFailed((was) => ({ line: words.notChanged(answer.held), times: (was?.times ?? 0) + 1 }));
    }
  }

  const ask: AskProps = {
    title: addressRuns(person.name) == null ? words.removeTitle : breakableEmail(words.removeTitle),
    line: words.removeLine,
    keep: { label: words.keep, off: removing === 'sending', testID: 'people.remove.keep' },
    confirm: {
      label: words.removeConfirm,
      removes: true,
      busy: removing === 'sending' ? words.removing : undefined,
      busyWords: words.removing,
      testID: 'people.remove.confirm',
    },
    failed: removeFailed,
    onKeep: () => setRemoving((now) => (now === 'sending' ? now : null)),
    onConfirm: sendRemove,
  };
  const parts = (
    <>
      <View style={styles.person}>
        {person.face}
        <View style={styles.grow}>
          <Text size={18} weight="bold" accessibilityRole="header" accessibilityLabel={person.name}>
            {headingAddress(person.name) ?? person.name}
          </Text>
          <Text size={14} weight="medium" style={styles.secondary}>
            {person.line}
          </Text>
        </View>
        {phone && (
          <View style={styles.doneBesideName}>
            <DoneAction label={words.done} onPress={onClose} testID="people.role.done" />
          </View>
        )}
      </View>
      {notes}
      {failed != null && <Refused failed={failed} />}
      <EventRoles
        words={words}
        picked={picked}
        off={off}
        sending={sending}
        onPick={pick}
        testID="people.role"
      />
      <View style={styles.remove}>
        <TextAction
          label={words.remove}
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
        title={words.title}
        cancels={false}
        verb={{ label: words.done, on: true, onPress: onClose, testID: 'people.role.done' }}
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
        scrimLabel={words.done}
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

export function Ticked({
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
  line?: string | undefined;
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
      accessibilityLabel={line == null ? title : `${title}. ${line}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      testID={testID}
    />
  );
}

export function RoleLayer({
  closeLabel,
  onClose,
  children,
}: {
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const layout = useShellLayout();
  const insets = useSafeAreaInsets();
  const phone = layout === 'phone';

  return (
    <View style={[StyleSheet.absoluteFill, phone ? styles.under : styles.underCard]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
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

export interface Offer {
  id: string;
  name: string;
  face: ReactNode;
  line?: string | undefined;
}

export interface AddWords<R extends string> extends RoleWords<R> {
  title: string;
  add: string;
  cancel: string;
  done: string;
  theirRole: string;
  find: string;
  inOrganisation: string;
  noMatch: (typed: string) => string;
  discardTitle: string;
  discardLine: string;
  discardKeep: string;
  discard: string;
  /** One line: who went in, if anyone did, then why the rest did not. */
  refusal: (error: unknown, role: R, went: readonly string[], left: readonly string[]) => string;
  /** Said when there is nobody left to add; none where nothing says it. */
  everyoneOn?: string | undefined;
}

/** Someone from outside the organisation, by email address or mobile number (sc-71). */
export interface OutsideAdd<R extends string, T> {
  country: string;
  lead: R;
  /** Who on the event already holds this address, if anyone. */
  holder: (address: Address) => string | null;
  add: (role: R, address: Address, job: string) => Promise<T>;
  words: {
    find: string;
    findName: string;
    fromOutside: string;
    leadOff: string;
    pickAnother: string;
    unusable: string;
    onAlready: (name: string) => string;
    jobLabel: string;
    jobHelp: (job: string) => string;
  };
}

const NO_OUTSIDE: OutsideView = { kind: 'none' };
const OUTSIDE_ID = 'outside:';

function Unsent({ failed }: { failed: { line: string; times: number } }) {
  return (
    <ReadOut words={failed.line} answer={failed.times} style={styles.failed}>
      <Glyph name="alert" size={18} ink={tokens.colorAttention} weight={2.3} />
      <Text size={15} weight="medium" style={[styles.grow, styles.notice]}>
        {failed.line}
      </Text>
    </ReadOut>
  );
}

/** Sends each ticked member in turn, then anyone from outside; a refusal stops there and leaves the screen open, the ones not added still ticked. */
export function AddScreen<R extends string, T>({
  open,
  first,
  startTyped = '',
  offered,
  outside,
  words,
  opener,
  onClose,
  add,
  onAdded,
}: {
  open: boolean;
  first: R;
  startTyped?: string | undefined;
  offered: (typed: string) => readonly Offer[];
  outside?: OutsideAdd<R, T> | undefined;
  words: AddWords<R>;
  opener: Opener;
  onClose: () => void;
  add: (role: R, id: string) => Promise<T>;
  onAdded: (role: R, added: readonly T[], finished: boolean) => void;
}) {
  const [role, setRole] = useState<R>(first);
  const [picking, setPicking] = useState(false);
  const [typed, setTyped] = useState(startTyped);
  const [cleared, setCleared] = useState(0);
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [outsideOn, setOutsideOn] = useState(true);
  const [job, setJob] = useState('');
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ line: string; times: number } | null>(null);
  const shown = offered(typed);
  const fromOutside =
    outside == null
      ? NO_OUTSIDE
      : outsideView(typed, outside.country, role === outside.lead, outside.holder);
  const address = fromOutside.kind === 'offer' ? fromOutside.address : null;
  const sendsOutside = address != null && outsideOn;
  const nobody =
    typed.trim() !== '' &&
    shown.length === 0 &&
    fromOutside.kind !== 'offer' &&
    fromOutside.kind !== 'leadOff';
  const canAdd = (ticked.length > 0 || sendsOutside) && !busy;
  const find =
    outside == null
      ? words.find
      : role === outside.lead
        ? outside.words.findName
        : outside.words.find;
  const roleName = words.name(role);
  const roleMeans = words.means(role);
  const leaves = useLeaveAsk(
    (typed.trim() !== '' || ticked.length > 0) && !busy,
    () => setDiscarding(true),
    onClose,
  );

  async function send(): Promise<void> {
    if (!canAdd) return;
    setBusy(true);
    setFailed(null);
    const going = sendsOutside ? address : null;
    const outsideId = going == null ? null : `${OUTSIDE_ID}${going.address}`;
    const ids = outsideId == null ? ticked : [...ticked, outsideId];
    const named = new Map(offered('').map((one) => [one.id, one.name]));
    const names = (all: readonly string[]) =>
      all.map((id) => (id === outsideId ? (going?.shown ?? '') : (named.get(id) ?? '')));
    const sent = await addInTurn(ids, (id) =>
      id === outsideId && going != null && outside != null
        ? outside.add(role, going, job.trim())
        : add(role, id),
    );
    if (sent.kind === 'all') {
      onAdded(role, sent.added, true);
      return;
    }
    const { added, went, left, error } = sent;
    setBusy(false);
    setTicked((now) => now.filter((id) => !went.includes(id)));
    if (outsideId != null && went.includes(outsideId)) {
      setTyped('');
      setJob('');
      setCleared((n) => n + 1);
    }
    const line = words.refusal(error, role, names(went), names(left));
    setFailed((was) => ({ line, times: (was?.times ?? 0) + 1 }));
    if (added.length > 0) onAdded(role, added, false);
  }

  function cancel(): void {
    leaves.leave();
  }

  function type(text: string): void {
    setTyped(text);
    setOutsideOn(true);
  }

  function tick(id: string): void {
    setTicked((now) => (now.includes(id) ? now.filter((one) => one !== id) : [...now, id]));
  }

  const ask: AskProps | null = discarding
    ? {
        title: words.discardTitle,
        line: words.discardLine,
        keep: { label: words.discardKeep, testID: 'people.add.keep' },
        confirm: { label: words.discard, removes: true, testID: 'people.add.discard' },
        onKeep: () => {
          setDiscarding(false);
          leaves.keep();
        },
        onConfirm: () => {
          setDiscarding(false);
          leaves.discard();
        },
      }
    : null;
  const over: Layer | null = picking
    ? {
        layer: (
          <RoleLayer closeLabel={words.done} onClose={() => setPicking(false)}>
            <View style={styles.layerHead}>
              <Text size={18} weight="bold" accessibilityRole="header" style={styles.grow}>
                {words.theirRole}
              </Text>
              <DoneAction
                label={words.done}
                onPress={() => setPicking(false)}
                testID="people.add.roles.done"
              />
            </View>
            <EventRoles words={words} picked={role} onPick={setRole} testID="people.add.roles" />
          </RoleLayer>
        ),
        onClose: () => setPicking(false),
      }
    : null;

  return (
    <FocusedScreen
      open={open}
      title={words.title}
      verb={{
        label: words.add,
        on: canAdd,
        busy,
        onPress: () => void send(),
        testID: 'people.add.add',
      }}
      cancelLabel={words.cancel}
      waits={busy}
      onCancel={cancel}
      cancelTestID="people.add.cancel"
      opener={opener}
      ask={ask}
      over={over}
      testID="people.add"
    >
      {failed != null && <Unsent failed={failed} />}
      <View>
        <SectionHead title={words.theirRole} />
        <Row
          title={roleName}
          line={roleMeans}
          accent
          trail={<Glyph name="down" size={18} ink={tokens.colorAccentText} weight={2.3} />}
          onPress={() => {
            Keyboard.dismiss();
            setPicking(true);
          }}
          accessibilityLabel={`${words.theirRole}: ${roleName}. ${roleMeans}`}
          testID="people.add.role"
        />
      </View>
      <Field label={find}>
        <TextField
          key={`who-${cleared}`}
          defaultValue={typed}
          autoFocus={startTyped === ''}
          autoCapitalize={outside == null ? 'words' : 'none'}
          autoComplete="off"
          autoCorrect={false}
          spellCheck={false}
          onChangeText={type}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => void send()}
          accessibilityLabel={find}
          testID="people.add.who"
        />
      </Field>
      {shown.length > 0 && (
        <View>
          <SectionHead title={words.inOrganisation} />
          <RowList
            items={shown.map((member) => ({
              key: member.id,
              inset: TICKED_INSET,
              row: (
                <Ticked
                  on={ticked.includes(member.id)}
                  face={member.face}
                  title={member.name}
                  line={member.line}
                  onPress={() => tick(member.id)}
                  testID={`people.add.member.${member.id}`}
                />
              ),
            }))}
          />
        </View>
      )}
      {nobody && (
        <View style={styles.lines}>
          <Text size={16} weight="semibold">
            {words.noMatch(typed.trim())}
          </Text>
          {outside != null && fromOutside.kind === 'unusable' && (
            <Line text={outside.words.unusable} />
          )}
          {outside != null && fromOutside.kind === 'onEvent' && (
            <Line text={outside.words.onAlready(fromOutside.name)} />
          )}
        </View>
      )}
      {outside != null && fromOutside.kind === 'leadOff' && (
        <View style={styles.lines}>
          <Text size={16} weight="semibold">
            {outside.words.leadOff}
          </Text>
          <Line text={outside.words.pickAnother} />
        </View>
      )}
      {outside != null && address != null && (
        <View style={styles.outside}>
          <View>
            <SectionHead title={outside.words.fromOutside} />
            <Ticked
              on={outsideOn}
              face={
                <PersonFace
                  initials={null}
                  tone={toneOf(address.address)}
                  side={40}
                  mark={address.kind === 'email' ? 'mail' : 'phone'}
                />
              }
              title={address.shown}
              onPress={() => setOutsideOn((now) => !now)}
              testID="people.add.outside"
            />
          </View>
          {outsideOn && (
            <Field label={outside.words.jobLabel} help={outside.words.jobHelp(job)}>
              <TextField
                key={`job-${cleared}`}
                defaultValue={job}
                onChangeText={setJob}
                autoCapitalize="sentences"
                returnKeyType="done"
                submitBehavior="submit"
                onSubmitEditing={() => void send()}
                accessibilityLabel={outside.words.jobLabel}
                testID="people.add.job"
              />
            </Field>
          )}
        </View>
      )}
      {words.everyoneOn != null && typed.trim() === '' && shown.length === 0 && (
        <Line text={words.everyoneOn} />
      )}
    </FocusedScreen>
  );
}

export function PeopleLoading({ words }: { words: string }) {
  useReadOut(words);

  return (
    <View
      style={styles.loading}
      accessible
      accessibilityLabel={words}
      accessibilityState={{ busy: true }}
    >
      {[1, 2].map((rows) => (
        <View key={rows} style={styles.sunkGroup}>
          <View style={styles.sunkHead} />
          <View style={styles.sunkLine} />
          <View>
            {Array.from({ length: rows }, (_, index) => (
              <View key={index}>
                {index > 0 && <View style={styles.sunkRule} />}
                <View style={styles.sunkRow}>
                  <View style={styles.sunkFace} />
                  <View style={[styles.sunkBar, { width: `${46 + 12 * index}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  notice: { color: tokens.colorAttentionText },
  pressed: { opacity: tokens.opacityPressed },
  addBox: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: 14,
    borderRadius: tokens.radiusInset,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceHair,
    paddingBottom: tokens.spaceXxs,
  },
  // Done's word level with the name's first line, however many lines the name takes.
  doneBesideName: { marginTop: -10 },
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
  lines: { gap: tokens.spaceXs },
  outside: { gap: tokens.spaceLg },
  loading: { gap: 26 },
  sunkGroup: { gap: tokens.spaceMd },
  sunkHead: {
    width: 96,
    height: 18,
    borderRadius: 9,
    backgroundColor: tokens.colorNeutralFill,
  },
  sunkLine: {
    width: '78%',
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.colorNeutralFill,
  },
  sunkRule: { height: 1, marginLeft: 52, backgroundColor: tokens.colorBorder },
  sunkRow: { height: 52, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  sunkFace: { width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colorNeutralFill },
  sunkBar: { height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
});
