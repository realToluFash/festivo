import {
  type AddableMember,
  EVENT_ROLES,
  type EventPerson,
  type EventRole,
  type OrganisationEvent,
} from '@soirely/api-client';
import { initials } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, View, type ViewInstance } from 'react-native';

import { api } from '../api.ts';
import { currentLocale } from '../i18n/index.ts';
import {
  addRefused,
  inListOrder,
  joinedLine,
  managesPeople,
  nowCan,
  offered,
  opensRow,
  rowLine,
  seesEveryEvent,
} from '../kit/eventPeople.ts';
import { refusalSaid } from '../kit/refusal.ts';
import { glide } from '../motion.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import {
  AddBox,
  AddScreen,
  type AddWords,
  PeopleLoading,
  PersonFace,
  RoleSheet,
  type RoleSheetWords,
  type RoleWords,
} from './PeopleParts.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { FailedBlock, Line, Row, RowList, SectionHead } from './Summary.tsx';
import { Text } from './Text.tsx';

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
const FIRST_ROLE: EventRole = 'can_view';

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

function toneOf(id: string): number {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function Face({ name, id, side }: { name: string; id: string; side: number }) {
  const letters = initials(name);

  return <PersonFace initials={letters} tone={toneOf(id)} side={side} />;
}

function roleWords(t: TFunction): RoleWords<EventRole> {
  return {
    roles: EVENT_ROLES,
    name: (role) => t(`eventPeople.role.${role}`),
    means: (role) => t(`eventPeople.roleMeans.${role}`),
    saving: t('eventPeople.saving'),
    saved: t('eventPeople.saved'),
  };
}

function sheetWords(
  t: TFunction,
  person: EventPerson,
  organisation: string,
): RoleSheetWords<EventRole> {
  const name = person.user.name;

  return {
    ...roleWords(t),
    title: t('eventPeople.roleTitle'),
    done: t('eventPeople.done'),
    remove: t('eventPeople.remove'),
    removeTitle: t('eventPeople.removeTitle', { name }),
    removeLine: t('eventPeople.removeLine', { organisation }),
    keep: t('eventPeople.keep', { name: firstName(name) }),
    removeConfirm: t('eventPeople.removeConfirm'),
    removing: t('eventPeople.removing'),
    savedHeard: (role) =>
      t('eventPeople.savedHeard', { said: t(`eventPeople.nowOne.${role}`, { name }) }),
    notChanged: (held) =>
      t('eventPeople.changeFailed', {
        name: firstName(name),
        role: t(`eventPeople.role.${held}`),
      }),
    removeFailed: (error) => refusalSaid(error, t('eventPeople.removeFailed')),
  };
}

function addWords(t: TFunction, organisation: string, nothingLeft: boolean): AddWords<EventRole> {
  return {
    ...roleWords(t),
    title: t('eventPeople.addTitle'),
    add: t('eventPeople.addConfirm'),
    cancel: t('eventPeople.cancel'),
    done: t('eventPeople.done'),
    theirRole: t('eventPeople.theirRole'),
    find: t('eventPeople.find'),
    inOrganisation: t('eventPeople.inOrganisation', { organisation }),
    noMatch: (typed) => t('eventPeople.noMatch', { organisation, typed }),
    discardTitle: t('eventPeople.discardTitle'),
    discardLine: t('eventPeople.discardLine'),
    discardKeep: t('eventPeople.discardKeep'),
    discard: t('eventPeople.discard'),
    refusal: (error, role, went, left) => addRefused(t, error, role, went, left),
    everyoneOn: nothingLeft ? t('eventPeople.everyoneOn', { organisation }) : undefined,
  };
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

  const people = inListOrder(load.people, locale);
  const person = opened == null ? null : (people.find((one) => one.id === opened.id) ?? null);
  const foot = seesEveryEvent(t, load, organisationName, locale);
  const addable = load.addable;

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

  // Answers land after other changes, so each one is applied to the list as it then is.
  function replaced(changed: EventPerson): void {
    setLoad((was) =>
      was.kind !== 'loaded'
        ? was
        : { ...was, people: was.people.map((one) => (one.id === changed.id ? changed : one)) },
    );
  }

  function removed(gone: EventPerson): void {
    focusBack.current = addBox.current;
    setLoad((was) =>
      was.kind !== 'loaded'
        ? was
        : { ...was, people: was.people.filter((one) => one.id !== gone.id) },
    );
    setOpened((was) => (was == null ? null : { ...was, open: false }));
    setLit(null);
    tell(t('eventPeople.removed', { name: gone.user.name }));
  }

  function openAdd(): void {
    focusBack.current = addBox.current;
    tell(null);
    setAdding((was) => ({ open: true, visit: was.visit + 1 }));
  }

  function joined(role: EventRole, added: readonly EventPerson[], finished: boolean): void {
    setLoad((was) =>
      was.kind !== 'loaded'
        ? was
        : {
            ...was,
            people: [...was.people, ...added],
            addable:
              was.addable?.filter(
                (one) => !added.some((there) => there.membershipId === one.membershipId),
              ) ?? null,
          },
    );
    if (!finished) return;
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
      {manages && addable != null && (
        <AddBox ref={addBox} label={t('eventPeople.addPrompt')} onPress={openAdd} />
      )}
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
              const opens = opensRow(one.user.id, manages, userId);
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
          person={{
            name: person.user.name,
            line: joinedLine([
              t('eventPeople.memberOf', { organisation: organisationName }),
              person.jobLabel,
            ]),
            face: <Face name={person.user.name} id={person.user.id} side={44} />,
          }}
          start={person.role}
          words={sheetWords(t, person, organisationName)}
          open={opened.open}
          opener={focusBack}
          save={async (role) => {
            const changed = await api.changeEventPerson(event.id, person.id, role);
            replaced(changed);

            return changed.role;
          }}
          remove={() => api.removeEventPerson(event.id, person.id)}
          onClose={closeRole}
          onRemoved={() => removed(person)}
        />
      )}
      {adding.visit > 0 && addable != null && (
        <AddScreen
          key={`add-${adding.visit}`}
          open={adding.open}
          first={FIRST_ROLE}
          offered={(typed) =>
            offered(addable, typed).map((member) => ({
              id: member.membershipId,
              name: member.name,
              face: <Face name={member.name} id={member.membershipId} side={40} />,
            }))
          }
          words={addWords(t, organisationName, addable.length === 0)}
          opener={focusBack}
          onClose={() => setAdding((was) => ({ ...was, open: false }))}
          add={(role, membershipId) => api.addEventPerson(event.id, membershipId, role)}
          onAdded={joined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: 18 },
  secondary: { color: tokens.colorInkSecondary },
  count: { fontVariant: ['tabular-nums'] },
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
});
