import type { MemberStanding } from '@soirely/domain';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type ScrollViewInstance, StyleSheet, View, type ViewInstance } from 'react-native';

import { FieldError } from '../../components/Field.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import type { TextHandle } from '../../components/Text.tsx';
import { ledEvents } from './MembersHandover.ts';
import { MANAGED_WORDS } from './DataWords.ts';
import { HandoverAsk, LeadsBlock, LeadsNotIn } from './MembersHandover.tsx';
import { handedLines, HANDOVER_WORDS } from './MembersHandoverWords.ts';
import { useLoad } from './MembersLoading.tsx';
import { RoleScreen, TAKES_EFFECT } from './MembersRole.tsx';
import {
  changedRole,
  DEADLINES,
  DOMAIN,
  firstName,
  type HandoverStart,
  type Leads,
  markOf,
  type MembersSay,
  type MembersViewer,
  offeredFor,
  ORGANISATION,
  type Person,
  type PersonStep,
  restored,
  standingOf,
  statusWord,
  whenWord,
} from './MembersSample.ts';
import type { Load } from './RolesSample.ts';
import { useShell } from '../../components/settingsShell.ts';
import { SummaryPage } from './SummaryPage.tsx';
import {
  Ask,
  CardFace,
  CardSays,
  GlassTag,
  Line,
  OnCard,
  Row,
  RowList,
  Section,
  SummaryCard,
  TextAction,
} from '../../components/Summary.tsx';

export interface PersonOpening {
  step: PersonStep;
  picked: string | null;
  handover: HandoverStart | null;
  leadsLoad: Load;
  said: readonly string[] | null;
  otherOrganisations?: number | null;
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

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [person.id, visit]);

  return (
    <SummaryPage back={back} column={column} scrollRef={scroll}>
      <PersonBody key={`${person.id}.${visit}`} person={person} {...rest} />
    </SummaryPage>
  );
}

interface PersonProps {
  person: Person;
  people: readonly Person[];
  leads: Leads;
  viewer: MembersViewer;
  opening: PersonOpening;
  say: MembersSay;
  proved: boolean;
  onProved: () => void;
  onPeople: (people: Person[]) => void;
  /** `taker` is who leads their events now, when they led any. */
  onRemoved: (person: Person, taker: string | null) => void;
  onHandedOver: (from: string, to: string) => void;
}

