import type { MembersList as Members, OrganisationRole } from '@soirely/api-client';
import { grantableRoles, roleHolds } from '@soirely/domain';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../../src/api.ts';
import { AppFrame } from '../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { ComeForward } from '../../src/components/comeForward.ts';
import { QuietButton, SecondaryButton } from '../../src/components/Buttons.tsx';
import {
  type Answered,
  MemberList,
  MemberPage,
  activeCount,
} from '../../src/components/Members.tsx';
import { Notice } from '../../src/components/Notice.tsx';
import { Screen, ScrollColumn } from '../../src/components/Screen.tsx';
import { SettingsSplit, backToSettings } from '../../src/components/SettingsList.tsx';
import { SheetsAtRoot } from '../../src/components/Sheet.tsx';
import { Text } from '../../src/components/Text.tsx';
import { cardFrame } from '../../src/components/cardFrame.ts';
import { useShownLanguage } from '../../src/i18n/index.ts';
import { DESTINATION_HREF, SECTION_HREF } from '../../src/kit/appNav.ts';
import { type LayoutKind, useLayout } from '../../src/layout/useLayout.ts';
import { useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; list: Members; roles: OrganisationRole[] };

type Showing =
  { kind: 'list'; flash: string | null; answered?: Answered } | { kind: 'member'; id: string };

const LIST_COLUMN = 300;

const LIST: Showing = { kind: 'list', flash: null };

const LOADING: Load = { kind: 'loading' };

