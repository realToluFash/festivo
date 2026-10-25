import type { OrganisationRole, RolesCatalogue } from '@soirely/api-client';
import { roleHolds, roleName } from '@soirely/domain';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../../src/api.ts';
import { AppFrame } from '../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from '../../src/components/Buttons.tsx';
import { Notice } from '../../src/components/Notice.tsx';
import { RoleList, RolePage, RemoveRole } from '../../src/components/Roles.tsx';
import { Screen, ScrollColumn, useFocusOnAnswer } from '../../src/components/Screen.tsx';
import { SettingsSplit, backToSettings } from '../../src/components/SettingsList.tsx';
import { Text, type TextHandle } from '../../src/components/Text.tsx';
import { cardFrame } from '../../src/components/cardFrame.ts';
import { DESTINATION_HREF } from '../../src/kit/appNav.ts';
import { type LayoutKind, useLayout } from '../../src/layout/useLayout.ts';
import { useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; catalogue: RolesCatalogue };

/** What the detail shows: a role, a role being made, or a role being removed. */
type Pane = { kind: 'role'; id: string } | { kind: 'new' } | { kind: 'removing'; id: string };

const LIST_COLUMN = 236;

const LOADING: Load = { kind: 'loading' };

/** Settings > Roles, `Roles-Phone` and `Roles-Tablet*` (sc-1931): sc-66's roles screen, in the app. */
export default function RolesScreen() {
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
  // At phone and tablet portrait a role opens on its own page; landscape keeps one beside the list.
  const [shown, setShown] = useState<{ in: string | undefined; pane: Pane | null }>({
    in: organisationId,
    pane: null,
  });
  const [saved, setSaved] = useState(false);
  // The pane a tap opened, and where on it screen reader focus goes (sc-11032).
  const [arrival, setArrival] = useState<{ pane: Pane; at: 'name' | 'saved' } | null>(null);
  const phone = kind === 'phone';
  const landscape = kind === 'tabletLandscape';
  const columnContent = landscape ? styles.columnContent : CONTENT[kind];

  useEffect(() => {
    if (organisationId == null) return;
    let live = true;

    api.roles(organisationId).then(
      (catalogue) => live && setHeld({ in: organisationId, load: { kind: 'loaded', catalogue } }),
      () => live && setHeld({ in: organisationId, load: { kind: 'failed' } }),
    );

    return () => {
      live = false;
    };
  }, [organisationId, attempt]);

  const opened = shown.in === organisationId ? shown.pane : null;
  const arrived = arrival != null && arrival.pane === opened ? arrival : null;
  const atName = arrived?.at === 'name' ? arrived : undefined;
  const { read: pageTitleRef } = useFocusOnAnswer<TextHandle>(
    phone && atName?.pane.kind !== 'removing' ? atName : undefined,
  );

  if (organisation != null && !roleHolds(organisation, 'members.manage')) {
    return <Redirect href={DESTINATION_HREF.settings} />;
  }

  const catalogue = load.kind === 'loaded' ? load.catalogue : null;
  const pane: Pane | null =
    opened ??
    (landscape && catalogue != null ? { kind: 'role', id: firstEditable(catalogue) } : null);
  const selected =
    pane == null || pane.kind === 'new' || catalogue == null
      ? null
      : (catalogue.roles.find((role) => role.id === pane.id) ?? null);
  const open = (next: Pane | null, arrives = false) => {
    setShown({ in: organisationId, pane: next });
    setSaved(false);
    setArrival(arrives && next != null ? { pane: next, at: 'name' } : null);
  };
  const paneResolves = pane != null && (pane.kind === 'new' || selected != null);
  const toList = () => open(null);
  // The role landscape opens by itself gives way to the list on a turn until it is used.
  const used = (id: string) =>
    setShown((before) =>
      before.in === organisationId && before.pane != null
        ? before
        : { in: organisationId, pane: { kind: 'role', id } },
    );

  const heading = (
    <View style={styles.heading}>
      {!phone && (
        <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
          {t('rolesScreen.title')}
        </Text>
      )}
      <Text size={tokens.typeBody.size} muted>
        {t('rolesScreen.intro', { name: organisation?.name ?? '' })}
      </Text>
    </View>
  );

  const waiting =
    load.kind === 'loading' ? (
      <View style={cardFrame(kind)}>
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('rolesScreen.loading')}
        </Text>
      </View>
    ) : load.kind === 'failed' ? (
      <View style={styles.stack} accessibilityRole="alert">
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('rolesScreen.failedLoad')}
          announce
        />
        <SecondaryButton
          label={t('rolesScreen.retry')}
          onPress={() => {
            setLoad({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
          testID="roles.retry"
        />
      </View>
    ) : null;

  const newRole = (
    <View style={!phone && styles.start}>
      {phone ? (
        <SecondaryButton
          label={t('rolesScreen.newRole')}
          onPress={() => open({ kind: 'new' }, true)}
          testID="roles.new"
        />
      ) : (
        <PrimaryButton
          label={t('rolesScreen.newRole')}
          onPress={() => open({ kind: 'new' }, true)}
          testID="roles.new"
        />
      )}
    </View>
  );

  const list =
    organisation != null && catalogue != null ? (
      <RoleList
        kind={kind}
        organisation={organisation}
        roles={catalogue.roles}
        open={pane?.kind === 'new' ? null : (pane?.id ?? null)}
        onOpen={(id) => open({ kind: 'role', id }, true)}
      />
    ) : null;

  const replace = (next: RolesCatalogue, role: OrganisationRole) =>
    next.roles.some((one) => one.id === role.id)
      ? { ...next, roles: next.roles.map((one) => (one.id === role.id ? role : one)) }
      : { ...next, roles: [...next.roles, role] };

  const page =
    organisation == null || catalogue == null || !paneResolves ? null : pane.kind === 'removing' &&
      selected != null ? (
      <RemoveRole
        key={`removing-${selected.id}`}
        answer={atName}
        organisation={organisation}
        role={selected}
        roles={catalogue.roles}
        onKeep={() => open({ kind: 'role', id: selected.id })}
        onRemoved={(roles) => {
          const next = { ...catalogue, roles };
          setLoad({ kind: 'loaded', catalogue: next });
          open(null);
          setAttempt((n) => n + 1);
        }}
      />
    ) : (
      <RolePage
        key={pane.kind === 'new' ? 'new' : pane.id}
        kind={kind}
        organisation={organisation}
        catalogue={catalogue}
        role={selected}
        saved={saved}
        answer={kind === 'tabletPortrait' ? atName : undefined}
        savedAnswer={arrived?.at === 'saved' ? arrived : undefined}
        onRemove={() => selected != null && open({ kind: 'removing', id: selected.id }, true)}
        onSaved={(role) => {
          const next: Pane = { kind: 'role', id: role.id };
          setLoad({ kind: 'loaded', catalogue: replace(catalogue, role) });
          setShown({ in: organisationId, pane: next });
          setSaved(true);
          setArrival(pane.kind === 'new' ? { pane: next, at: 'saved' } : null);
        }}
        onEdited={() => setSaved(false)}
        onUsed={() => selected != null && used(selected.id)}
      />
    );
  const inDetail = page != null;

  const pageTitle =
    pane?.kind === 'new' ? t('rolesScreen.newRole') : selected != null ? roleName(t, selected) : '';

  return (
    <AppFrame
      current="settings"
      title={phone ? (inDetail ? pageTitle : t('rolesScreen.title')) : t('settings.title')}
      titleRef={phone && inDetail ? pageTitleRef : undefined}
      back={
        phone
          ? inDetail
            ? { label: t('rolesScreen.title'), onPress: toList }
            : backToSettings(t('settings.title'))
          : undefined
      }
    >
      <SettingsSplit open="roles">
        <Screen
          edges={bodyEdges(kind)}
          scroll={false}
          contentStyle={landscape ? styles.landscape : styles.bare}
        >
          {landscape && (
            <View style={styles.landscapeHead}>
              <View style={styles.fill}>{heading}</View>
              {catalogue != null && newRole}
            </View>
          )}
          <View style={landscape ? styles.split : styles.fill}>
            <View
              style={[
                landscape ? styles.listColumn : styles.fill,
                !landscape && inDetail && styles.behind,
              ]}
            >
              <ScrollColumn style={styles.fill} contentContainerStyle={columnContent}>
                {!landscape && heading}
                {waiting ?? list}
                {!landscape && waiting == null && newRole}
              </ScrollColumn>
            </View>
            <View style={[styles.fill, !landscape && !inDetail && styles.behind]}>
              <ScrollColumn style={styles.fill} contentContainerStyle={columnContent}>
                {!landscape && !phone && (
                  <View style={styles.start}>
                    <QuietButton
                      label={t('settings.rolesBack')}
                      onPress={toList}
                      testID="roles.back"
                    />
                  </View>
                )}
                {page}
              </ScrollColumn>
            </View>
          </View>
        </Screen>
      </SettingsSplit>
    </AppFrame>
  );
}

/** The first role a manager can change opens beside the list, as on the web. */
function firstEditable(catalogue: RolesCatalogue): string {
  return (catalogue.roles.find((role) => !role.fixed) ?? catalogue.roles[0])?.id ?? '';
}

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  bare: { padding: 0, gap: 0 },
  behind: { display: 'none' },
  start: { alignSelf: 'flex-start' },
  stack: { gap: tokens.spaceMd },
  heading: { gap: tokens.spaceXxs },
  phone: {
    gap: 14,
    paddingTop: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    paddingBottom: tokens.space5xl,
  },
  portrait: {
    gap: tokens.spaceLg,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl,
  },
  landscape: {
    gap: 14,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space5xl,
  },
  landscapeHead: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.spaceLg },
  split: { flex: 1, minHeight: 0, flexDirection: 'row', gap: tokens.spaceXl },
  listColumn: { width: LIST_COLUMN },
  columnContent: { gap: tokens.spaceLg, paddingBottom: tokens.space6xl },
});

const CONTENT: Record<Exclude<LayoutKind, 'tabletLandscape'>, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
};