/** Who they are on the card with the one next step, what they lead while suspended, the details, and removing them. */
function PersonBody({
  person,
  people,
  leads,
  viewer,
  opening,
  say,
  proved,
  onProved,
  onPeople,
  onRemoved,
  onHandedOver,
}: PersonProps) {
  const shell = useShell();
  const pane = shell.layout === 'landscape';
  const standing = standingOf(person, people, viewer);
  const acts = standing === 'manageable' || standing === 'suspendedOnlyOwner';
  const suspendedNow = person.status === 'suspended' || person.status === 'domainSuspended';
  const changes = standing === 'manageable' && !suspendedNow;
  const [said, setSaid] = useState<readonly string[]>(opening.said ?? []);
  const [roleVisit, setRoleVisit] = useState(0);
  const [roleOpen, setRoleOpen] = useState(opening.step === 'proving');
  const [removing, setRemoving] = useState(opening.step === 'removing');
  const [handing, setHanding] = useState(opening.step === 'handingOver');
  const [askVisit, setAskVisit] = useState(0);
  const [refused, setRefused] = useState(false);
  const stepRef = useRef<ViewInstance>(null);
  const removeRef = useRef<ViewInstance>(null);
  const handRef = useRef<ViewInstance>(null);
  const firstLine = useRef<TextHandle>(null);
  const events = ledEvents(leads[person.id] ?? []);
  const offered = offeredFor(people, person.id);
  const handoverStart = askVisit === 0 ? opening.handover : null;
  // Admins see what a suspended member leads (sc-614); a member reads no events of theirs.
  const { load: leadsLoad, retry: loadLeads } = useLoad(opening.leadsLoad);
  const leadsIn = leadsLoad === 'loaded';
  const showsLeads = suspendedNow && viewer.manages && leadsIn && events.length > 0;

  function tell(lines: readonly string[]): void {
    setSaid(lines);
    readOut(lines.join(' '));
  }

  function restore(): void {
    const role = person.role ?? '';
    tell(
      person.status === 'suspended'
        ? [
            `${person.name} has access again, as ${role}.`,
            `They can use ${ORGANISATION} from their next request, and they're emailed in their language.`,
          ]
        : [`${person.name}'s access to ${ORGANISATION} is restored.`],
    );
    onPeople(restored(people, person.id));
  }

  const step = changes
    ? {
        label: 'Change role',
        onPress: () => {
          setRoleVisit((count) => count + 1);
          setRoleOpen(true);
        },
        testID: 'members.changeRole',
        ref: stepRef,
      }
    : suspendedNow && acts
      ? {
          label: person.status === 'suspended' ? 'Restore access' : 'Restore',
          onPress: restore,
          testID: 'members.restore',
          ref: stepRef,
        }
      : null;
  const lines =
    said.length > 0 ? said : suspendedNow ? suspensionLines(person, standing, acts, say) : [];
  const { word } = statusWord(person);
  const whose = { name: person.name, first: firstName(person) };

  return (
    <>
      <SummaryCard
        height={pane ? 196 : 216}
        step={step}
        testID={`members.person.${person.initials}`}
      >
        <View style={styles.who}>
          <CardFace name={person.name} side={pane ? 64 : 56} />
          <View style={styles.whoWords}>
            <CardSays text={person.name} size={pane ? 26 : 22} heading />
            <OnCard text={person.email} />
          </View>
        </View>
        <View style={styles.tags}>
          <GlassTag word={person.role ?? 'No role yet'} />
          <GlassTag word={word} mark={markOf(person)} />
        </View>
        {lines.map((line, index) => (
          <OnCard key={line} ref={index === 0 ? firstLine : undefined} text={line} />
        ))}
      </SummaryCard>
      {opening.otherOrganisations != null && (
        <Line text={MANAGED_WORDS.alsoMember(opening.otherOrganisations)} />
      )}
      {suspendedNow && viewer.manages && !leadsIn && (
        <LeadsNotIn name={person.name} failed={leadsLoad === 'failed'} onRetry={loadLeads} />
      )}
      {showsLeads && (
        <LeadsBlock
          events={events}
          onHandOver={
            acts
              ? () => {
                  setAskVisit((count) => count + 1);
                  setHanding(true);
                }
              : null
          }
          handRef={handRef}
        />
      )}
      <Section title="Details">
        <RowList
          items={[
            {
              key: 'how',
              row: <Row title={person.how} line="How they joined" weight="medium" />,
            },
            {
              key: 'when',
              row: <Row title={say.date(person.when)} line={whenWord(person)} weight="medium" />,
            },
          ]}
        />
      </Section>
      <FixedRole
        standing={standing}
        person={person}
        viewer={viewer}
        suspended={suspendedNow}
        onGoToOrganisation={() => shell.openSection('organisation')}
      />
      {acts && (
        <View>
          <TextAction
            ref={removeRef}
            label={`Remove from ${ORGANISATION}…`}
            removes
            onPress={() => {
              if (standing === 'suspendedOnlyOwner') {
                setRefused(true);
                return;
              }
              setAskVisit((count) => count + 1);
              setRemoving(true);
            }}
            consequence={`They lose access on their next request. Their events stay with ${ORGANISATION}.`}
            testID="members.remove"
          />
          {refused && (
            <FieldError message={`${person.name} is the only owner, so they cannot be removed.`} />
          )}
        </View>
      )}
      {events.length === 0 ? (
        <Ask
          open={removing}
          opener={removeRef}
          title={`Remove ${person.name} from ${ORGANISATION}?`}
          line={`They lose access on their next request. Their events stay with ${ORGANISATION}.`}
          keep={{ label: `Keep ${whose.first}`, testID: 'members.remove.keep' }}
          confirm={{ label: 'Remove', testID: 'members.remove.confirm', removes: true }}
          onKeep={() => setRemoving(false)}
          onConfirm={() => {
            setRemoving(false);
            onRemoved(person, null);
          }}
        />
      ) : (
        <HandoverAsk
          key={`remove.${askVisit}`}
          open={removing}
          opener={removeRef}
          kind="remove"
          departing={whose.name}
          events={events}
          offered={offered}
          you={viewer.id}
          words={{
            title: `Remove ${whose.name} from ${ORGANISATION}?`,
            tail: HANDOVER_WORDS.removeTail,
            keep: { label: `Keep ${whose.first}`, testID: 'members.remove.keep' },
            verb: { label: 'Remove', testID: 'members.remove.confirm', removes: true },
          }}
          start={removing ? handoverStart : null}
          onKeep={() => setRemoving(false)}
          onDone={(taker) => {
            setRemoving(false);
            onRemoved(person, taker);
          }}
          testID="members.remove"
        />
      )}
      {showsLeads && acts && (
        <HandoverAsk
          key={`hand.${askVisit}`}
          open={handing}
          opener={handRef}
          kind="hand"
          departing={whose.name}
          events={events}
          offered={offered}
          you={viewer.id}
          words={{
            title: HANDOVER_WORDS.handTitle(whose.name, events.length),
            tail: HANDOVER_WORDS.handTail(whose.name, events.length),
            keep: { label: HANDOVER_WORDS.cancel, testID: 'members.handOver.cancel' },
            verb: {
              label: HANDOVER_WORDS.handOver,
              testID: 'members.handOver.confirm',
              removes: false,
            },
          }}
          start={handing ? handoverStart : null}
          onKeep={() => setHanding(false)}
          onDone={(taker) => {
            const to = people.find((one) => one.id === taker);
            setHanding(false);
            onHandedOver(person.id, taker);
            tell(
              handedLines(
                whose.name,
                events.length,
                taker === viewer.id ? null : (to?.name ?? null),
              ),
            );
            setTimeout(() => moveScreenReaderFocus(firstLine.current), SETTLED_MS);
          }}
          testID="members.handOver"
        />
      )}
      {changes && (
        <RoleScreen
          key={roleVisit}
          person={person}
          viewer={viewer}
          open={roleOpen}
          startsProving={roleVisit === 0 && opening.step === 'proving'}
          startsPicked={roleVisit === 0 ? opening.picked : null}
          proved={proved}
          opener={stepRef}
          onProved={onProved}
          onClose={() => setRoleOpen(false)}
          onChange={(role) => {
            setRoleOpen(false);
            onPeople(changedRole(people, person.id, role));
            tell([`${person.name} is now ${role}. ${TAKES_EFFECT}`]);
          }}
        />
      )}
    </>
  );
}