/** Settings > Members, `MembersApp-*` (sc-3404): who is in the organisation, a role change and a removal. */
export default function MembersScreen() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const [held, setHeld] = useState<{ in: string | undefined; load: Load }>({
    in: organisationId,
    load: LOADING,
  });
  const [attempt, setAttempt] = useState(0);
  const load = held.in === organisationId ? held.load : LOADING;
  const setLoad = (next: Load) => setHeld({ in: organisationId, load: next });
  const [shown, setShown] = useState<{ in: string | undefined; showing: Showing }>({
    in: organisationId,
    showing: LIST,
  });
  const showing = shown.in === organisationId ? shown.showing : LIST;
  const setShowing = (next: Showing) => setShown({ in: organisationId, showing: next });
  const phone = kind === 'phone';
  const landscape = kind === 'tabletLandscape';
  const columnContent = landscape ? styles.columnContent : CONTENT[kind];
  const language = useShownLanguage();

  useEffect(() => {
    if (organisationId == null) return;
    let live = true;

    const settle = (next: Load) => live && setHeld({ in: organisationId, load: next });

    Promise.all([api.members(organisationId), api.roles(organisationId)]).then(
      ([list, catalogue]) => settle({ kind: 'loaded', list, roles: catalogue.roles }),
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
  }, [organisationId, attempt, language]);

  if (organisation != null && !roleHolds(organisation, 'members.read')) {
    return <Redirect href={DESTINATION_HREF.settings} />;
  }

  const member =
    load.kind === 'loaded' && showing.kind === 'member'
      ? (load.list.members.find((one) => one.id === showing.id) ?? null)
      : null;
  const toList = () => setShowing(LIST);
  const answered = (list: Members, done: Answered) => {
    if (load.kind === 'loaded') setLoad({ ...load, list });
    setShowing({ kind: 'list', flash: null, answered: done });
  };
  const subtitle =
    organisation != null && load.kind === 'loaded'
      ? t('membersScreen.subtitle', {
          organisation: organisation.name,
          count: activeCount(load.list),
        })
      : (organisation?.name ?? '');

  const heading = (
    <View style={styles.heading}>
      {!phone && (
        <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
          {t('membersScreen.title')}
        </Text>
      )}
      <Text size={tokens.typeBody.size} muted>
        {subtitle}
      </Text>
    </View>
  );

  const waiting =
    load.kind === 'loading' ? (
      <View style={cardFrame(kind)}>
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('membersScreen.loading')}
        </Text>
      </View>
    ) : load.kind === 'failed' ? (
      <View style={styles.stack} accessibilityRole="alert">
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('membersScreen.failedLoad')}
          announce
        />
        <SecondaryButton
          label={t('membersScreen.retry')}
          onPress={() => {
            setLoad({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
          testID="members.retry"
        />
      </View>
    ) : null;

  const list =
    organisation != null && load.kind === 'loaded' ? (
      <MemberList
        kind={kind}
        organisation={organisation}
        list={load.list}
        roles={grantableRoles(load.roles, organisation)}
        manages={roleHolds(organisation, 'members.manage')}
        open={member?.id ?? null}
        flash={showing.kind === 'list' ? showing.flash : null}
        answered={showing.kind === 'list' ? (showing.answered ?? null) : null}
        onAnswered={answered}
        onOpen={(id) => setShowing({ kind: 'member', id })}
      />
    ) : null;

  const page =
    organisation != null && load.kind === 'loaded' && member != null ? (
      <MemberPage
        key={member.id}
        kind={kind}
        organisation={organisation}
        member={member}
        list={load.list}
        roles={grantableRoles(load.roles, organisation)}
        manages={roleHolds(organisation, 'members.manage')}
        onChanged={(list) => setLoad({ ...load, list })}
        onRemoved={(list) => {
          setLoad({ ...load, list });
          setShowing({
            kind: 'list',
            flash: t('membersScreen.removed', {
              name: member.user.name,
              organisation: organisation.name,
            }),
          });
        }}
        onAnswered={answered}
        onGoToOrganisation={() => router.replace(SECTION_HREF.organisation)}
      />
    ) : null;

  return (
    <AppFrame
      current="settings"
      title={phone ? (member?.user.name ?? t('membersScreen.title')) : t('settings.title')}
      back={
        phone
          ? member != null
            ? { label: t('membersScreen.title'), onPress: toList }
            : backToSettings(t('settings.title'))
          : undefined
      }
    >
      <SettingsSplit open="members">
        <SheetsAtRoot>
          <Screen
            edges={bodyEdges(kind)}
            scroll={false}
            contentStyle={landscape ? styles.landscape : styles.bare}
          >
            {landscape && heading}
            <View style={landscape ? styles.split : styles.fill}>
              <View
                style={[
                  landscape ? styles.listColumn : styles.fill,
                  !landscape && page != null && styles.behind,
                ]}
              >
                <ComeForward.Provider value={landscape ? noop : toList}>
                  <ScrollColumn style={styles.fill} contentContainerStyle={columnContent}>
                    {!landscape && heading}
                    {waiting ?? list}
                  </ScrollColumn>
                </ComeForward.Provider>
              </View>
              <View style={[styles.fill, !landscape && page == null && styles.behind]}>
                <ScrollColumn style={styles.fill} contentContainerStyle={columnContent}>
                  {!landscape && !phone && (
                    <View style={styles.start}>
                      <QuietButton
                        label={t('membersScreen.backToList')}
                        onPress={toList}
                        testID="members.back"
                      />
                    </View>
                  )}
                  {page ??
                    (landscape && load.kind === 'loaded' && (
                      <Notice
                        tone="quiet"
                        mark={tokens.marks.info.glyph}
                        body={t('membersScreen.pickSomebody')}
                      />
                    ))}
                </ScrollColumn>
              </View>
            </View>
          </Screen>
        </SheetsAtRoot>
      </SettingsSplit>
    </AppFrame>
  );
}

function noop() {}

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  bare: { padding: 0, gap: 0 },
  behind: { display: 'none' },
  start: { alignSelf: 'flex-start' },
  stack: { gap: tokens.spaceMd },
  heading: { gap: tokens.spaceXxs },
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  portrait: {
    gap: 14,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.space6xl,
  },
  landscape: {
    gap: 14,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space3xl,
  },
  split: { flex: 1, minHeight: 0, flexDirection: 'row', gap: tokens.spaceXxl },
  listColumn: { width: LIST_COLUMN },
  columnContent: { gap: tokens.spaceLg, paddingBottom: tokens.space5xl },
});

const CONTENT: Record<Exclude<LayoutKind, 'tabletLandscape'>, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
};
