import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance, ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  moveScreenReaderFocus,
  type ScreenReaderTarget,
} from '../../components/screenReaderFocus.ts';
import { tokens } from '../../theme/tokens.ts';

import { Landscape, SeenBy } from './Frame.tsx';
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
import {
  answerable,
  answerTakes,
  endedByRemoval,
  type RecoveryAnswer,
  type RecoveryAsk,
} from './MembersRecoverySample.ts';
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
  membersViewerOf,
  type Person,
  PROOF_MINUTES,
  reachableState,
  removed,
  type Removal,
  type Request,
  turnedDown,
} from './MembersSample.ts';
import { memberLooking } from './sample.ts';
import { useShell } from '../../components/settingsShell.ts';
import { SummaryPage } from './SummaryPage.tsx';
import {
  Ask,
  FailedBlock,
  LoadingBlock,
  SummaryColumn,
  useRowClear,
} from '../../components/Summary.tsx';

const PLAIN: PersonOpening = { step: 'resting', picked: null, handover: null, said: null };

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
  const { t } = useTranslation();
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
  const focusBack = useRef<ScreenReaderTarget | null>(null);
  const insets = useSafeAreaInsets();
  const clear = useRowClear();
  const [recovery, setRecovery] = useState<string[]>(start.recovery);
  const [recoveryAsk, setRecoveryAsk] = useState<RecoveryAsk | null>(start.recoveryAsk);
  const [recoveryAnswer, setRecoveryAnswer] = useState<RecoveryAnswer | null>(start.recoveryAnswer);
  const [lit, setLit] = useState<string | null>(null);
  const [sent, setSent] = useState(start.recoveryAsk?.phase === 'sending' ? 1 : 0);
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
    setRecoveryAsk({ id, answer, phase: 'asking' });
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

  /** Cancel, Keep the request, Back and the escape change nothing, and wait while an answer is out; once the request has gone, they are Close. */
  function keepRecoveryAsk(): void {
    if (recoveryAsk?.phase === 'sending') return;
    if (recoveryAsk?.phase === 'closed') closeGone(recoveryAsk.id);
    else setRecoveryAsk(null);
  }

  /** The verb sends the answer, or tries it again after a failure; the failed line goes while it is out. */
  function confirmRecoveryAsk(): void {
    if (recoveryAsk == null || recoveryAsk.phase === 'sending' || recoveryAsk.phase === 'closed')
      return;
    setRecoveryAsk({ ...recoveryAsk, phase: 'sending' });
    setSent((count) => count + 1);
  }

  useEffect(() => {
    if (sent === 0 || recoveryAsk == null) return;
    const ask = recoveryAsk;
    const wait = setTimeout(
      () => answerRecovery(ask.id, ask.answer === 'approve' ? 'approved' : 'turnedDown'),
      answerTakes(start.answering, sent),
    );

    return () => clearTimeout(wait);
    // Once per answer sent: it answers the confirm that was open as its verb was pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent]);

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
        toldAtMount={removals > 0}
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
      <Landscape column={<SummaryColumn title={t('settings.members')}>{block}</SummaryColumn>}>
        {null}
      </Landscape>
    ) : (
      <SummaryPage title={t('settings.members')}>{block}</SummaryPage>
    );
  }

  const column = landscape ? (
    <SummaryColumn title={t('settings.members')} scrollRef={listScroll}>
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
          leads={leads}
          viewer={viewer}
          opening={opening}
          say={say}
          column={column}
          back={
            landscape ? null : { label: t('settings.members'), onPress: () => openPerson(null) }
          }
          proved={provedAt != null}
          onProved={() => setProvedAt(Date.now())}
          onPeople={setPeople}
          onRemoved={(one, taker) => {
            const count = leads[one.id]?.length ?? 0;
            const to = people.find(({ id }) => id === taker);
            setPeople((before) => removed(before, one.id));
            setRecovery((before) => endedByRemoval(before, one.id));
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
        <SummaryPage title={t('settings.members')} scrollRef={listScroll}>
          {list}
        </SummaryPage>
      )}
      {overlays}
    </>
  );
}
