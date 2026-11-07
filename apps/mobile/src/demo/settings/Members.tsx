import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance, ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  moveScreenReaderFocus,
  type ScreenReaderTarget,
} from '../../components/screenReaderFocus.ts';
import { tokens } from '../../theme/tokens.ts';

import { Landscape, SeenBy, useShell } from './Frame.tsx';
import { ClaimScreen, useOwnerClaim } from './MembersClaim.tsx';
import { useLoad } from './MembersLoading.tsx';
import { MembersCardView, NobodyPicked, People, Waiting } from './MembersParts.tsx';
import { type PersonOpening, PersonPage } from './MembersPerson.tsx';
import {
  bringListUp,
  RecoveryRequests,
  type RecoveryPart,
  recoveryQuestion,
} from './MembersRecovery.tsx';
import { answerable, type RecoveryAnswer, type RecoveryAsk } from './MembersRecoverySample.ts';
import { RequestScreen } from './MembersRequest.tsx';
import {
  approved,
  type CardStep,
  counts,
  type Filter,
  isShown,
  membersCard,
  membersSayIn,
  type MembersStart,
  membersStart,
  membersStateOf,
  membersViewerOf,
  type Person,
  PROOF_MINUTES,
  reachableState,
  removed,
  type Request,
  turnedDown,
} from './MembersSample.ts';
import { memberLooking } from './sample.ts';
import {
  Ask,
  FailedBlock,
  LoadingBlock,
  SummaryColumn,
  SummaryPage,
  useRowClear,
} from './Summary.tsx';

const PLAIN: PersonOpening = { step: 'resting', picked: null };

/** Members in B, summary first: the card, who waits, the people, a member's page and the owner claim, on sample data. */
export function MembersSection() {
  const { state, as } = useLocalSearchParams<{ state?: string; as?: string }>();
  const chosen = membersViewerOf(as);
  const name = reachableState(membersStateOf(state), chosen);
  const start = useMemo(() => membersStart(name, chosen), [name, chosen]);
  const looking = useMemo(() => memberLooking(start.viewer.id), [start]);

  return (
    <SeenBy looking={looking}>
      <MembersScreen key={`${name}:${start.viewer.id}`} start={start} />
    </SeenBy>
  );
}

type Targets = Partial<Record<string, Partial<Record<RecoveryPart, ViewInstance | null>>>>;

