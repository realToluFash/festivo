import { type RefObject, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { Field, TextField } from '../../components/Field.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { DoneAction, EventRoles, RoleLayer, Ticked } from '../../components/PeopleParts.tsx';
import { ReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Avatar } from '../../components/SettingsParts.tsx';
import {
  type AskProps,
  FocusedScreen,
  type Layer,
  Line,
  Row,
  RowList,
  SectionHead,
} from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { addInTurn } from '../../kit/addInTurn.ts';
import { tokens } from '../../theme/tokens.ts';
import { JOB_MOST } from '../doorCode/DoorCodeModel.ts';
import { jobCount, W } from '../doorCode/DoorCodeWords.ts';
import {
  type Address,
  addView,
  addWords,
  type EventRole,
  FIRST_ROLE,
  fromOutside,
  leadOff,
  NAME_LABEL,
  offerLine,
  onAlreadyLine,
  type OnEvent,
  ORGANISATION,
  type OrgMember,
  outsideRefusal,
  outsideView,
  type PeopleViewer,
  PICK_ANOTHER,
  UNUSABLE,
} from './PeopleSample.ts';

const SEND_MS = 400;
const TICKED_INSET = 24 + tokens.spaceLg + 40 + tokens.spaceLg;

export interface Added {
  role: EventRole;
  members: readonly OrgMember[];
  outside: { address: Address; job: string } | null;
}

function later(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/** Add people on sample data: members a name finds, and someone from outside by their email address or mobile number (sc-71), sent in turn, nothing to the API. */
export function AddScreen({
  open,
  members,
  onEvent,
  viewer,
  organisation = ORGANISATION,
  country,
  opener,
  refuses,
  startTyped = '',
  startRole = FIRST_ROLE,
  onClose,
  onAdd,
}: {
  open: boolean;
  members: readonly OrgMember[];
  onEvent: readonly OnEvent[];
  viewer: PeopleViewer;
  organisation?: string;
  country: string;
  opener: RefObject<ScreenReaderTarget | null>;
  refuses?: string | undefined;
  startTyped?: string | undefined;
  startRole?: EventRole | undefined;
  onClose: () => void;
  onAdd: (added: Added, finished: boolean) => void;
}) {
  const [role, setRole] = useState<EventRole>(startRole);
  const [picking, setPicking] = useState(false);
  const [typed, setTyped] = useState(startTyped);
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [outsideOn, setOutsideOn] = useState(true);
  const [job, setJob] = useState('');
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ line: string; times: number } | null>(null);
  const nothingLeft = (() => {
    const all = addView('', members, onEvent);
    return all.kind === 'members' && all.offered.length === 0;
  })();
  const words = addWords(organisation, nothingLeft);
  const view = addView(typed, members, onEvent);
  const shown = view.kind === 'members' ? view.offered : [];
  const outside = outsideView(typed, country, role, onEvent);
  const offered = outside.kind === 'offer' ? outside.address : null;
  const sendsOutside = offered != null && outsideOn;
  const canAdd = (ticked.length > 0 || sendsOutside) && !busy;
  const nobody =
    typed.trim() !== '' &&
    shown.length === 0 &&
    outside.kind !== 'offer' &&
    outside.kind !== 'leadOff';
  const find = role === 'Lead' ? NAME_LABEL : words.find;

  async function send(): Promise<void> {
    if (!canAdd) return;
    setBusy(true);
    setFailed(null);
    const address = sendsOutside ? offered : null;
    const ids = [...ticked, ...(address == null ? [] : [address.address])];
    const sent = await addInTurn<string>(ids, async (id) => {
      await later(SEND_MS);
      if (address != null && id === address.address) {
        const refusal = outsideRefusal(address, members);
        if (refusal != null) throw refusal;
        return id;
      }
      if (id === refuses || !members.some((one) => one.id === id))
        throw new Error(`${id} is not added in the sample.`);
      return id;
    });
    const went = sent.kind === 'all' ? ids : sent.went;
    const added: Added = {
      role,
      members: members.filter((one) => went.includes(one.id)),
      outside: address != null && went.includes(address.address) ? { address, job } : null,
    };
    if (sent.kind === 'all') {
      onAdd(added, true);
      return;
    }
    const nameOf = (id: string) =>
      id === address?.address ? address.shown : (members.find((one) => one.id === id)?.name ?? id);
    setBusy(false);
    setTicked((now) => now.filter((id) => !went.includes(id)));
    if (added.outside != null) {
      setTyped('');
      setJob('');
    }
    const line = words.refusal(sent.error, role, went.map(nameOf), sent.left.map(nameOf));
    setFailed((was) => ({ line, times: (was?.times ?? 0) + 1 }));
    if (went.length > 0) onAdd(added, false);
  }

  function cancel(): void {
    if (typed.trim() !== '' || ticked.length > 0) setDiscarding(true);
    else onClose();
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
        onKeep: () => setDiscarding(false),
        onConfirm: onClose,
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
  const roleName = words.name(role);
  const roleMeans = words.means(role);

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
      {failed != null && (
        <ReadOut words={failed.line} answer={failed.times} style={styles.notice}>
          <Glyph name="alert" size={18} ink={tokens.colorAttention} weight={2.3} />
          <Text size={15} weight="medium" style={[styles.grow, styles.noticeText]}>
            {failed.line}
          </Text>
        </ReadOut>
      )}
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
          value={typed}
          autoFocus={startTyped === ''}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
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
      {nobody && (
        <View style={styles.lines}>
          <Text size={16} weight="semibold">
            {words.noMatch(typed.trim())}
          </Text>
          {outside.kind === 'unusable' && <Line text={UNUSABLE} />}
          {outside.kind === 'onEvent' && <Line text={onAlreadyLine(outside.name)} />}
        </View>
      )}
      {outside.kind === 'leadOff' && (
        <View style={styles.lines}>
          <Text size={16} weight="semibold">
            {leadOff(organisation)}
          </Text>
          <Line text={PICK_ANOTHER} />
        </View>
      )}
      {offered != null && (
        <View style={styles.outside}>
          <View>
            <SectionHead title={fromOutside(organisation)} />
            <Ticked
              on={outsideOn}
              face={
                <Avatar
                  initials=""
                  side={40}
                  tone={onEvent.length}
                  glyph={offered.kind === 'email' ? 'mail' : 'phone'}
                />
              }
              title={offered.shown}
              onPress={() => setOutsideOn((now) => !now)}
              testID="people.add.outside"
            />
          </View>
          {outsideOn && (
            <Field label={W.jobLabel} help={jobCount(job)}>
              <TextField
                value={job}
                onChangeText={setJob}
                maxLength={JOB_MOST}
                autoCapitalize="sentences"
                returnKeyType="done"
                submitBehavior="submit"
                onSubmitEditing={() => void send()}
                accessibilityLabel={W.jobLabel}
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

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  layerHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  noticeText: { color: tokens.colorAttentionText },
  lines: { gap: tokens.spaceXs },
  outside: { gap: tokens.spaceLg },
});
