import type { SignInRulesPage } from '@soirely/api-client';
import { roleName } from '@soirely/domain';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../../src/api.ts';
import { AnswerHeading } from '../../src/components/AnswerHeading.tsx';
import { AppFrame, besideRow } from '../../src/components/AppFrame.tsx';
import { Refreshing } from '../../src/components/Refreshing.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, useBackToSettings } from '../../src/components/SettingsList.tsx';
import { StandChanges, StandRules } from '../../src/components/SignInRulesStand.tsx';
import {
  CardSays,
  FailedBlock,
  LoadingBlock,
  OnCard,
  Section,
  SummaryCard,
} from '../../src/components/Summary.tsx';
import { type TextHandle } from '../../src/components/Text.tsx';
import { moveScreenReaderFocus } from '../../src/components/screenReaderFocus.ts';
import { useOffline } from '../../src/offline.ts';
import { dateLocale, useShownLanguage } from '../../src/i18n/index.ts';
import { SECTION_HREF } from '../../src/kit/appNav.ts';
import { limitFromElsewhere } from '../../src/kit/signInRules.ts';
import {
  changeRows,
  managedAreas,
  ruleLabel,
  rulesCard,
  type StandRules as Rules,
  type StandViewer,
  standFoot,
  whereYouStand,
} from '../../src/kit/whereYouStand.ts';
import { type LayoutKind, settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import { PROVIDER_NAMES } from '../../src/providerSignIn.ts';
import { markRulesSeen, useRulesSeen } from '../../src/signInRulesSeen.ts';
import { rereadOrganisations, useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** `tapped` when it answers Try again, so focus moves to it (sc-11173). */
type Load =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: SignInRulesPage; tapped: boolean }
  | { kind: 'failed'; tapped: boolean };

/** Settings > Sign-in rules as its demo draws it (sc-30412): where you stand on each rule, then what changed. */
export default function SignInRules() {
  const { t } = useTranslation();
  const backToSettings = useBackToSettings();
  const { kind } = useLayout();
  const { account, organisation } = useSignedIn();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const alone = !settingsListBeside(kind);
  const organisationId = organisation?.id;
  const language = useShownLanguage();
  const loadedFor = useRef<string | null>(null);
  const retried = useRef(false);
  const heading = useRef<TextHandle>(null);
  const [refresh, setRefresh] = useState(0);
  const { watch, stale, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(heading.current),
  });
  // What this device had shown before the page opened, since opening it counts as seeing the change.
  const seenNow = useRulesSeen(organisationId ?? '');
  const [seenBefore, setSeenBefore] = useState<{ id: string; at: string | null } | null>(null);

  useEffect(() => {
    if (organisationId == null || seenNow === undefined) return;
    setSeenBefore((before) =>
      before?.id === organisationId ? before : { id: organisationId, at: seenNow },
    );
  }, [organisationId, seenNow]);

  useEffect(() => {
    if (organisationId == null) return;
    let live = true;
    const askedAgain = loadedFor.current === organisationId;
    const tapped = retried.current;
    retried.current = false;

    watch(api.signInRules(organisationId)).then(
      (page) => {
        if (!live) return;
        loadedFor.current = organisationId;
        setLoad({ kind: 'loaded', page, tapped });
      },
      () =>
        live &&
        setLoad((before) =>
          askedAgain && before.kind === 'loaded' ? before : { kind: 'failed', tapped },
        ),
    );

    return () => {
      live = false;
    };
  }, [organisationId, attempt, refresh, language, watch]);

  useEffect(() => {
    if (organisation != null && seenBefore?.id === organisation.id) markRulesSeen(organisation);
  }, [organisation, seenBefore]);

  // On a phone the frame's title is the page's heading, so Try again's answer lands there.
  useEffect(() => {
    if (kind === 'phone' && load.kind === 'loaded' && load.tapped)
      moveScreenReaderFocus(heading.current);
  }, [kind, load]);

  const title = t('settings.signInRules');
  const refreshingWords = refreshing ? <Refreshing testID="signInRules.refreshing" /> : null;
  const locale = dateLocale();
  const now = new Date();
  const phone = kind === 'phone';

  const body = (() => {
    if (load.kind === 'loading' || organisation == null)
      return <LoadingBlock words={t('signInRules.loading')} />;
    if (load.kind === 'failed')
      return (
        <FailedBlock
          title={t('signInRules.stand.loadFailedTitle')}
          line={t('signInRules.stand.loadFailedLine')}
          onRetry={() => {
            void rereadOrganisations();
            retried.current = true;
            setLoad({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
          testID="signInRules.retry"
        />
      );

    const { page } = load;
    const held = [...organisation.permissions, ...organisation.withheldUntilTwoFactor];
    const linked = account?.providers[0]?.provider;
    const rules: Rules = {
      providerOnly: page.providerOnly,
      inactivityTimeoutDays: page.inactivityTimeoutDays,
      administratorsNeedTwoFactor: page.administratorsNeedTwoFactor,
      everyoneNeedsTwoFactor: page.everyoneNeedsTwoFactor,
      twoFactorDeadline: page.twoFactorDeadline?.at ?? null,
      elsewhere: limitFromElsewhere(page.inactivityLimit, organisation.id),
      ownTwoFactor: page.ownTwoFactor,
    };
    const viewer: StandViewer = {
      organisation: organisation.name,
      role: roleName(t, organisation.role),
      manages: managedAreas(held),
      setsRules: held.includes('organisation.manage'),
      linked: page.ownProvider && linked != null ? PROVIDER_NAMES[linked] : null,
    };
    const rows = whereYouStand(t, rules, viewer, locale, now);
    const card = rulesCard(t, rows, viewer);

    return (
      <>
        <SummaryCard
          size={kind === 'tabletPortrait' ? 'wide' : 'page'}
          height={card.step == null ? 170 : 210}
          step={
            card.step == null
              ? null
              : {
                  label: card.step.label,
                  onPress: () => router.push(SECTION_HREF.security),
                  testID: 'signInRules.step',
                }
          }
          testID="signInRules.card"
        >
          <CardSays text={card.says} size={kind === 'tabletLandscape' ? 26 : 24} heading />
          <OnCard text={card.line} />
        </SummaryCard>
        <Section title={t('signInRules.stand.whereTitle')} foot={standFoot(t, rules)}>
          <StandRules rules={rows.map((rule) => ({ ...rule, label: ruleLabel(t, rule) }))} />
        </Section>
        <Section
          title={t('signInRules.stand.changedTitle')}
          foot={
            viewer.setsRules
              ? undefined
              : t('signInRules.askOwner', { organisation: organisation.name })
          }
        >
          <StandChanges
            changes={changeRows(t, page.changes, seenBefore?.at ?? null, locale, now)}
            none={{
              title: t('signInRules.stand.noChangesTitle'),
              line: t('signInRules.stand.noChangesLine'),
            }}
            newWord={t('signInRules.stand.new')}
          />
        </Section>
      </>
    );
  })();

  return (
    <AppFrame
      current="settings"
      offline={stale}
      besideTitle={alone ? refreshingWords : undefined}
      title={alone ? title : t('settings.title')}
      titleRef={phone ? heading : undefined}
      back={alone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="signInRules">
        <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
          {!phone && (
            <View style={besideRow.row}>
              <View style={styles.shrink}>
                <AnswerHeading
                  ref={heading}
                  size={kind === 'tabletLandscape' ? 28 : 30}
                  weight="bold"
                  answer={load.kind === 'loaded' && load.tapped ? load : undefined}
                >
                  {title}
                </AnswerHeading>
              </View>
              {!alone && refreshingWords}
            </View>
          )}
          {body}
        </Screen>
      </SettingsSplit>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1, minWidth: 0 },
  phone: {
    gap: 18,
    paddingTop: tokens.spaceXl,
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
    paddingBottom: tokens.space6xl * 2,
  },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
