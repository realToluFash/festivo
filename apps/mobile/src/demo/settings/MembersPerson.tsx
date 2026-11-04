import type { MemberStanding } from '@soirely/domain';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type ScrollViewInstance, StyleSheet, type TextInputInstance, View } from 'react-native';

import {
  CodeField,
  Field,
  FieldError,
  focusChecked,
  focusRefused,
} from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { SettingsPage, useShell } from './Frame.tsx';
import {
  changedRole,
  DEADLINES,
  DOMAIN,
  grantable,
  type MembersSay,
  type MembersViewer,
  ORGANISATION,
  type Person,
  type PersonStep,
  PROOF_MINUTES,
  proofProblem,
  restored,
  ROLE_MEANS,
  standingOf,
  statusWord,
} from './MembersSample.ts';
import { Avatar, Card, CardHead, Chip, Pair, Pill, TYPE } from './parts.tsx';
import { RadioCards } from './RolesParts.tsx';
import type { SettingsLayout } from './sample.ts';

const TAKES_EFFECT = 'Takes effect on their next request; nobody is signed out.';

export interface PersonOpening {
  step: PersonStep;
  picked: string | null;
}

/** Somebody's page: the page stays as people are picked beside the list, and what is on it starts afresh. */
export function PersonPage({
  person,
  visit,
  column,
  back,
  ...rest
}: PersonProps & {
  visit: number;
  column: ReactNode;
  back: { label: string; onPress: () => void } | null;
}) {
  const scroll = useRef<ScrollViewInstance>(null);
  const toRemove = rest.opening.step === 'removing';

  useEffect(() => {
    if (!toRemove) {
      scroll.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    const frame = requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));

    return () => cancelAnimationFrame(frame);
  }, [person.id, visit, toRemove]);

  return (
    <SettingsPage title={person.name} back={back} column={column} scrollRef={scroll}>
      <PersonBody key={`${person.id}.${visit}`} person={person} {...rest} />
    </SettingsPage>
  );
}

interface PersonProps {
  person: Person;
  people: readonly Person[];
  viewer: MembersViewer;
  opening: PersonOpening;
  say: MembersSay;
  proved: boolean;
  onProved: () => void;
  onPeople: (people: Person[]) => void;
  onRemoved: (person: Person) => void;
}

/** Who they are, their role, a suspension, and removing them. */
function PersonBody({
  person,
  people,
  viewer,
  opening,
  say,
  proved,
  onProved,
  onPeople,
  onRemoved,
}: PersonProps) {
  const shell = useShell();
  const layout = shell.layout;
  const standing = standingOf(person, people, viewer);
  const acts = standing === 'manageable' || standing === 'suspendedOnlyOwner';
  const suspendedNow = person.status === 'suspended' || person.status === 'domainSuspended';
  const [restoredAs, setRestoredAs] = useState<{ byHand: boolean; role: string } | null>(null);

  function restore(): void {
    setRestoredAs({ byHand: person.status === 'suspended', role: person.role ?? '' });
    onPeople(restored(people, person.id));
  }

  return (
    <>
      <PersonHead person={person} self={person.id === viewer.id} layout={layout} />
      {restoredAs?.byHand === true && (
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          title={`${person.name} has access again, as ${restoredAs.role}.`}
          body={`They can use ${ORGANISATION} from their next request, and they're emailed in their language.`}
          announce
        />
      )}
      <Card>
        <CardHead title="Role" />
        {standing === 'manageable' && suspendedNow ? (
          <>
            <FixedRoleWord role={person.role} />
            <Line
              text={`Their role is kept while they're suspended. You can change it once their access is restored.`}
            />
          </>
        ) : standing === 'manageable' ? (
          <RoleChooser
            person={person}
            viewer={viewer}
            opening={opening}
            layout={layout}
            proved={proved}
            onProved={onProved}
            onChange={(role) => onPeople(changedRole(people, person.id, role))}
          />
        ) : (
          <FixedRole
            standing={standing}
            person={person}
            viewer={viewer}
            suspended={suspendedNow}
            onGoToOrganisation={() => shell.openSection('organisation')}
          />
        )}
      </Card>
      {restoredAs?.byHand === false ? (
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          body={`${person.name}'s access to ${ORGANISATION} is restored.`}
          announce
        />
      ) : (
        suspendedNow && (
          <Suspension
            person={person}
            onlyOwner={standing === 'suspendedOnlyOwner'}
            acts={acts}
            standing={standing}
            layout={layout}
            say={say}
            onRestore={restore}
          />
        )
      )}
      {acts && (
        <Remove
          person={person}
          onlyOwner={standing === 'suspendedOnlyOwner'}
          removing={opening.step === 'removing'}
          layout={layout}
          onRemove={() => onRemoved(person)}
        />
      )}
    </>
  );
}