function suspensionLines(
  person: Person,
  standing: MemberStanding,
  acts: boolean,
  say: MembersSay,
): string[] {
  const why =
    person.status === 'suspended'
      ? [`They can't use ${ORGANISATION}. Their role, their events and their history are kept.`]
      : [
          `${person.name}'s ${DOMAIN} address is no longer on their account.`,
          `If nobody answers by ${say.deadline(DEADLINES.marta)}, they are removed.`,
        ];
  const onlyOwner =
    standing === 'suspendedOnlyOwner'
      ? [
          `${person.name} is the only owner of ${ORGANISATION}, so they stay suspended, still an owner, and are not removed.`,
        ]
      : [];
  const cannot =
    acts || (standing !== 'ownerOnly' && standing !== 'beyondGrant')
      ? []
      : [standing === 'ownerOnly' ? OWNER_ONLY : BEYOND_GRANT];

  return [...why, ...onlyOwner, ...cannot];
}

const OWNER_ONLY = `Only an owner can change an owner's role or remove them.`;
const BEYOND_GRANT =
  'Their role holds a permission yours does not, so you cannot change their role or their access.';

/** Why the role cannot change here, under Details, in the words the current build uses. */
function FixedRole({
  standing,
  person,
  viewer,
  suspended,
  onGoToOrganisation,
}: {
  standing: MemberStanding;
  person: Person;
  viewer: MembersViewer;
  suspended: boolean;
  onGoToOrganisation: () => void;
}) {
  switch (standing) {
    case 'selfOwner':
      return (
        <View>
          <Line text="You cannot change your own role. Another owner can, or you can hand ownership to somebody in Organisation." />
          <TextAction
            label="Go to Organisation"
            after="chevron"
            onPress={onGoToOrganisation}
            testID="members.goToOrganisation"
          />
        </View>
      );
    case 'self':
      return <Line text="You cannot change your own role. An owner can." />;
    case 'onlyOwner':
      return (
        <View style={styles.lines}>
          <Line
            text={`${person.name} is the only owner. An organisation always has one, so their role cannot change and they cannot be removed until somebody else is an owner too.`}
          />
          {!viewer.owns && (
            <Line text={`Only an owner can make somebody else an owner. Ask ${person.name}.`} />
          )}
        </View>
      );
    case 'ownerOnly':
      return suspended ? null : <Line text={OWNER_ONLY} />;
    case 'beyondGrant':
      return suspended ? null : <Line text={BEYOND_GRANT} />;
    case 'manageable':
      return suspended ? (
        <Line text="Their role is kept while they're suspended. You can change it once their access is restored." />
      ) : null;
    case 'suspendedOnlyOwner':
    case 'readOnly':
      return null;
  }
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  whoWords: { flex: 1, minWidth: 0, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lines: { gap: 8 },
});
