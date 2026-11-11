import type {
  MembersList as Members,
  OrganisationRole,
  RecoveryRequest,
} from '@soirely/api-client';
import {
  formatDay,
  grantableRoles,
  recoveryAnswerable,
  recoveryEndedByRemoval,
  recoveryShownIn,
  roleHolds,
  withheldRoles,
} from '@soirely/domain';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { type Ref, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../../src/api.ts';
import { AppFrame, besideRow } from '../../src/components/AppFrame.tsx';
import {
  type ListAndPageSpacing,
  ListAndPage,
  useListAndPageLayout,
} from '../../src/components/ListAndPage.tsx';
import { PersonBody } from '../../src/components/MemberPerson.tsx';
import { RecoveryRequests, type RecoveryPart } from '../../src/components/MembersRecovery.tsx';
import { RequestScreen } from '../../src/components/MemberRequest.tsx';
import {
  ClaimActions,
  ClaimRefused,
  ClaimScreen,
  useOwnerClaim,
} from '../../src/components/MembersClaim.tsx';
import {
  MembersCardView,
  NobodyPicked,
  People,
  Waiting,
} from '../../src/components/MembersSummary.tsx';
import { Refreshing } from '../../src/components/Refreshing.tsx';
import { SETTLED_MS } from '../../src/components/Screen.tsx';
import {
  moveScreenReaderFocus,
  type ScreenReaderTarget,
} from '../../src/components/screenReaderFocus.ts';
import { SettingsSplit, useBackToSettings } from '../../src/components/SettingsList.tsx';
import { SheetsAtRoot } from '../../src/components/Sheet.tsx';
import { Ask, FailedBlock, LoadingBlock } from '../../src/components/Summary.tsx';
import { type TextHandle, Text } from '../../src/components/Text.tsx';
import { currentLocale, dateLocale, useShownLanguage } from '../../src/i18n/index.ts';
import { DESTINATION_HREF, SECTION_HREF } from '../../src/kit/appNav.ts';
import {
  type MembersFilter,
  type MembersSaid,
  type MembersStep,
  membersCard,
  membersCounts,
  membersShown,
  waitingToJoin,
} from '../../src/kit/membersSummary.ts';
import {
  type RecoveryAnswer,
  type RecoveryAsk,
  recoveryGone,
  recoveryQuestion,
} from '../../src/kit/membersRecovery.ts';
import { settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import { useOffline } from '../../src/offline.ts';
import { rereadOrganisations, useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';
import { PAGE_TITLE, PANE_TITLE, pageTitle, paneTitle } from '../../src/components/topTitle.ts';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; list: Members; roles: OrganisationRole[]; recovery: RecoveryRequest[] };

const LOADING: Load = { kind: 'loading' };

type Targets = Partial<Record<string, Partial<Record<RecoveryPart, ViewInstance | null>>>>;

/** Settings › Members, summary first as its demo draws it (sc-37693): the card, the requests to get back in (sc-30894), who waits, the people, and a person's page. */
export default function MembersScreen() {
  const { t } = useTranslation();
  const backToSettings = useBackToSettings();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { kind, givesWay } = useListAndPageLayout(SPACING, 'settingsList');
  const alone = !settingsListBeside(useLayout().kind);
  const { organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const [held, setHeld] = useState<{ in: string | undefined; load: Load }>({
    in: organisationId,
    load: LOADING,
  });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [view, setView] = useState<{
    in: string | undefined;
    open: string | null;
    filter: MembersFilter;
    said: MembersSaid | null;
    request: string | null;
    lit: string | null;
  }>({ in: organisationId, open: null, filter: 'all', said: null, request: null, lit: null });
  const membersTitle = useRef<TextHandle>(null);
  const cardStep = useRef<ViewInstance>(null);
  const cardSays = useRef<ScreenReaderTarget | null>(null);
  const rows = useRef<Record<string, ViewInstance | null>>({});
  const opener = useRef<ScreenReaderTarget | null>(null);
  const [backTo, setBackTo] = useState<{ id: string } | { card: true } | null>(null);
  const [recoveryAsk, setRecoveryAsk] = useState<RecoveryAsk | null>(null);
  const [brought, setBrought] = useState(0);
  const targets = useRef<Targets>({});
  const lighting = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Where a closed confirm gives the focus back: the answer that opened it, the next request, or the card's words (null).
  const recoveryBack = useRef<{ id: string; part: RecoveryPart } | null>(null);
  const recoveryOpener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        const at = recoveryBack.current;

        return (at == null ? null : targets.current[at.id]?.[at.part]) ?? cardSays.current;
      },
    }),
    [],
  );
  const language = useShownLanguage();
  const load = held.in === organisationId ? held.load : LOADING;
  const setLoad = (next: Load) => setHeld({ in: organisationId, load: next });
  const fresh = {
    in: organisationId,
    open: null,
    filter: 'all',
    said: null,
    request: null,
    lit: null,
  } as const;
  const current = view.in === organisationId ? view : fresh;
  const change = (next: Partial<typeof current>) => setView({ ...current, ...next });
  const phone = kind === 'phone';
  const landscape = kind === 'tabletLandscape';
  const manages = organisation != null && roleHolds(organisation, 'members.manage');
  const owner = useOwnerClaim(organisationId, organisation?.role.seededAs === 'administrator');
  const { watch, stale, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(membersTitle.current),
  });

  useEffect(() => {
    if (organisationId == null) return;
    let live = true;

    // Members and its requests to get back in load, and fail, as one (pm, Decided 8 Nov).
    watch(
      Promise.all([
        api.members(organisationId),
        api.roles(organisationId),
        manages ? api.recoveryRequests() : Promise.resolve([]),
      ]),
    ).then(
      ([list, catalogue, requests]) =>
        live &&
        setHeld({
          in: organisationId,
          load: {
            kind: 'loaded',
            list,
            roles: catalogue.roles,
            recovery: recoveryShownIn(requests, organisationId),
          },
        }),
      () =>
        live &&
        setHeld((before) =>
          before.in === organisationId && before.load.kind === 'loaded'
            ? before
            : { in: organisationId, load: { kind: 'failed' } },
        ),
    );

    return () => {
      live = false;
    };
  }, [organisationId, manages, attempt, refresh, language, watch]);

  useEffect(() => () => clearTimeout(lighting.current), []);

  // Back on the list, the focus goes to the row that opened the page, or to the card's sentence after a removal.
  useEffect(() => {
    if (backTo == null) return;
    const focus = setTimeout(
      () =>
        moveScreenReaderFocus(
          'id' in backTo ? (rows.current[backTo.id] ?? membersTitle.current) : cardSays.current,
        ),
      SETTLED_MS,
    );

    return () => clearTimeout(focus);
  }, [backTo]);

  if (organisation != null && !roleHolds(organisation, 'members.read')) {
    return <Redirect href={DESTINATION_HREF.settings} />;
  }

  const members = load.kind === 'loaded' ? load.list.members : [];
  const member =
    current.open == null ? null : (members.find((one) => one.id === current.open) ?? null);
  const asked =
    current.request == null ? null : (members.find((one) => one.id === current.request) ?? null);
  const recovery = load.kind === 'loaded' && manages ? load.recovery : [];
  const recoveryAsked =
    recoveryAsk == null ? null : (recovery.find((one) => one.id === recoveryAsk.id) ?? null);
  const listBehind = !landscape && member != null;
  const day = (at: string) => formatDay(at, dateLocale());
  const rowRef =
    (id: string): Ref<ViewInstance> =>
    (view) => {
      rows.current[id] = view;
    };

  function moveOn(): void {
    owner.moveOn();
  }

  function openPerson(id: string | null): void {
    moveOn();
    if (id == null && current.open != null) setBackTo({ id: current.open });
    change({ open: id, said: null });
  }

  function openRequest(id: string, from: ScreenReaderTarget | null): void {
    opener.current = from;
    change({ request: id, said: null, lit: null });
  }

  function dropRecovery(keep: (request: RecoveryRequest) => boolean): void {
    setHeld((before) =>
      before.load.kind === 'loaded'
        ? { ...before, load: { ...before.load, recovery: before.load.recovery.filter(keep) } }
        : before,
    );
  }

  /** The card's step: the oldest request the viewer can answer comes into view, lit, and takes the focus. */
  function lightRecovery(id: string): void {
    change({ lit: id });
    setBrought((n) => n + 1);
    clearTimeout(lighting.current);
    lighting.current = setTimeout(
      () => moveScreenReaderFocus(targets.current[id]?.group ?? null),
      SETTLED_MS,
    );
  }

  function askRecovery(id: string, answer: RecoveryAnswer): void {
    recoveryBack.current = { id, part: answer };
    setRecoveryAsk({ id, answer, phase: 'asking' });
  }

  /** Answered elsewhere, ended, or its person gone: Close takes it off the page, and the next request, or the card, takes the focus. */
  function closeGone(id: string): void {
    const next = recovery.find((one) => one.id !== id);
    recoveryBack.current = next == null ? null : { id: next.id, part: 'group' };
    moveOn();
    dropRecovery((one) => one.id !== id);
    change({ said: null, lit: null });
    setRecoveryAsk(null);
  }

  /** Cancel, Keep the request, Back and the swipe change nothing, and wait while an answer is out; once the request has gone, they are Close. */
  function keepRecoveryAsk(): void {
    if (recoveryAsk?.phase === 'sending') return;
    if (recoveryAsk?.phase === 'closed') closeGone(recoveryAsk.id);
    else setRecoveryAsk(null);
  }

  /** The verb sends the answer, or tries it again after a failure; the confirm stays open until it comes back. */
  async function confirmRecoveryAsk(): Promise<void> {
    const ask = recoveryAsk;
    if (ask == null || recoveryAsked == null || ask.phase === 'sending' || ask.phase === 'closed')
      return;
    const name = recoveryAsked.name;
    setRecoveryAsk({ ...ask, phase: 'sending' });

    try {
      await (ask.answer === 'approve' ? api.approveRecovery(ask.id) : api.turnDownRecovery(ask.id));
    } catch (refusal) {
      setRecoveryAsk({ ...ask, phase: recoveryGone(refusal) ? 'closed' : 'failed' });
      return;
    }

    recoveryBack.current = null;
    moveOn();
    dropRecovery((one) => one.id !== ask.id);
    change({
      said: { kind: ask.answer === 'approve' ? 'recoveryApproved' : 'recoveryTurnedDown', name },
      lit: null,
    });
    setRecoveryAsk(null);
  }

  function onStep(step: MembersStep): void {
    switch (step.does) {
      case 'answer':
        openRequest(step.member, cardStep.current);
        return;
      case 'answerRecovery':
        lightRecovery(step.request);
        return;
      case 'seePerson':
        openPerson(step.member);
        return;
      case 'seeFormer':
        moveOn();
        change({ filter: 'former', said: null });
        return;
      case 'becomeOwner':
        opener.current = cardStep.current;
        owner.become();
        return;
      case 'checkRecord':
        opener.current = cardStep.current;
        owner.checkRecord();
    }
  }

  const card =
    organisation == null
      ? null
      : membersCard({
          t,
          members,
          manages,
          organisation: organisation.name,
          said:
            current.said ??
            (owner.withdrew == null ? null : { kind: 'withdrew', ...owner.withdrew }),
          claim: owner.banner,
          recovery: recoveryAnswerable(recovery),
        });
  const waiting = manages ? waitingToJoin(members) : [];
  const roles =
    load.kind === 'loaded' && organisation != null ? grantableRoles(load.roles, organisation) : [];

  const refreshingWords = refreshing ? <Refreshing testID="members.refreshing" /> : null;
  const heading = !alone && (
    <View style={besideRow.row}>
      <View style={styles.shrink}>
        <Text
          ref={membersTitle}
          size={landscape ? PANE_TITLE : PAGE_TITLE}
          weight="bold"
          style={landscape ? paneTitle : pageTitle}
          accessibilityRole="header"
        >
          {t('membersScreen.title')}
        </Text>
      </View>
      {refreshingWords}
    </View>
  );

  const list =
    load.kind === 'loading' ? (
      <LoadingBlock words={t('membersScreen.loading')} height={landscape ? 156 : 200} />
    ) : load.kind === 'failed' ? (
      <FailedBlock
        title={t('membersScreen.failedTitle')}
        line={t('membersScreen.failedLine')}
        onRetry={() => {
          void rereadOrganisations();
          setLoad({ kind: 'loading' });
          setAttempt((n) => n + 1);
        }}
        testID="members.retry"
      />
    ) : organisation == null || card == null ? null : (
      <View style={styles.blocks}>
        <MembersCardView
          card={card}
          compact={landscape}
          wide={kind === 'tabletPortrait'}
          saysRef={(view) => {
            cardSays.current = view;
          }}
          stepRef={cardStep}
          busy={owner.busy}
          onStep={onStep}
        />
        {owner.refusal != null && (
          <ClaimRefused key={owner.refusal.at} text={owner.refusal.words} />
        )}
        {owner.withdrew == null && current.said == null && (
          <ClaimActions owner={owner} organisation={organisation.name} />
        )}
        {recovery.length > 0 && (
          <RecoveryRequests
            waiting={recovery}
            lit={current.lit}
            brought={brought}
            dense={landscape}
            locale={currentLocale()}
            onTarget={(id, part, view) => {
              targets.current[id] = { ...targets.current[id], [part]: view };
            }}
            onAnswer={askRecovery}
          />
        )}
        {waiting.length > 0 && (
          <Waiting
            waiting={waiting}
            dense={landscape}
            day={day}
            onOpen={(id) => openRequest(id, rows.current[`request.${id}`] ?? null)}
            rowRef={(id) => rowRef(`request.${id}`)}
          />
        )}
        <People
          listed={membersShown(members, current.filter)}
          counts={membersCounts(members)}
          filter={current.filter}
          organisation={organisation.name}
          open={landscape ? (member?.id ?? null) : null}
          dense={landscape}
          manages={manages}
          rowRef={rowRef}
          onFilter={(filter) => {
            moveOn();
            change({ filter, said: null });
          }}
          onOpen={(id) => openPerson(id)}
        />
      </View>
    );

  const page =
    organisation != null && load.kind === 'loaded' && member != null ? (
      <View style={styles.blocks}>
        <PersonBody
          key={member.id}
          pane={landscape}
          organisation={organisation}
          member={member}
          list={load.list}
          roles={roles}
          withheld={withheldRoles(load.roles, organisation)}
          manages={manages}
          onChanged={(next) => setLoad({ ...load, list: next })}
          onRemoved={(next, name) => {
            setLoad({
              ...load,
              list: next,
              recovery: recoveryEndedByRemoval(load.recovery, member.user.id),
            });
            moveOn();
            change({ open: null, said: { kind: 'removed', name } });
            setBackTo({ card: true });
          }}
          onGoToOrganisation={() =>
            router.replace({ pathname: SECTION_HREF.organisation, params: from ? { from } : {} })
          }
        />
      </View>
    ) : null;

  return (
    <AppFrame
      current="settings"
      top={alone || !givesWay ? 'scrolls' : undefined}
      offline={stale}
      besideTitle={alone ? refreshingWords : undefined}
      title={
        phone
          ? listBehind
            ? (member?.user.name ?? '')
            : t('membersScreen.title')
          : alone
            ? t('membersScreen.title')
            : t('settings.title')
      }
      titleRef={phone ? (listBehind ? undefined : membersTitle) : alone ? membersTitle : undefined}
      back={
        phone && listBehind
          ? { label: t('membersScreen.title'), onPress: () => openPerson(null) }
          : alone && !listBehind
            ? backToSettings(t('settings.title'))
            : undefined
      }
    >
      <SettingsSplit open="members" givesWay={givesWay}>
        <SheetsAtRoot>
          <ListAndPage
            kind={kind}
            heading={heading}
            list={list}
            page={page ?? (landscape && load.kind === 'loaded' && <NobodyPicked />)}
            pageKey={member?.id ?? ''}
            pageInFront={listBehind}
            back={{
              label: t('membersScreen.backToList'),
              onPress: () => openPerson(null),
              testID: 'members.back',
            }}
            spacing={SPACING}
          />
        </SheetsAtRoot>
      </SettingsSplit>
      {organisation != null && load.kind === 'loaded' && asked != null && (
        <RequestScreen
          key={asked.id}
          organisation={organisation}
          member={asked}
          list={load.list}
          roles={roles}
          open={asked.status === 'pending_approval'}
          opener={opener}
          onClose={() => change({ request: null })}
          onAnswered={(next, said) => {
            setLoad({ ...load, list: next });
            change({ request: null, said });
          }}
        />
      )}
      {organisation != null && (
        <ClaimScreen owner={owner} organisation={organisation.name} opener={opener} />
      )}
      <Ask
        open={recoveryAsked != null}
        opener={recoveryOpener}
        {...recoveryQuestion(t, recoveryAsk, recoveryAsked?.name ?? '')}
        onKeep={keepRecoveryAsk}
        onConfirm={() => void confirmRecoveryAsk()}
        testID="members.recovery.ask"
      />
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1, minWidth: 0 },
  blocks: { gap: 18 },
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space6xl * 2,
  },
  portrait: {
    gap: 18,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl * 2,
  },
  landscape: {
    gap: 18,
    paddingTop: 26,
    paddingHorizontal: 30,
  },
  column: { gap: 18, paddingBottom: tokens.space6xl * 2 },
});

const SPACING: ListAndPageSpacing = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  landscape: styles.landscape,
  column: styles.column,
  listWidth: 300,
  between: tokens.spaceXxl,
};