function MembersScreen({ start }: { start: MembersStart }) {
  const shell = useShell();
  const landscape = shell.layout === 'landscape';
  const viewer = start.viewer;
  const say = membersSayIn(formattingLocale('en', getLocales()[0]?.languageTag));
  const { load, retry } = useLoad(start.load);
  const [people, setPeople] = useState<Person[]>(start.people);
  const [filter, setFilter] = useState<Filter>(start.filter);
  const [request, setRequest] = useState<Request>(start.request);
  const [requestVisit, setRequestVisit] = useState(0);
  const [open, setOpen] = useState<string | null>(start.open);
  const [opening, setOpening] = useState<PersonOpening>(start);
  const [visit, setVisit] = useState(0);
  const [gone, setGone] = useState<Person | null>(null);
  const [provedAt, setProvedAt] = useState<number | null>(null);
  const owner = useOwnerClaim(start.claim, start.withdrawing);
  const waitingRow = useRef<ViewInstance>(null);
  const cardStep = useRef<ViewInstance>(null);
  const focusBack = useRef<ScreenReaderTarget | null>(null);
  const insets = useSafeAreaInsets();
  const clear = useRowClear();
  const [recovery, setRecovery] = useState<string[]>(start.recovery);
  const [recoveryAsk, setRecoveryAsk] = useState<RecoveryAsk | null>(start.recoveryAsk);
  const [recoveryAnswer, setRecoveryAnswer] = useState<RecoveryAnswer | null>(start.recoveryAnswer);
  const [lit, setLit] = useState<string | null>(null);
  const listScroll = useRef<ScrollViewInstance>(null);
  const recoveryList = useRef<ViewInstance>(null);
  const cardSays = useRef<ScreenReaderTarget | null>(null);
  const targets = useRef<Targets>({});
  const lighting = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Where a closed confirm gives the focus back: the answer that opened it, the next request, or the card's sentence (null).
  const back = useRef<{ id: string; part: RecoveryPart } | null>(
    start.recoveryAsk == null ? null : { id: start.recoveryAsk.id, part: start.recoveryAsk.answer },
  );
  const recoveryOpener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        const at = back.current;

        return (at == null ? null : targets.current[at.id]?.[at.part]) ?? cardSays.current;
      },
    }),
    [],
  );
  const [askedId] = useState(
    () => start.people.find((one) => one.status === 'pendingApproval')?.id ?? null,
  );
  const person = open == null ? null : (people.find((one) => one.id === open) ?? null);
  const asked = viewer.manages ? (people.find((one) => one.id === askedId) ?? null) : null;
  const asking = asked?.status === 'pendingApproval' ? asked : null;
  const card = membersCard({
    people,
    viewer,
    request,
    gone,
    claim: owner.claim,
    say,
    recovery: { waiting: recovery, answer: recoveryAnswer },
  });
  const recoveryAsked =
    recoveryAsk == null ? null : (people.find((one) => one.id === recoveryAsk.id) ?? null);
  const waitingBack = viewer.manages
    ? recovery.flatMap((id) => people.filter((one) => one.id === id))
    : [];

  useEffect(() => {
    if (provedAt == null) return;
    const timer = setTimeout(() => setProvedAt(null), PROOF_MINUTES * 60_000);

    return () => clearTimeout(timer);
  }, [provedAt]);

  useEffect(() => () => clearTimeout(lighting.current), []);

  /** An answer, a removal or a withdrawn claim stays on the card until the person moves on. */
  function moveOn(): void {
    if (typeof request === 'object') setRequest('resting');
    setGone(null);
    setRecoveryAnswer(null);
    setLit(null);
    owner.moveOn();
  }

  /** The card's step: the oldest request the viewer can answer comes into view, lit, and takes the focus. */
  function lightRecovery(): void {
    const id = answerable(recovery, viewer.id)[0];
    if (id == null) return;
    setLit(id);
    const top = (shell.layout === 'phone' ? insets.top : 0) + tokens.spaceSm;
    requestAnimationFrame(() =>
      bringListUp(recoveryList.current, targets.current[id]?.box, listScroll.current, top, clear),
    );
    clearTimeout(lighting.current);
    lighting.current = setTimeout(
      () => moveScreenReaderFocus(targets.current[id]?.group ?? null),
      SETTLED_MS,
    );
  }

  function askRecovery(id: string, answer: RecoveryAsk['answer']): void {
    back.current = { id, part: answer };
    setRecoveryAsk({ id, answer, closed: false });
  }

  function answerRecovery(id: string, kind: RecoveryAnswer['kind']): void {
    back.current = null;
    moveOn();
    setRecovery((before) => before.filter((one) => one !== id));
    setRecoveryAnswer({ id, kind });
    setRecoveryAsk(null);
  }

  /** Answered elsewhere: Close takes the request off the page, and the next one, or the card, takes the focus. */
  function closeGone(id: string): void {
    const rest = recovery.filter((one) => one !== id);
    const next = rest[0];
    back.current = next == null ? null : { id: next, part: 'group' };
    moveOn();
    setRecovery(rest);
    setRecoveryAsk(null);
  }

  /** Cancel, Keep the request, Back and the escape change nothing; once the request has gone, they are Close. */
  function keepRecoveryAsk(): void {
    if (recoveryAsk?.closed === true) closeGone(recoveryAsk.id);
    else setRecoveryAsk(null);
  }

  function confirmRecoveryAsk(): void {
    if (recoveryAsk == null) return;
    answerRecovery(recoveryAsk.id, recoveryAsk.answer === 'approve' ? 'approved' : 'turnedDown');
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
      case 'answerRecovery':
        lightRecovery();
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
        stepRef={cardStep}
        saysRef={(view) => {
          cardSays.current = view;
        }}
        onStep={onStep}
      />
      {waitingBack.length > 0 && (
        <RecoveryRequests
          waiting={waitingBack}
          you={viewer.id}
          lit={lit}
          dense={landscape}
          say={say}
          listRef={recoveryList}
          onTarget={(id, part, view) => {
            targets.current[id] = { ...targets.current[id], [part]: view };
          }}
          onAnswer={askRecovery}
        />
      )}
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
      <Ask
        open={recoveryAsked != null}
        opener={recoveryOpener}
        {...recoveryQuestion(recoveryAsk, recoveryAsked?.name ?? '')}
        onKeep={keepRecoveryAsk}
        onConfirm={confirmRecoveryAsk}
        testID="members.recovery.ask"
      />
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

  const column = landscape ? (
    <SummaryColumn title="Members" scrollRef={listScroll}>
      {list}
    </SummaryColumn>
  ) : undefined;

  if (person != null)
    return (
      <>
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
        <SummaryPage title="Members" scrollRef={listScroll}>
          {list}
        </SummaryPage>
      )}
      {overlays}
    </>
  );
}
