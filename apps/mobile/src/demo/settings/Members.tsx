import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewInstance } from 'react-native';

import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  moveScreenReaderFocus,
  type ScreenReaderTarget,
} from '../../components/screenReaderFocus.ts';
import type { TextHandle } from '../../components/Text.tsx';

import { Landscape, SeenBy, useShell } from './Frame.tsx';
import { ClaimScreen, useOwnerClaim } from './MembersClaim.tsx';
import { useLoad } from './MembersLoading.tsx';
import { MembersCardView, NobodyPicked, People, Waiting } from './MembersParts.tsx';
import { type PersonOpening, PersonPage } from './MembersPerson.tsx';
import { RequestScreen } from './MembersRequest.tsx';
import {
  approved,
  type CardStep,
  counts,
  type Filter,
  handedOver,
  isShown,
  type Leads,
  membersCard,
  membersSayIn,
  type MembersStart,
  membersStart,
  membersStateOf,
  type Person,
  PROOF_MINUTES,
  removed,
  type Removal,
  type Request,
  turnedDown,
} from './MembersSample.ts';
import { memberLooking } from './sample.ts';
import { FailedBlock, LoadingBlock, SummaryColumn, SummaryPage } from './Summary.tsx';

const PLAIN: PersonOpening = { step: 'resting', picked: null, handover: null, said: null };

/** Members in B, summary first: the card, who waits, the people, a member's page and the owner claim, on sample data. */
export function MembersSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = membersStateOf(state);
  const start = useMemo(() => membersStart(name), [name]);
  const looking = useMemo(() => memberLooking(start.viewer.id), [start]);

  return (
    <SeenBy looking={looking}>
      <MembersScreen key={name} start={start} />
    </SeenBy>
  );
}

