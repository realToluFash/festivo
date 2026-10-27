import type { MembersList as Members, OrganisationRole } from '@soirely/api-client';
import { grantableRoles, roleHolds, withheldRoles } from '@soirely/domain';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../../src/api.ts';
import { AppFrame } from '../../src/components/AppFrame.tsx';
import { ComeForward, FocusWhenBehind } from '../../src/components/comeForward.ts';
import { SecondaryButton } from '../../src/components/Buttons.tsx';
import {
  type Answered,
  MemberList,
  MemberPage,
  activeCount,
} from '../../src/components/Members.tsx';
import {
  type ListAndPageSpacing,
  ListAndPage,
  useListAndPageKind,
} from '../../src/components/ListAndPage.tsx';
import { Notice } from '../../src/components/Notice.tsx';
import { type StepClosed, stepClosed, useFocusOnAnswer } from '../../src/components/Screen.tsx';
import { SettingsSplit, backToSettings } from '../../src/components/SettingsList.tsx';
import { SheetsAtRoot } from '../../src/components/Sheet.tsx';
import { type TextHandle, Text } from '../../src/components/Text.tsx';
import { cardFrame } from '../../src/components/cardFrame.ts';
import { useShownLanguage } from '../../src/i18n/index.ts';
import { DESTINATION_HREF, SECTION_HREF } from '../../src/kit/appNav.ts';
import { useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; tapped: boolean }
  | { kind: 'loaded'; list: Members; roles: OrganisationRole[] };

type Showing =
  | { kind: 'list'; flash: string | null; answered?: Answered; closed?: StepClosed }
  | { kind: 'member'; id: string; behind?: boolean; tapped?: object };

const LIST: Showing = { kind: 'list', flash: null };

const LOADING: Load = { kind: 'loading' };

/** Settings > Members, `MembersApp-*` (sc-3404): who is in the organisation, a role change and a removal. */
export default function MembersScreen() {
  const { t } = useTranslation();
  const kind = useListAndPageKind(SPACING, 'settingsList');
  const { organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const [held, setHeld] = useState<{ in: string | undefined; load: Load }>({
    in: organisationId,
    load: LOADING,
  });
  const [attempt, setAttempt] = useState(0);
  const [retried, setRetried] = useState<object | undefined>(undefined);
  const membersTitle = useRef<TextHandle>(null);
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
  if (landscape && shown.showing.kind === 'member' && shown.showing.behind === true) {
    setShown({ ...shown, showing: { kind: 'member', id: shown.showing.id } });
  }
  const landscapeNow = useRef(landscape);
  useEffect(() => {
    landscapeNow.current = landscape;
  }, [landscape]);
  const { read: memberName } = useFocusOnAnswer<TextHandle>(
    !landscape && shown.showing.kind === 'member' && shown.showing.behind !== true
      ? shown.showing.tapped
      : undefined,
  );
  const listBehindNow = useRef(false);
  const [nameWhenBehind] = useState(
    () => () => (listBehindNow.current ? memberName.current : null),
  );
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
            : { in: organisationId, load: { kind: 'failed', tapped: attempt > 0 } },
        ),
    );

    return () => {
      live = false;
    };
  }, [organisationId, attempt, language]);

  const member =
    load.kind === 'loaded' && showing.kind === 'member'
      ? (load.list.members.find((one) => one.id === showing.id) ?? null)
      : null;
  const inFront = showing.kind === 'member' && showing.behind === true ? null : member;
  const listBehind = !landscape && inFront != null;
  useEffect(() => {
    listBehindNow.current = listBehind;
  }, [listBehind]);

  useFocusOnAnswer<TextHandle>(load.kind === 'loaded' ? retried : undefined, membersTitle);

  if (organisation != null && !roleHolds(organisation, 'members.read')) {
    return <Redirect href={DESTINATION_HREF.settings} />;
  }

  const toList = () =>
    setShowing(
      showing.kind === 'member'
        ? { kind: 'list', flash: null, closed: stepClosed(`row.${showing.id}`) }
        : LIST,
    );
  const listForward = () => {
    if (landscapeNow.current) return;
    setShown((before) =>
      before.in === organisationId && before.showing.kind === 'member'
        ? { in: organisationId, showing: { ...before.showing, behind: true } }
        : before,
    );
  };
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
        <Text
          ref={membersTitle}
          size={tokens.typeTitlePhone.size}
          weight="bold"
          accessibilityRole="header"
        >
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
          announce={!load.tapped}
          answer={load.tapped ? load : undefined}
          takesFocus={load.tapped}
        />
        <SecondaryButton
          label={t('membersScreen.retry')}
          onPress={() => {
            setRetried({});
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
        closed={showing.kind === 'list' ? showing.closed : undefined}
        title={membersTitle}
        onAnswered={answered}
        onOpen={(id) => {
          setRetried(undefined);
          setShowing({ kind: 'member', id, tapped: {} });
        }}
      />
    ) : null;

  const page =
    organisation != null && load.kind === 'loaded' && member != null ? (
      <MemberPage
        kind={kind}
        organisation={organisation}
        member={member}
        list={load.list}
        roles={grantableRoles(load.roles, organisation)}
        withheld={withheldRoles(load.roles, organisation)}
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
        nameRef={memberName}
      />
    ) : null;

  return (
    <AppFrame
      current="settings"
      title={phone ? (inFront?.user.name ?? t('membersScreen.title')) : t('settings.title')}
      titleRef={phone ? (inFront != null ? memberName : membersTitle) : undefined}
      back={
        phone
          ? inFront != null
            ? { label: t('membersScreen.title'), onPress: toList }
            : backToSettings(t('settings.title'))
          : undefined
      }
    >
      <SettingsSplit open="members">
        <SheetsAtRoot>
          <ListAndPage
            kind={kind}
            heading={heading}
            list={
              <ComeForward.Provider value={listForward}>
                <FocusWhenBehind.Provider value={nameWhenBehind}>
                  {waiting ?? list}
                </FocusWhenBehind.Provider>
              </ComeForward.Provider>
            }
            page={
              page ??
              (landscape && load.kind === 'loaded' && (
                <Notice
                  tone="quiet"
                  mark={tokens.marks.info.glyph}
                  body={t('membersScreen.pickSomebody')}
                />
              ))
            }
            pageKey={member?.id ?? ''}
            pageInFront={inFront != null}
            back={{ label: t('membersScreen.backToList'), onPress: toList, testID: 'members.back' }}
            spacing={SPACING}
          />
        </SheetsAtRoot>
      </SettingsSplit>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
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
  column: { gap: tokens.spaceLg, paddingBottom: tokens.space5xl },
});

const SPACING: ListAndPageSpacing = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  landscape: styles.landscape,
  column: styles.column,
  listWidth: 300,
  between: tokens.spaceXxl,
};