function PersonHead({
  person,
  self,
  layout,
}: {
  person: Person;
  self: boolean;
  layout: SettingsLayout;
}) {
  const { word, kind } = statusWord(person);
  const role = person.role ?? 'No role yet';
  const side = { phone: 56, portrait: 64, landscape: 48 }[layout];

  return (
    <View style={styles.head} testID={`members.person.${person.initials}`}>
      <Avatar initials={person.initials} side={side} tone={person.tone} />
      <View style={styles.headWords}>
        <View style={styles.headLine}>
          <Text size={TYPE.row} weight="semibold">
            {self ? `You · ${role}` : role}
          </Text>
          <Chip word={word} kind={kind} />
        </View>
        <Text size={TYPE.line} weight="medium" style={styles.secondary}>
          {person.email}
        </Text>
      </View>
    </View>
  );
}

function FixedRoleWord({ role }: { role: string | null }) {
  return (
    <Text size={17} weight="semibold">
      {role ?? 'No role yet'}
    </Text>
  );
}

function Line({ text }: { text: string }) {
  return (
    <Text size={TYPE.body} weight="medium" style={styles.secondary}>
      {text}
    </Text>
  );
}

function FixedRole({
  standing,
  person,
  viewer,
  suspended,
  onGoToOrganisation,
}: {
  standing: Exclude<MemberStanding, 'manageable'>;
  person: Person;
  viewer: MembersViewer;
  suspended: boolean;
  onGoToOrganisation: () => void;
}) {
  return (
    <>
      <FixedRoleWord role={person.role} />
      {standing === 'selfOwner' && (
        <>
          <Line text="You cannot change your own role. Another owner can, or you can hand ownership to somebody in Organisation." />
          <Pill
            label="Go to Organisation ›"
            kind="quiet"
            full={false}
            height={tokens.sizeHit}
            onPress={onGoToOrganisation}
            testID="members.goToOrganisation"
          />
        </>
      )}
      {standing === 'self' && <Line text="You cannot change your own role. An owner can." />}
      {standing === 'onlyOwner' && (
        <>
          <Notice
            tone="quiet"
            mark={tokens.marks.info.glyph}
            body={`${person.name} is the only owner. An organisation always has one, so their role cannot change and they cannot be removed until somebody else is an owner too.`}
          />
          {!viewer.owns && (
            <Line text={`Only an owner can make somebody else an owner. Ask ${person.name}.`} />
          )}
        </>
      )}
      {!suspended && standing === 'ownerOnly' && (
        <Line text={`Only an owner can change an owner's role or remove them.`} />
      )}
      {!suspended && standing === 'beyondGrant' && (
        <Line text="Their role holds a permission yours does not, so you cannot change their role or their access." />
      )}
    </>
  );
}