function MembersScreen({ start }: { start: MembersStart }) {
  const shell = useShell();
  const landscape = shell.layout === 'landscape';
  const viewer = start.viewer;
  const say = membersSayIn(formattingLocale('en', getLocales()[0]?.languageTag));
  const { load, retry } = useLoad(start.load);
  const [people, setPeople] = useState<Person[]>(start.people);
  const [leads, setLeads] = useState<Leads>(start.leads);
  const [filter, setFilter] = useState<Filter>(start.filter);
  const [request, setRequest] = useState<Request>(start.request);
  const [requestVisit, setRequestVisit] = useState(0);
  const [open, setOpen] = useState<string | null>(start.open);
  const [opening, setOpening] = useState<PersonOpening>(start);
  const [visit, setVisit] = useState(0);
  const [gone, setGone] = useState<Removal | null>(start.gone);
  const [removals, setRemovals] = useState(0);
  const [provedAt, setProvedAt] = useState<number | null>(null);
  const owner = useOwnerClaim(start.claim, start.withdrawing);
  const waitingRow = useRef<ViewInstance>(null);
  const cardStep = useRef<ViewInstance>(null);
  const cardSays = useRef<TextHandle>(null);
  const focusBack = useRef<ScreenReaderTarget | null>(null);
  const [askedId] = useState(
    () => start.people.find((one) => one.status === 'pendingApproval')?.id ?? null,
  );
  const person = open == null ? null : (people.find((one) => one.id === open) ?? null);
  const asked = viewer.manages ? (people.find((one) => one.id === askedId) ?? null) : null;
  const asking = asked?.status === 'pendingApproval' ? asked : null;
  const card = membersCard({ people, viewer, request, gone, claim: owner.claim, say });

  /** After a removal the focus goes to the card's sentence, which is read out as a status (WCAG 2.2 4.1.3). */
  useEffect(() => {
    if (removals === 0) return;
    const focus = setTimeout(() => moveScreenReaderFocus(cardSays.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, [removals]);

  useEffect(() => {
    if (provedAt == null) return;
    const timer = setTimeout(() => setProvedAt(null), PROOF_MINUTES * 60_000);

    return () => clearTimeout(timer);
  }, [provedAt]);

  /** An answer, a removal or a withdrawn claim stays on the card until the person moves on. */
  function moveOn(): void {
    if (typeof request === 'object') setRequest('resting');
    setGone(null);
    owner.moveOn();
  }

  function openPerson(id: string | null, with_: PersonOpening = PLAIN): void {
    moveOn();
    setOpen(id);
    setOpening(with_);
    setVisit((count) => count + 1);
  }

  function showFilter(next: Filter): void {
    moveOn();
    setFilter(next);
  }

  function from(opener: RefObject<ViewInstance | null>): void {
    focusBack.current = opener.current;
  }

  function openRequest(opener: RefObject<ViewInstance | null>): void {
    from(opener);
    setRequestVisit((count) => count + 1);
    setRequest('approving');
  }

  function onStep(step: CardStep): void {
    switch (step) {
      case 'answer':
        openRequest(cardStep);
        return;
      case 'seePerson':
        if (typeof request === 'object' && 'approved' in request) openPerson(request.approved);
        return;
      case 'seeFormer':
        showFilter('former');
        return;
      case 'becomeOwner':
        from(cardStep);
        owner.become();
        return;
      case 'checkRecord':
        from(cardStep);
        owner.checkRecord();
    }
  }

  const listed = people.filter((one) => isShown(one.status, filter));
  const list = (
    <>
      <MembersCardView
        card={card}
        compact={landscape}
        wide={shell.layout === 'portrait'}
        saysRef={cardSays}
        toldAtMount={removals > 0}
        stepRef={cardStep}
        onStep={onStep}
      />
      {asking != null && (
        <Waiting
          person={asking}
          dense={landscape}
          say={say}
          onOpen={() => openRequest(waitingRow)}
          rowRef={waitingRow}
        />
      )}
      <People
        listed={listed}
        counts={counts(people)}
        filter={filter}
        you={viewer.id}
        open={landscape ? open : null}
        dense={landscape}
        manages={viewer.manages}
        onFilter={showFilter}
        onOpen={(id) => openPerson(id)}
      />
    </>
  );
  const overlays = (
    <>
      {asked != null && (
        <RequestScreen
          key={requestVisit}
          person={asked}
          open={request === 'approving' || request === 'turningDown'}
          turningDown={request === 'turningDown'}
          say={say}
          opener={focusBack}
          onTurningDown={(yes) => setRequest(yes ? 'turningDown' : 'approving')}
          onClose={() => setRequest('resting')}
          onApprove={(role) => {
            setPeople((before) => approved(before, asked.id, role));
            setRequest({ approved: asked.id, role });
          }}
          onTurnDown={() => {
            setPeople((before) => turnedDown(before, asked.id));
            setRequest({ turnedDown: asked.id });
          }}
        />
      )}
      {owner.claim != null && <ClaimScreen owner={owner} say={say} opener={focusBack} />}
    </>
  );

  if (load !== 'loaded') {
    const block =
      load === 'failed' ? (
        <FailedBlock
          title="We could not load the members."
          line="Check your connection and try again."
          onRetry={retry}
          testID="members.retry"
        />
      ) : (
        <LoadingBlock words="Loading members…" height={landscape ? 156 : 200} />
      );

    return landscape ? (
      <Landscape column={<SummaryColumn title="Members">{block}</SummaryColumn>}>{null}</Landscape>
    ) : (
      <SummaryPage title="Members">{block}</SummaryPage>
    );
  }

  const column = landscape ? <SummaryColumn title="Members">{list}</SummaryColumn> : undefined;

  if (person != null)
    return (
      <>
        <PersonPage
          person={person}
          visit={visit}
          people={people}
          leads={leads}
          viewer={viewer}
          opening={opening}
          say={say}
          column={column}
          back={landscape ? null : { label: 'Members', onPress: () => openPerson(null) }}
          proved={provedAt != null}
          onProved={() => setProvedAt(Date.now())}
          onPeople={setPeople}
          onRemoved={(one, taker) => {
            const count = leads[one.id]?.length ?? 0;
            const to = people.find(({ id }) => id === taker);
            setPeople((before) => removed(before, one.id));
            if (taker != null) setLeads((before) => handedOver(before, one.id, [taker]));
            openPerson(null);
            setGone({
              person: one,
              handed:
                to == null || count === 0 ? null : { count, to: to.name, you: to.id === viewer.id },
            });
            setRemovals((times) => times + 1);
          }}
          onHandedOver={(from, to) => setLeads((before) => handedOver(before, from, [to]))}
        />
        {overlays}
      </>
    );

  return (
    <>
      {landscape ? (
        <Landscape column={column}>
          <NobodyPicked />
        </Landscape>
      ) : (
        <SummaryPage title="Members">{list}</SummaryPage>
      )}
      {overlays}
    </>
  );
}
