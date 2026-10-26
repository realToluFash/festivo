import type { SignInRuleChange, SignInRulesPage } from '@soirely/api-client';
import { formatDay, formatTimeOfDay, roleName } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../../src/api.ts';
import { AnswerHeading } from '../../src/components/AnswerHeading.tsx';
import { AppFrame } from '../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { SecondaryButton } from '../../src/components/Buttons.tsx';
import { Notice } from '../../src/components/Notice.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, backToSettings } from '../../src/components/SettingsList.tsx';
import { Text } from '../../src/components/Text.tsx';
import { cardFrame } from '../../src/components/cardFrame.ts';
import { dateLocale, useShownLanguage } from '../../src/i18n/index.ts';
import { limitFromElsewhere, ruleValue } from '../../src/kit/signInRules.ts';
import { type LayoutKind, useLayout } from '../../src/layout/useLayout.ts';
import { markRulesSeen } from '../../src/signInRulesSeen.ts';
import { useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** `tapped` when it answers Try again, so focus moves to it (sc-11173). */
type Load =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: SignInRulesPage; tapped: boolean }
  | { kind: 'failed'; tapped: boolean };

/** Settings > Sign-in rules, `PolicySignIn-*` state `policy_changes`: what changed, then what holds (sc-69). */
export default function SignInRules() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const phone = kind === 'phone';
  const organisationId = organisation?.id;
  const language = useShownLanguage();
  const loadedFor = useRef<string | null>(null);
  const retried = useRef(false);

  useEffect(() => {
    if (organisationId == null) return;
    let live = true;
    const askedAgain = loadedFor.current === organisationId;
    const tapped = retried.current;
    retried.current = false;

    api.signInRules(organisationId).then(
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
  }, [organisationId, attempt, language]);

  useEffect(() => {
    if (organisation != null) markRulesSeen(organisation);
  }, [organisation]);

  const title =
    organisation == null
      ? t('settings.signInRules')
      : t('signInRules.readTitle', { organisation: organisation.name });
  const elsewhere =
    load.kind === 'loaded' && organisationId != null
      ? limitFromElsewhere(load.page.inactivityLimit, organisationId)
      : null;

  return (
    <AppFrame
      current="settings"
      title={phone ? t('settings.signInRules') : t('settings.title')}
      back={phone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="signInRules">
        <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
          <AnswerHeading
            size={
              kind === 'tabletLandscape' ? tokens.typeTitlePage.size : tokens.typeTitlePhone.size
            }
            weight="bold"
            answer={load.kind === 'loaded' && load.tapped ? load : undefined}
          >
            {title}
          </AnswerHeading>
          <Text size={tokens.typeBodyPhone.size} style={styles.intro}>
            {t('signInRules.readIntro')}
          </Text>

          {load.kind === 'loading' && <Text muted>{t('signInRules.loading')}</Text>}

          {load.kind === 'failed' && (
            <View style={styles.cards}>
              <Notice
                tone="broken"
                mark={tokens.marks.broken.glyph}
                body={t('signInRules.failedLoad')}
                answer={load}
                takesFocus={load.tapped}
              />
              <SecondaryButton
                label={t('signInRules.retry')}
                onPress={() => {
                  retried.current = true;
                  setLoad({ kind: 'loading' });
                  setAttempt((n) => n + 1);
                }}
                testID="signInRules.retry"
              />
            </View>
          )}

          {load.kind === 'loaded' && organisation != null && (
            <View style={styles.cards}>
              {elsewhere != null && (
                <Notice
                  tone="quiet"
                  mark={tokens.marks.info.glyph}
                  body={t('signInRules.limitApplies', {
                    count: elsewhere.days,
                    organisation: elsewhere.organisation,
                  })}
                />
              )}
              <Changes kind={kind} changes={load.page.changes} />
              <View style={[cardFrame(kind), styles.section]}>
                <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
                  {t('signInRules.inForceTitle')}
                </Text>
                <Rule
                  label={t('signInRules.methodTitle')}
                  value={ruleValue(t, 'providerOnly', load.page.providerOnly)}
                />
                <Rule
                  label={t('signInRules.idleTitle')}
                  value={ruleValue(t, 'inactivityTimeoutDays', load.page.inactivityTimeoutDays)}
                />
                <Rule
                  label={t('signInRules.twoFactorShort')}
                  value={ruleValue(
                    t,
                    'administratorsNeedTwoFactor',
                    load.page.administratorsNeedTwoFactor,
                  )}
                />
                <Rule
                  label={t('signInRules.everyoneTitle')}
                  value={
                    load.page.everyoneNeedsTwoFactor
                      ? t('signInRules.everyoneRequiredFrom', {
                          deadline: load.page.twoFactorDeadline?.written ?? '',
                        })
                      : ruleValue(t, 'everyoneNeedsTwoFactor', false)
                  }
                />
                <Text size={tokens.typeBody.size} muted>
                  {t('signInRules.askOwner', { organisation: organisation.name })}
                </Text>
              </View>
            </View>
          )}
        </Screen>
      </SettingsSplit>
    </AppFrame>
  );
}

function Changes({ kind, changes }: { kind: LayoutKind; changes: SignInRuleChange[] }) {
  const { t } = useTranslation();
  const locale = dateLocale();

  return (
    <View style={[cardFrame(kind), styles.section]}>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {t('signInRules.changesTitle')}
      </Text>
      {changes.length === 0 ? (
        <Text size={tokens.typeBody.size} muted>
          {t('signInRules.noChanges')}
        </Text>
      ) : (
        changes.map((change) => (
          <View key={`${change.entry}-${change.rule}`} style={styles.row}>
            <Text size={tokens.typeLabel.size} muted>
              {t('signInRules.changeWhen', {
                day: formatDay(change.at, locale),
                time: formatTimeOfDay(change.at, locale),
                who:
                  change.by.role == null
                    ? change.by.name
                    : t('signInRules.changeWho', {
                        name: change.by.name,
                        role: roleName(t, change.by.role),
                      }),
              })}
            </Text>
            <Text size={tokens.typeBodyPhone.size} weight="semibold">
              {ruleValue(t, change.rule, change.now)}
            </Text>
            <Text size={tokens.typeBody.size} muted>
              {t('signInRules.changeWas', { was: ruleValue(t, change.rule, change.was) })}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text size={tokens.typeLabel.size} weight="semibold" muted style={styles.ruleLabel}>
        {label}
      </Text>
      <Text size={tokens.typeBodyPhone.size}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  portrait: { gap: tokens.spaceXl, padding: tokens.space3xl, paddingBottom: tokens.space6xl },
  landscape: {
    gap: tokens.spaceXxl,
    paddingTop: tokens.space4xl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl,
  },
  intro: { color: tokens.colorInkSecondary, maxWidth: 640 },
  cards: { gap: tokens.spaceLg },
  section: { gap: tokens.spaceMd },
  row: {
    gap: tokens.spaceXxs,
    paddingTop: tokens.spaceMd,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  ruleLabel: { textTransform: 'uppercase', letterSpacing: 1.3 },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