/** Only the roles the viewer may give; an owner made here asks for the viewer's proof first. */
function RoleChooser({
  person,
  viewer,
  opening,
  layout,
  proved,
  onProved,
  onChange,
}: {
  person: Person;
  viewer: MembersViewer;
  opening: PersonOpening;
  layout: SettingsLayout;
  proved: boolean;
  onProved: () => void;
  onChange: (role: string) => void;
}) {
  const [picked, setPicked] = useState(opening.picked ?? person.role ?? '');
  const [proving, setProving] = useState(opening.step === 'proving');
  const [done, setDone] = useState<string | null>(null);
  const changed = picked !== person.role;
  const phone = layout === 'phone';

  function apply(): void {
    setProving(false);
    setDone(`${person.name} is now ${picked}. ${TAKES_EFFECT}`);
    onChange(picked);
  }

  function save(): void {
    if (!changed) return;
    if (picked === 'Owner' && !proved) setProving(true);
    else apply();
  }

  if (proving)
    return (
      <ConfirmItsYou
        layout={layout}
        onProved={() => {
          onProved();
          apply();
        }}
        onCancel={() => setProving(false)}
      />
    );

  return (
    <>
      {done != null && <Notice tone="done" mark={tokens.marks.done.glyph} body={done} announce />}
      <RadioCards
        choices={grantable(viewer).map((name) => ({ value: name, name, means: ROLE_MEANS[name] }))}
        picked={picked}
        onPick={(role) => {
          setDone(null);
          setPicked(role);
        }}
        twoUp={!phone}
        testID="members.role"
      />
      <View style={phone ? styles.footStacked : styles.footBeside}>
        <View style={phone ? undefined : styles.grow}>
          <Line text={TAKES_EFFECT} />
        </View>
        <Pill
          label={changed ? `Change their role to ${picked}` : 'Pick a different role'}
          kind={changed ? 'primary' : 'off'}
          full={phone}
          height={tokens.sizeHitPhoneHero}
          onPress={save}
          testID="members.role.save"
        />
      </View>
    </>
  );
}

const PASSWORD_LABEL = 'Your password';
const CODE_LABEL = 'Code';

/** Confirm it's you, on the sample's password and its authenticator or recovery code. */
function ConfirmItsYou({
  layout,
  onProved,
  onCancel,
}: {
  layout: SettingsLayout;
  onProved: () => void;
  onCancel: () => void;
}) {
  const password = useRef('');
  const code = useRef('');
  const passwordInput = useRef<TextInputInstance>(null);
  const codeInput = useRef<TextInputInstance>(null);
  const [problem, setProblem] = useState<ReturnType<typeof proofProblem>>(null);
  const phone = layout === 'phone';

  function submit(): void {
    const found = proofProblem(password.current, code.current, SAMPLE);
    if (found == null) {
      onProved();
      return;
    }
    setProblem(found);
    const field = found.field === 'password' ? passwordInput : codeInput;
    const blank = (found.field === 'password' ? password.current : code.current.trim()) === '';
    // A blank is the client's check; a wrong password or code stands in for the server's refusal.
    if (blank) focusChecked(field);
    else focusRefused(field);
  }

  return (
    <View style={styles.prove}>
      <Text size={TYPE.card} weight="bold" accessibilityRole="header">
        {`Confirm it's you`}
      </Text>
      <Line
        text={`To make somebody an owner of ${ORGANISATION}, confirm it's you. You won't be asked again for ${PROOF_MINUTES} minutes.`}
      />
      <Field label={PASSWORD_LABEL} error={problem?.field === 'password' ? problem.message : null}>
        <PasswordField
          ref={passwordInput}
          wrong={problem?.field === 'password'}
          autoComplete="current-password"
          textContentType="password"
          onChangeText={(text) => {
            password.current = text;
          }}
          returnKeyType="next"
          onSubmitEditing={() => codeInput.current?.focus()}
          submitBehavior="submit"
          accessibilityLabel={PASSWORD_LABEL}
          testID="members.prove.password"
        />
      </Field>
      <Field
        label={CODE_LABEL}
        error={problem?.field === 'code' ? problem.message : null}
        help="From your authenticator app, or one of your recovery codes."
      >
        <CodeField
          ref={codeInput}
          takesRecoveryCode
          wrong={problem?.field === 'code'}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          onChangeText={(text) => {
            code.current = text;
          }}
          returnKeyType="done"
          onSubmitEditing={submit}
          submitBehavior="submit"
          accessibilityLabel={CODE_LABEL}
          testID="members.prove.code"
        />
      </Field>
      <Pair
        layout={layout}
        dismiss={
          <Pill
            label="Cancel"
            kind="secondary"
            full={phone}
            height={tokens.sizeHitPhoneHero}
            onPress={onCancel}
            testID="members.prove.cancel"
          />
        }
        confirm={
          <Pill
            label="Continue"
            full={phone}
            height={tokens.sizeHitPhoneHero}
            onPress={submit}
            testID="members.prove.continue"
          />
        }
      />
    </View>
  );
}

