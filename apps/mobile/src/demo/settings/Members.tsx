import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Notice } from '../../components/Notice.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Landscape, SectionColumn, SettingsPage, useShell } from './Frame.tsx';
import { type Claim, OwnerClaim } from './MembersClaim.tsx';
import { Failed, LoadingRows, useLoad } from './MembersLoading.tsx';
import {
  Awaiting,
  Empty,
  Filters,
  FROM_THE_WEB,
  MemberRows,
  NobodyPicked,
} from './MembersParts.tsx';
import { type PersonOpening, PersonPage } from './MembersPerson.tsx';
import {
  approved,
  counts,
  type Filter,
  isShown,
  type MembersSay,
  membersSayIn,
  type MembersStart,
  membersStart,
  membersStateOf,
  ORGANISATION,
  type Person,
  PROOF_MINUTES,
  removed,
  type Request,
  subtitle,
  turnedDown,
} from './MembersSample.ts';
import { TYPE } from './parts.tsx';

const PLAIN: PersonOpening = { step: 'resting', picked: null };

/** Members in B: requests answered in place, the chips, a member's page and the owner claim, on sample data. */
export function MembersSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = membersStateOf(state);

  return <MembersScreen key={name} start={membersStart(name)} />;
}

function MembersScreen({ start }: { start: MembersStart }) {
  const shell = useShell();
  const landscape = shell.layout === 'landscape';
  const viewer = start.viewer;
  const say = membersSayIn(formattingLocale('en', getLocales()[0]?.languageTag));
  const { load, retry } = useLoad(start.load);
  const [people, setPeople] = useState<Person[]>(start.people);
  const [filter, setFilter] = useState<Filter>(start.filter);
  const [request, setRequest] = useState<Request>(start.request);
  const [open, setOpen] = useState<string | null>(start.open);
  const [opening, setOpening] = useState<PersonOpening>(start);
  const [visit, setVisit] = useState(0);
  const [gone, setGone] = useState<Person | null>(null);
  const [claim, setClaim] = useState<Claim | null>(start.claim);
  const [withdrawing, setWithdrawing] = useState(start.withdrawing);
  const [provedAt, setProvedAt] = useState<number | null>(null);
  const person = open == null ? null : (people.find((one) => one.id === open) ?? null);

  useEffect(() => {
    if (provedAt == null) return;
    const timer = setTimeout(() => setProvedAt(null), PROOF_MINUTES * 60_000);

    return () => clearTimeout(timer);
  }, [provedAt]);

  function openPerson(id: string | null, with_: PersonOpening = PLAIN): void {
    setOpen(id);
    setOpening(with_);
    setVisit((count) => count + 1);
    setGone(null);
  }

  function see(answer: Request): void {
    setRequest('resting');
    if (typeof answer === 'object' && 'approved' in answer) openPerson(answer.approved);
    else setFilter('former');
  }

  const list = (
    <MembersList
      people={people}
      viewer={viewer}
      filter={filter}
      request={request}
      open={landscape ? open : null}
      dense={landscape}
      say={say}
      gone={gone}
      claim={claim}
      withdrawing={withdrawing}
      onClaim={(next) => {
        setClaim(next);
        setWithdrawing(false);
      }}
      onFilter={setFilter}
      onRequest={setRequest}
      onApprove={(one, role) => {
        setPeople((before) => approved(before, one.id, role));
        setRequest({ approved: one.id, role });
      }}
      onTurnDown={(one) => {
        setPeople((before) => turnedDown(before, one.id));
        setRequest({ turnedDown: one.id });
      }}
      onSee={see}
      onOpen={(id) => openPerson(id)}
    />
  );
  const column = landscape ? (
    <SectionColumn title="Members" sub={subtitle(people)}>
      {list}
    </SectionColumn>
  ) : undefined;

  if (load !== 'loaded')
    return (
      <SettingsPage title="Members">
        {load === 'failed' ? (
          <Failed
            words="We could not load the members. Check your connection and try again."
            onRetry={retry}
            testID="members.retry"
          />
        ) : (
          <LoadingRows words="Loading members…" />
        )}
      </SettingsPage>
    );

  if (person != null)
    return (
      <PersonPage
        person={person}
        visit={visit}
        people={people}
        viewer={viewer}
        opening={opening}
        say={say}
        column={column}
        back={landscape ? null : { label: 'Members', onPress: () => openPerson(null) }}
        proved={provedAt != null}
        onProved={() => setProvedAt(Date.now())}
        onPeople={setPeople}
        onRemoved={(one) => {
          setPeople((before) => removed(before, one.id));
          openPerson(null);
          setGone(one);
        }}
      />
    );

  if (landscape)
    return (
      <Landscape column={column}>
        <NobodyPicked />
      </Landscape>
    );

  return (
    <SettingsPage title="Members" sub={subtitle(people)}>
      {list}
    </SettingsPage>
  );
}

function MembersList({
  people,
  viewer,
  filter,
  request,
  open,
  dense,
  say,
  gone,
  claim,
  withdrawing,
  onClaim,
  onFilter,
  onRequest,
  onApprove,
  onTurnDown,
  onSee,
  onOpen,
}: {
  people: readonly Person[];
  viewer: MembersStart['viewer'];
  filter: Filter;
  request: Request;
  open: string | null;
  dense: boolean;
  say: MembersSay;
  gone: Person | null;
  claim: Claim | null;
  withdrawing: boolean;
  onClaim: (claim: Claim) => void;
  onFilter: (filter: Filter) => void;
  onRequest: (request: Request) => void;
  onApprove: (person: Person, role: string) => void;
  onTurnDown: (person: Person) => void;
  onSee: (request: Request) => void;
  onOpen: (id: string) => void;
}) {
  const shell = useShell();
  const listed = people.filter((one) => isShown(one.status, filter));
  const asking = people.find((one) => one.status === 'pendingApproval') ?? null;
  const answeredId =
    typeof request === 'object'
      ? 'approved' in request
        ? request.approved
        : request.turnedDown
      : null;
  const answered = people.find((one) => one.id === answeredId) ?? null;
  const ownerActive = people.some((one) => one.role === 'Owner' && one.status === 'active');

  return (
    <>
      {claim != null && !ownerActive && (
        <OwnerClaim
          claim={claim}
          withdrawing={withdrawing}
          layout={dense ? 'phone' : shell.layout}
          say={say}
          onClaim={onClaim}
        />
      )}
      {gone != null && (
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          title={`${gone.name} was removed. Their events stay with ${ORGANISATION}.`}
          body="They are listed under Former in Members, with everything they did kept."
          announce
        />
      )}
      {viewer.manages && (
        <Awaiting
          person={asking}
          answered={answered}
          request={request}
          layout={shell.layout}
          dense={dense}
          say={say}
          onRequest={onRequest}
          onApprove={onApprove}
          onTurnDown={onTurnDown}
          onSee={onSee}
        />
      )}
      <Filters on={filter} counts={counts(people)} onPick={onFilter} />
      {listed.length === 0 ? (
        <Empty filter={filter} onShowEveryone={() => onFilter('all')} />
      ) : (
        <MemberRows
          people={listed}
          you={viewer.id}
          open={open}
          dense={dense}
          say={say}
          onOpen={onOpen}
        />
      )}
      {viewer.manages && (
        <Text size={TYPE.line} weight="medium" style={styles.secondary}>
          {FROM_THE_WEB}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
});
