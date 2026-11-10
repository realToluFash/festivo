import {
  type AddableMember,
  EVENT_ROLES,
  type EventPerson,
  type EventRole,
  type OrganisationEvent,
} from '@soirely/api-client';
import { initials } from '@soirely/domain';
import { type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Keyboard, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { api } from '../api.ts';
import { RoleChoices } from '../demo/settings/MembersRequest.tsx';
import { DoneAction } from '../demo/people/PeopleRole.tsx';
import { RoleLayer, Ticked } from '../demo/people/PeopleAdd.tsx';
import { PeopleLoading } from '../demo/people/PeopleFrame.tsx';
import { currentLocale } from '../i18n/index.ts';
import {
  inListOrder,
  managesPeople,
  nowCan,
  offered,
  opensRow,
  refusal,
  rowLine,
  seesEveryEvent,
} from '../kit/eventPeople.ts';
import { useLayout } from '../layout/useLayout.ts';
import { glide } from '../motion.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { Field, TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { ReadOut, readOut } from './ReadOut.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { Avatar } from './SettingsParts.tsx';
import { Sheet } from './Sheet.tsx';
import {
  Ask,
  type AskProps,
  FailedBlock,
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

type Opener = RefObject<ScreenReaderTarget | null>;
type Sending = 'idle' | 'saving' | 'saved';

/** `addable` is null for whoever may not change People: the API refuses them that list. */
type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | {
      kind: 'loaded';
      people: EventPerson[];
      owners: string[];
      admins: string[];
      addable: AddableMember[] | null;
    };

const LIT_MS = 2000;
const ROW_INSET = 40 + tokens.spaceLg;
const TICKED_INSET = 24 + tokens.spaceLg + 40 + tokens.spaceLg;
const FIRST_ROLE: EventRole = 'can_view';

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

function toneOf(id: string): number {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

/** People on an event, `People-OneList` (sc-29914): one list by role, each role changed in a sheet by Owners, Admins and the Lead. */
export function EventPeople({
  event,
  tell,
}: {
  event: OrganisationEvent;
  tell: (words: string | null) => void;
}) {
  const { t } = useTranslation();
  const { account, organisation } = useSignedIn();
  const locale = currentLocale();
  const userId = account?.id ?? null;
  const organisationName = organisation?.name ?? '';
  const manages = managesPeople(event);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [opened, setOpened] = useState<{ id: string; open: boolean; visit: number } | null>(null);
  const [adding, setAdding] = useState({ open: false, visit: 0 });
  const [lit, setLit] = useState<{ id: string; held: boolean } | null>(null);
  const [litFade] = useState(() => new Animated.Value(1));
  const addBox = useRef<ViewInstance>(null);
  const rows = useRef(new Map<string, ViewInstance>());
  const focusBack = useRef<ScreenReaderTarget | null>(null);

  useEffect(() => {
    let live = true;

    (async () => {
      const read = await api.eventPeople(event.id);
      const addable = manages ? await api.addableEventMembers(event.id) : null;

      return { ...read, addable };
    })().then(
      (loaded) => live && setLoad({ kind: 'loaded', ...loaded }),
      () => live && setLoad({ kind: 'failed' }),
    );

    return () => {
      live = false;
    };
  }, [event.id, attempt, manages]);

  useEffect(() => {
    if (lit == null || lit.held) return;
    const timer = setTimeout(() => {
      glide(litFade, 0, tokens.motionSlow).start(({ finished }) => {
        if (finished) setLit(null);
      });
    }, LIT_MS);

    return () => clearTimeout(timer);
  }, [lit, litFade]);

  if (load.kind === 'loading') return <PeopleLoading words={t('eventPeople.loading')} />;

  if (load.kind === 'failed')
    return (
      <FailedBlock
        title={t('eventPeople.failedTitle')}
        line={t('eventPeople.failedLine')}
        onRetry={() => {
          setLoad({ kind: 'loading' });
          setAttempt((n) => n + 1);
        }}
        testID="people.retry"
      />
    );

  const loaded = load;
  const people = inListOrder(loaded.people, locale);
  const person = opened == null ? null : (people.find((one) => one.id === opened.id) ?? null);
  const foot = seesEveryEvent(t, loaded, organisationName, locale);
  const adds = manages && loaded.addable != null;

  function openRole(one: EventPerson): void {
    focusBack.current = rows.current.get(one.id) ?? null;
    litFade.stopAnimation();
    litFade.setValue(1);
    setLit({ id: one.id, held: true });
    tell(null);
    setOpened((was) => ({ id: one.id, open: true, visit: (was?.visit ?? 0) + 1 }));
  }

  function closeRole(): void {
    setOpened((was) => (was == null ? null : { ...was, open: false }));
    setLit((was) => (was == null ? null : { ...was, held: false }));
  }

  function replaced(changed: EventPerson): void {
    setLoad({
      ...loaded,
      people: loaded.people.map((one) => (one.id === changed.id ? changed : one)),
    });
  }

  function removed(gone: EventPerson): void {
    focusBack.current = addBox.current;
    setLoad({ ...loaded, people: loaded.people.filter((one) => one.id !== gone.id) });
    setOpened((was) => (was == null ? null : { ...was, open: false }));
    setLit(null);
    tell(t('eventPeople.removed', { name: gone.user.name }));
  }

  function openAdd(): void {
    focusBack.current = addBox.current;
    tell(null);
    setAdding((was) => ({ open: true, visit: was.visit + 1 }));
  }

  function joined(role: EventRole, added: readonly EventPerson[]): void {
    setLoad({
      ...loaded,
      people: [...loaded.people, ...added],
      addable:
        loaded.addable?.filter(
          (one) => !added.some((there) => there.membershipId === one.membershipId),
        ) ?? null,
    });
    setAdding((was) => ({ ...was, open: false }));
    tell(
      nowCan(
        t,
        role,
        added.map((one) => one.user.name),
      ),
    );
  }

  return (
    <View style={styles.blocks}>
      {adds && <AddBox ref={addBox} label={t('eventPeople.addPrompt')} onPress={openAdd} />}
      {people.length === 0 ? (
        <View style={styles.nobody}>
          <Text size={16} weight="semibold">
            {t('eventPeople.nobody')}
          </Text>
          <Line text={t('eventPeople.nobodyLine')} />
        </View>
      ) : (
        <View>
          <SectionHead
            title={t('eventPeople.onEvent')}
            right={
              <Text size={15} weight="medium" style={[styles.secondary, styles.count]}>
                {new Intl.NumberFormat(locale).format(people.length)}
              </Text>
            }
          />
          <RowList
            items={people.map((one) => {
              const isLit = lit?.id === one.id;
              const opens = opensRow(one, manages, userId);
              const line = rowLine(t, one, userId);

              return {
                key: one.id,
                inset: ROW_INSET,
                selected: isLit,
                row: (
                  <View>
                    {isLit && (
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.lit, { opacity: litFade }]}
                      />
                    )}
                    <Row
                      ref={(node) => {
                        if (node == null) rows.current.delete(one.id);
                        else rows.current.set(one.id, node);
                      }}
                      title={one.user.name}
                      line={line}
                      lead={<Face name={one.user.name} id={one.user.id} side={40} />}
                      trail={
                        opens ? (
                          <Glyph name="down" size={18} ink={tokens.colorInkTertiary} weight={2.3} />
                        ) : undefined
                      }
                      accent={isLit}
                      onPress={opens ? () => openRole(one) : undefined}
                      accessibilityLabel={`${one.user.name}. ${line}`}
                      testID={`people.row.${one.id}`}
                    />
                  </View>
                ),
              };
            })}
          />
        </View>
      )}
      <View style={styles.foot}>
        {!manages && <Line text={t('eventPeople.readOnly')} size={14} />}
        {foot != null && <Line text={foot} size={14} />}
      </View>
      {person != null && opened != null && (
        <RoleSheet
          key={`role-${opened.visit}`}
          eventId={event.id}
          person={person}
          open={opened.open}
          opener={focusBack}
          organisation={organisationName}
          onSaved={replaced}
          onClose={closeRole}
          onRemoved={removed}
        />
      )}
      {adding.visit > 0 && loaded.addable != null && (
        <AddScreen
          key={`add-${adding.visit}`}
          eventId={event.id}
          open={adding.open}
          addable={loaded.addable}
          organisation={organisationName}
          opener={focusBack}
          onClose={() => setAdding((was) => ({ ...was, open: false }))}
          onAdded={joined}
        />
      )}
    </View>
  );
}

function Face({ name, id, side }: { name: string; id: string; side: number }) {
  const letters = initials(name);

  return <Avatar initials={letters} side={side} tone={toneOf(id)} />;
}

/** The way in to Add people, drawn as the field it opens: 52 tall, the Edge ring, a Violet plus. */
function AddBox({
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

/** The four roles as radios with their lines; the picked one carries Saving… or Saved while it is sent. */
function EventRoles({
  picked,
  sending = 'idle',
  onPick,
  testID,
}: {
  picked: EventRole;
  sending?: Sending;
  onPick: (role: EventRole) => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const names = EVENT_ROLES.map((role) => t(`eventPeople.role.${role}`));
  const lines = Object.fromEntries(
    EVENT_ROLES.map((role, index) => [names[index], t(`eventPeople.roleMeans.${role}`)]),
  );
  const tag: RowTag | null =
    sending === 'saving'
      ? { kind: 'now', word: t('eventPeople.saving'), turning: true }
      : sending === 'saved'
        ? { kind: 'yes', word: t('eventPeople.saved') }
        : null;

  return (
    <View accessibilityRole="radiogroup">
      <RoleChoices
        roles={names}
        picked={names[EVENT_ROLES.indexOf(picked)] ?? ''}
        lines={lines}
        pickedTag={tag}
        onPick={(name) => {
          const role = EVENT_ROLES[names.indexOf(name)];
          if (role != null) onPick(role);
        }}
        testID={testID}
      />
    </View>
  );
}

/** A person's row opened: who they are, their role saved as it is picked with the sheet left open, and Remove, which asks first. */
function RoleSheet({
  eventId,
  person,
  open,
  opener,
  organisation,
  onSaved,
  onClose,
  onRemoved,
}: {
  eventId: string;
  person: EventPerson;
  open: boolean;
  opener: Opener;
  organisation: string;
  onSaved: (person: EventPerson) => void;
  onClose: () => void;
  onRemoved: (person: EventPerson) => void;
}) {
  const { t } = useTranslation();
  const phone = useLayout().kind === 'phone';
  const [held, setHeld] = useState<EventRole>(person.role);
  const [picked, setPicked] = useState<EventRole>(person.role);
  const [sending, setSending] = useState<Sending>('idle');
  const [failed, setFailed] = useState<{ line: string; times: number } | null>(null);
  const [removing, setRemoving] = useState<'ask' | 'sending' | null>(null);
  const [removeFailed, setRemoveFailed] = useState<string | null>(null);
  const latest = useRef(0);
  const name = person.user.name;

  function pick(role: EventRole): void {
    if (role === picked) return;
    const sent = ++latest.current;
    setPicked(role);
    setSending('saving');
    setFailed(null);
    readOut(t('eventPeople.saving'));
    api.changeEventPerson(eventId, person.id, role).then(
      (changed) => {
        if (sent !== latest.current) return;
        setHeld(changed.role);
        setSending('saved');
        onSaved(changed);
        readOut(
          t('eventPeople.savedHeard', { said: t(`eventPeople.nowOne.${changed.role}`, { name }) }),
        );
      },
      () => {
        if (sent !== latest.current) return;
        setPicked(held);
        setSending('idle');
        setFailed((was) => ({
          line: t('eventPeople.changeFailed', {
            name: firstName(name),
            role: t(`eventPeople.role.${held}`),
          }),
          times: (was?.times ?? 0) + 1,
        }));
      },
    );
  }

  function remove(): void {
    setRemoving('sending');
    setRemoveFailed(null);
    api.removeEventPerson(eventId, person.id).then(
      () => onRemoved(person),
      (error: unknown) => {
        setRemoving('ask');
        setRemoveFailed(refusal(error, t('eventPeople.removeFailed')));
      },
    );
  }

  const ask: AskProps = {
    title: t('eventPeople.removeTitle', { name }),
    line: t('eventPeople.removeLine', { organisation }),
    keep: {
      label: t('eventPeople.keep', { name: firstName(name) }),
      off: removing === 'sending',
      testID: 'people.remove.keep',
    },
    confirm: {
      label: t('eventPeople.removeConfirm'),
      removes: true,
      busy: removing === 'sending' ? t('eventPeople.removing') : undefined,
      testID: 'people.remove.confirm',
    },
    failed: removeFailed,
    onKeep: () => setRemoving((now) => (now === 'sending' ? now : null)),
    onConfirm: remove,
  };
  const parts = (
    <>
      <View style={styles.person}>
        <Face name={name} id={person.user.id} side={44} />
        <View style={styles.grow}>
          <Text size={18} weight="bold" accessibilityRole="header">
            {name}
          </Text>
          <Text size={14} weight="medium" style={styles.secondary}>
            {[t('eventPeople.memberOf', { organisation }), person.jobLabel]
              .filter((part) => part != null && part !== '')
              .join(' · ')}
          </Text>
        </View>
        {phone && (
          <DoneAction label={t('eventPeople.done')} onPress={onClose} testID="people.role.done" />
        )}
      </View>
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
      <EventRoles picked={picked} sending={sending} onPick={pick} testID="people.role" />
      <View style={styles.remove}>
        <TextAction
          label={t('eventPeople.remove')}
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
        title={t('eventPeople.roleTitle')}
        cancels={false}
        verb={{
          label: t('eventPeople.done'),
          on: true,
          onPress: onClose,
          testID: 'people.role.done',
        }}
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
        scrimLabel={t('eventPeople.done')}
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

/** Add people on its own screen: their role first, starting on Can view, then the organisation's members found by name to tick. */
function AddScreen({
  eventId,
  open,
  addable,
  organisation,
  opener,
  onClose,
  onAdded,
}: {
  eventId: string;
  open: boolean;
  addable: readonly AddableMember[];
  organisation: string;
  opener: Opener;
  onClose: () => void;
  onAdded: (role: EventRole, added: readonly EventPerson[]) => void;
}) {
  const { t } = useTranslation();
  const [role, setRole] = useState<EventRole>(FIRST_ROLE);
  const [picking, setPicking] = useState(false);
  const [typed, setTyped] = useState('');
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ line: string; times: number } | null>(null);
  const shown = offered(addable, typed);
  const nobody = typed.trim() !== '' && shown.length === 0;
  const canAdd = ticked.length > 0 && !busy;
  const theirRole = t('eventPeople.theirRole');
  const roleName = t(`eventPeople.role.${role}`);
  const roleMeans = t(`eventPeople.roleMeans.${role}`);

  async function add(): Promise<void> {
    if (!canAdd) return;
    setBusy(true);
    setFailed(null);
    const added: EventPerson[] = [];
    try {
      for (const membershipId of ticked)
        added.push(await api.addEventPerson(eventId, membershipId, role));
    } catch (error) {
      setBusy(false);
      if (added.length > 0) onAdded(role, added);
      else
        setFailed((was) => ({
          line: refusal(error, t('eventPeople.addFailed')),
          times: (was?.times ?? 0) + 1,
        }));
      return;
    }
    onAdded(role, added);
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
        title: t('eventPeople.discardTitle'),
        line: t('eventPeople.discardLine'),
        keep: { label: t('eventPeople.discardKeep'), testID: 'people.add.keep' },
        confirm: { label: t('eventPeople.discard'), removes: true, testID: 'people.add.discard' },
        onKeep: () => setDiscarding(false),
        onConfirm: onClose,
      }
    : null;
  const over: Layer | null = picking
    ? {
        layer: (
          <RoleLayer closeLabel={t('eventPeople.done')} onClose={() => setPicking(false)}>
            <View style={styles.layerHead}>
              <Text size={18} weight="bold" accessibilityRole="header" style={styles.grow}>
                {theirRole}
              </Text>
              <DoneAction
                label={t('eventPeople.done')}
                onPress={() => setPicking(false)}
                testID="people.add.roles.done"
              />
            </View>
            <EventRoles picked={role} onPick={setRole} testID="people.add.roles" />
          </RoleLayer>
        ),
        onClose: () => setPicking(false),
      }
    : null;

  return (
    <FocusedScreen
      open={open}
      title={t('eventPeople.addTitle')}
      verb={{
        label: t('eventPeople.addConfirm'),
        on: canAdd,
        busy,
        onPress: () => void add(),
        testID: 'people.add.add',
      }}
      cancelLabel={t('eventPeople.cancel')}
      waits={busy}
      onCancel={cancel}
      cancelTestID="people.add.cancel"
      opener={opener}
      ask={ask}
      over={over}
      testID="people.add"
    >
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
      <View>
        <SectionHead title={theirRole} />
        <Row
          title={roleName}
          line={roleMeans}
          accent
          trail={<Glyph name="down" size={18} ink={tokens.colorAccentText} weight={2.3} />}
          onPress={() => {
            Keyboard.dismiss();
            setPicking(true);
          }}
          accessibilityLabel={`${theirRole}: ${roleName}. ${roleMeans}`}
          testID="people.add.role"
        />
      </View>
      <Field label={t('eventPeople.find')}>
        <TextField
          autoFocus
          autoCapitalize="words"
          autoComplete="off"
          onChangeText={setTyped}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => void add()}
          accessibilityLabel={t('eventPeople.find')}
          testID="people.add.who"
        />
      </Field>
      {shown.length > 0 && (
        <View>
          <SectionHead title={t('eventPeople.inOrganisation', { organisation })} />
          <RowList
            items={shown.map((member) => ({
              key: member.membershipId,
              inset: TICKED_INSET,
              row: (
                <Ticked
                  on={ticked.includes(member.membershipId)}
                  face={<Face name={member.name} id={member.membershipId} side={40} />}
                  title={member.name}
                  onPress={() => tick(member.membershipId)}
                  testID={`people.add.member.${member.membershipId}`}
                />
              ),
            }))}
          />
        </View>
      )}
      {nobody && (
        <Text size={16} weight="semibold">
          {t('eventPeople.noMatch', { organisation, typed: typed.trim() })}
        </Text>
      )}
      {addable.length === 0 && <Line text={t('eventPeople.everyoneOn', { organisation })} />}
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  blocks: { gap: 18 },
  secondary: { color: tokens.colorInkSecondary },
  count: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  nobody: { gap: tokens.spaceXs },
  lit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -tokens.spaceMd,
    right: -tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAccentTint,
  },
  foot: { gap: tokens.spaceSm },
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
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceHair,
    paddingBottom: tokens.spaceXxs,
  },
  failed: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  remove: { borderTopWidth: 1, borderTopColor: tokens.colorBorder, paddingTop: tokens.spaceXxs },
  layerHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  sheetBody: {
    gap: tokens.spaceLg,
    paddingTop: 27,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceLg,
  },
});