function Suspension({
  person,
  onlyOwner,
  acts,
  standing,
  layout,
  say,
  onRestore,
}: {
  person: Person;
  onlyOwner: boolean;
  acts: boolean;
  standing: MemberStanding;
  layout: SettingsLayout;
  say: MembersSay;
  onRestore: () => void;
}) {
  const byHand = person.status === 'suspended';
  const phone = layout === 'phone';

  return (
    <Card>
      {byHand ? (
        <CardHead
          title={`Access for ${person.name} is suspended`}
          line={`They can't use ${ORGANISATION}. Their role, their events and their history are kept.`}
        />
      ) : (
        <Notice
          tone="attention"
          mark="!"
          title={`${person.name}'s ${DOMAIN} address is no longer on their account.`}
          body={`If nobody answers by ${say.deadline(DEADLINES.marta)}, they are removed.`}
        />
      )}
      {onlyOwner && (
        <Line
          text={`${person.name} is the only owner of ${ORGANISATION}, so they stay suspended, still an owner, and are not removed.`}
        />
      )}
      {acts ? (
        <Pill
          label={byHand ? 'Restore access' : 'Restore'}
          full={phone}
          height={tokens.sizeHitPhoneHero}
          onPress={onRestore}
          testID="members.restore"
        />
      ) : (
        (standing === 'ownerOnly' || standing === 'beyondGrant') && (
          <Line
            text={
              standing === 'ownerOnly'
                ? `Only an owner can change an owner's role or remove them.`
                : 'Their role holds a permission yours does not, so you cannot change their role or their access.'
            }
          />
        )
      )}
    </Card>
  );
}

/** Remove asks first; the suspended only owner is refused, as the server refuses them. */
function Remove({
  person,
  onlyOwner,
  removing,
  layout,
  onRemove,
}: {
  person: Person;
  onlyOwner: boolean;
  removing: boolean;
  layout: SettingsLayout;
  onRemove: () => void;
}) {
  const [asking, setAsking] = useState(removing);
  const [refused, setRefused] = useState(false);
  const phone = layout === 'phone';
  const height = tokens.sizeHitPhoneHero;

  if (asking)
    return (
      <Card>
        <Text size={22} weight="bold" accessibilityRole="header" style={styles.removeTitle}>
          {`Remove ${person.name}?`}
        </Text>
        <Text size={TYPE.body} weight="medium">
          {`${person.name} stops having access to ${ORGANISATION} on their next request. Their events stay with ${ORGANISATION}, and everything they did is kept.`}
        </Text>
        <Pair
          layout={layout}
          dismiss={
            <Pill
              label={`Keep ${person.name}`}
              kind="quiet"
              full={phone}
              height={height}
              onPress={() => setAsking(false)}
              testID="members.remove.keep"
            />
          }
          confirm={
            <Pill
              label={`Remove ${person.name}`}
              kind="danger"
              full={phone}
              height={height}
              onPress={onRemove}
              testID="members.remove.confirm"
            />
          }
        />
      </Card>
    );

  return (
    <Card>
      <CardHead
        title={`Remove ${person.name}`}
        line={`They lose access on their next request. Their events stay with ${ORGANISATION}.`}
      />
      {refused && (
        <FieldError message={`${person.name} is the only owner, so they cannot be removed.`} />
      )}
      <Pill
        label={`Remove from ${ORGANISATION}…`}
        kind="dangerQuiet"
        full={phone}
        height={height}
        onPress={() => (onlyOwner ? setRefused(true) : setAsking(true))}
        testID="members.remove"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headWords: { flex: 1, minWidth: 0, gap: tokens.spaceXxs },
  headLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  prove: { gap: 14 },
  grow: { flex: 1, minWidth: 0 },
  footStacked: { gap: 14 },
  footBeside: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXl },
  removeTitle: { letterSpacing: 22 * -0.015 },
});
