import { type Membership, primaryEmailAddress } from '@soirely/api-client';
import { initials, roleName, waitingInvitations } from '@soirely/domain';
import { router } from 'expo-router';
import { type ReactNode, createContext, useContext, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { type WaitingInvitations, useWaitingInvitations } from '../invitations.ts';
import { DESTINATIONS, DESTINATION_HREF, type Destination } from '../kit/appNav.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { joinOrganisation, switchOrganisation, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { CreateOrganisation } from './CreateOrganisation.tsx';
import { InvitationRows } from './InvitationRows.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';

const RAIL_WIDTH = 220;

const OpenSwitcher = createContext<(() => void) | undefined>(undefined);

/** Opens the frame's organisation switcher; undefined while there is no organisation and no invitation. */
export function useOpenSwitcher(): (() => void) | undefined {
  return useContext(OpenSwitcher);
}

const ICONS: Record<Destination, readonly [string, string]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5M10 21v-6h4v6'],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
};

/** The edges a signed-in screen's own `Screen` insets: the frame's header, rail and tab bar take the rest. */
export function bodyEdges(kind: LayoutKind): readonly ('top' | 'bottom' | 'left' | 'right')[] {
  if (kind === 'phone') return ['left', 'right'];

  return kind === 'tabletPortrait' ? ['left', 'right', 'bottom'] : ['right', 'bottom'];
}

/** The body keeps its place in the tree on every layout, so a rotation keeps what was typed. */
export function AppFrame({
  current,
  title,
  back,
  children,
}: {
  current: Destination;
  title: string;
  /** On a phone, the page this one was opened from, as Security's "Settings". */
  back?: { label: string; onPress: () => void } | undefined;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const [choosing, setChoosing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const signedIn = useSignedIn();
  const waiting = useWaitingInvitations();
  const count = waitingInvitations(waiting.invitations, waiting.outcomes);
  // It opens with one organisation too, because it ends with "Create an organisation" (sc-390).
  const openSwitcher =
    signedIn.organisation != null || waiting.invitations.length > 0
      ? () => {
          setCreated(null);
          setChoosing(true);
        }
      : undefined;

  return (
    <View style={[styles.root, kind === 'tabletLandscape' && styles.row]}>
      {kind === 'tabletLandscape' && (
        <Rail
          current={current}
          organisation={signedIn.organisation}
          waiting={count}
          onSwitch={openSwitcher}
        />
      )}
      <View style={styles.column}>
        <FrameHeader
          kind={kind}
          current={current}
          title={title}
          back={back}
          email={signedIn.account == null ? '' : (primaryEmailAddress(signedIn.account) ?? '')}
          organisation={signedIn.organisation}
          waiting={count}
          onSwitch={openSwitcher}
        />
        <View style={styles.body}>
          {created != null && (
            <View style={styles.created} accessibilityLiveRegion="polite">
              <Notice
                tone="done"
                mark={tokens.marks.done.glyph}
                body={t('switcher.switched', { name: created })}
              />
            </View>
          )}
          <OpenSwitcher.Provider value={openSwitcher}>{children}</OpenSwitcher.Provider>
        </View>
        {kind === 'phone' && <TabBar current={current} />}
      </View>
      <Switcher
        open={choosing}
        organisations={signedIn.organisations}
        current={signedIn.organisation}
        waiting={waiting}
        onClose={() => setChoosing(false)}
        onCreate={() => {
          setChoosing(false);
          setCreating(true);
        }}
      />
      <CreateOrganisation
        open={creating}
        email={signedIn.account == null ? '' : (primaryEmailAddress(signedIn.account) ?? '')}
        onCancel={() => setCreating(false)}
        onCreated={(organisation) => {
          setCreating(false);
          joinOrganisation(organisation);
          switchOrganisation(organisation.id);
          setCreated(organisation.name);
        }}
      />
    </View>
  );
}

function FrameHeader({
  kind,
  current,
  title,
  back,
  email,
  organisation,
  waiting,
  onSwitch,
}: {
  kind: LayoutKind;
  current: Destination;
  title: string;
  back: { label: string; onPress: () => void } | undefined;
  email: string;
  organisation: Membership | null;
  waiting: number;
  onSwitch: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const top = { paddingTop: insets.top + (kind === 'tabletLandscape' ? 0 : tokens.spaceXxs) };

  if (kind === 'tabletLandscape') {
    return (
      <View style={[styles.header, styles.landscapeHeader, top]}>
        <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.fill} />
        <Text size={tokens.typeBody.size} muted>
          {email}
        </Text>
      </View>
    );
  }

  if (kind === 'tabletPortrait') {
    return (
      <View style={[styles.header, styles.portraitHeader, top]}>
        {organisation != null && (
          <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} />
        )}
        <View style={styles.pills} accessibilityRole="tablist">
          {DESTINATIONS.map((destination) => {
            const on = destination === current;

            return (
              <Pressable
                key={destination}
                style={[styles.pill, on && styles.pillOn]}
                onPress={() => router.navigate(DESTINATION_HREF[destination])}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                testID={`frame.${destination}`}
              >
                <Icon destination={destination} on={on} size={tokens.sizeMark} />
                <Text
                  size={tokens.typeBody.size}
                  weight={on ? 'semibold' : 'medium'}
                  style={on ? styles.ink : styles.secondaryInk}
                >
                  {t(`frame.${destination}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text size={tokens.typeTitlePage.size} weight="bold" accessibilityRole="header">
          {title}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.header, styles.phoneHeader, top]}>
      {current === 'home' && organisation != null && (
        <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} />
      )}
      {back != null && (
        <Pressable
          style={styles.back}
          onPress={back.onPress}
          accessibilityRole="button"
          testID="frame.back"
        >
          <Svg width={tokens.sizeMark} height={tokens.sizeMark} viewBox="0 0 24 24" fill="none">
            <Path d="m15 18-6-6 6-6" {...STROKE} stroke={tokens.colorInk} />
          </Svg>
          <Text size={tokens.typeBodyPhone.size} weight="semibold">
            {back.label}
          </Text>
        </Pressable>
      )}
      <Text
        size={back == null ? tokens.typeTitlePage.size : tokens.typeTitlePhone.size}
        weight="bold"
        accessibilityRole="header"
      >
        {title}
      </Text>
    </View>
  );
}

function TabBar({ current }: { current: Destination }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, tokens.spaceSm) }]}
      accessibilityRole="tablist"
    >
      {DESTINATIONS.map((destination) => {
        const on = destination === current;

        return (
          <Pressable
            key={destination}
            style={styles.tab}
            onPress={() => router.navigate(DESTINATION_HREF[destination])}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            testID={`frame.${destination}`}
          >
            <View style={[styles.tabMark, on && styles.tabMarkOn]} />
            <Icon destination={destination} on={on} size={tokens.space3xl} />
            <Text
              size={tokens.typeMeta.size}
              weight={on ? 'bold' : 'medium'}
              style={on ? styles.ink : styles.secondaryInk}
            >
              {t(`frame.${destination}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Rail({
  current,
  organisation,
  waiting,
  onSwitch,
}: {
  current: Destination;
  organisation: Membership | null;
  waiting: number;
  onSwitch: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { account } = useSignedIn();
  const item = (destination: Destination) => {
    const on = destination === current;

    return (
      <Pressable
        key={destination}
        style={[styles.railItem, on && styles.railItemOn]}
        onPress={() => router.navigate(DESTINATION_HREF[destination])}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        testID={`frame.${destination}`}
      >
        <Icon destination={destination} on={on} size={tokens.sizeMark} />
        <Text
          size={tokens.typeBodyPhone.size}
          weight={on ? 'semibold' : 'medium'}
          style={on ? styles.ink : styles.secondaryInk}
        >
          {t(`frame.${destination}`)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.rail,
        {
          paddingTop: insets.top + tokens.spaceSm,
          paddingBottom: insets.bottom + tokens.space3xl,
          paddingLeft: insets.left + tokens.spaceMd,
        },
      ]}
    >
      <View style={styles.brand}>
        <Text size={tokens.typeTitleDialog.size} weight="bold">
          {t('app.name')}
        </Text>
      </View>
      {organisation != null && (
        <OrgPill organisation={organisation} waiting={waiting} onSwitch={onSwitch} railed />
      )}
      <View style={styles.railGroup}>{DESTINATIONS.filter((d) => d !== 'settings').map(item)}</View>
      <View style={styles.fill} />
      <View style={[styles.railGroup, styles.railFoot]}>
        {item('settings')}
        {account != null && (
          <View style={styles.person}>
            <View style={styles.avatar}>
              <Text size={tokens.typeMeta.size} weight="semibold">
                {initials(account.name)}
              </Text>
            </View>
            <View style={styles.shrink}>
              <Text size={tokens.typeBody.size} weight="semibold" numberOfLines={1}>
                {account.name}
              </Text>
              {organisation != null && (
                <Text size={tokens.typeMeta.size} muted numberOfLines={1}>
                  {roleName(t, organisation.role)}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function OrgPill({
  organisation,
  waiting,
  onSwitch,
  railed = false,
}: {
  organisation: Membership;
  waiting: number;
  onSwitch: (() => void) | undefined;
  railed?: boolean;
}) {
  const { t } = useTranslation();
  const role = roleName(t, organisation.role);
  const label =
    onSwitch == null
      ? t('switcher.label', { name: organisation.name, role })
      : waiting > 0
        ? t('switcher.labelSwitchWaiting', { name: organisation.name, role, count: waiting })
        : t('switcher.labelSwitch', { name: organisation.name, role });

  return (
    <Pressable
      style={[
        styles.org,
        railed ? styles.orgRailed : styles.orgPill,
        waiting > 0 && styles.orgWaiting,
      ]}
      onPress={onSwitch}
      disabled={onSwitch == null}
      accessibilityRole={onSwitch == null ? 'text' : 'button'}
      accessibilityLabel={label}
      testID="frame.organisation"
    >
      <Tile name={organisation.name} />
      <View style={styles.shrink}>
        <Text
          size={railed ? tokens.typeBody.size : tokens.typeBodyPhone.size}
          weight="semibold"
          numberOfLines={1}
        >
          {organisation.name}
        </Text>
        {railed && (
          <Text size={tokens.typeMeta.size} muted>
            {t('frame.organisation')}
          </Text>
        )}
        {waiting > 0 && (
          <View style={styles.waiting}>
            <View style={styles.ring} />
            <Text size={tokens.typeMeta.size} weight="semibold">
              {t('invitations.count', { count: waiting })}
            </Text>
          </View>
        )}
      </View>
      {onSwitch != null && (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="m6 9 6 6 6-6" {...STROKE} stroke={tokens.colorInkSecondary} />
        </Svg>
      )}
    </Pressable>
  );
}

function Tile({ name }: { name: string }) {
  return (
    <View style={styles.tile}>
      <Text size={tokens.typeMeta.size} weight="bold" style={styles.accent}>
        {initials(name)}
      </Text>
    </View>
  );
}

function Switcher({
  open,
  organisations,
  current,
  waiting,
  onClose,
  onCreate,
}: {
  open: boolean;
  organisations: readonly Membership[];
  current: Membership | null;
  waiting: WaitingInvitations;
  onClose: () => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('switcher.close')}>
        <View style={styles.sheetFrame} onStartShouldSetResponder={() => true}>
          <ScrollView contentContainerStyle={styles.sheet}>
            <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
              {t('switcher.heading')}
            </Text>
            {organisations.map((organisation) => {
              const isCurrent = organisation.id === current?.id;

              return (
                <Pressable
                  key={organisation.id}
                  style={[styles.option, isCurrent && styles.optionOn]}
                  onPress={() => {
                    onClose();
                    if (!isCurrent) switchOrganisation(organisation.id);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isCurrent }}
                  testID={`switcher.${organisation.id}`}
                >
                  <Tile name={organisation.name} />
                  <View style={[styles.fill, styles.shrink]}>
                    <Text size={tokens.typeBodyPhone.size} weight="semibold">
                      {organisation.name}
                    </Text>
                    <Text size={tokens.typeBody.size} muted>
                      {t('switcher.yourRole', { role: roleName(t, organisation.role) })}
                    </Text>
                  </View>
                  {isCurrent && (
                    <Text size={tokens.typeBody.size} weight="semibold" style={styles.accent}>
                      {t('switcher.current')}
                    </Text>
                  )}
                </Pressable>
              );
            })}
            {waiting.invitations.length > 0 && (
              <View style={styles.invitations}>
                <Text
                  size={tokens.typeLabel.size}
                  weight="semibold"
                  muted
                  accessibilityRole="header"
                >
                  {t('invitations.heading')}
                </Text>
                <InvitationRows
                  waiting={waiting}
                  onOpen={(id) => {
                    onClose();
                    switchOrganisation(id);
                  }}
                />
              </View>
            )}
            <Text size={tokens.typeBody.size} muted>
              {t('switcher.remembered')}
            </Text>
            {current != null && (
              <Pressable
                style={[styles.option, styles.create]}
                onPress={onCreate}
                accessibilityRole="button"
                testID="switcher.create"
              >
                <View style={[styles.tile, styles.createTile]}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 5v14M5 12h14" {...STROKE} stroke={tokens.colorAccentText} />
                  </Svg>
                </View>
                <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accent}>
                  {t('createOrganisation.row')}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const STROKE = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Icon({ destination, on, size }: { destination: Destination; on: boolean; size: number }) {
  const stroke = on ? tokens.colorInk : tokens.colorInkSecondary;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={ICONS[destination][0]} {...STROKE} stroke={stroke} />
      <Path d={ICONS[destination][1]} {...STROKE} stroke={stroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colorPage },
  row: { flexDirection: 'row' },
  column: { flex: 1, minWidth: 0 },
  body: { flex: 1, minHeight: 0 },
  fill: { flex: 1 },
  shrink: { flexShrink: 1, minWidth: 0 },
  ink: { color: tokens.colorInk },
  secondaryInk: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  header: {
    backgroundColor: tokens.colorHeader,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorHeaderBorder,
  },
  phoneHeader: {
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceXl,
  },
  portraitHeader: {
    gap: tokens.spaceXl,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.spaceXl,
  },
  landscapeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.spaceLg,
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    height: tokens.sizeHit,
    marginLeft: -tokens.spaceXs,
    paddingHorizontal: tokens.spaceXs,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spaceHair,
    marginHorizontal: -tokens.spaceXxs,
  },
  pill: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: tokens.spaceLg,
    paddingRight: tokens.spaceXl,
    borderRadius: tokens.sizeHit / 2,
  },
  pillOn: { backgroundColor: tokens.colorCard },
  tabBar: {
    flexDirection: 'row',
    paddingTop: tokens.spaceXs,
    paddingHorizontal: tokens.spaceSm,
    backgroundColor: tokens.colorCard,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  tab: {
    flex: 1,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceXxs,
  },
  tabMark: {
    width: tokens.space4xl,
    height: 3,
    borderRadius: tokens.spaceHair,
    marginBottom: tokens.spaceHair,
  },
  tabMarkOn: { backgroundColor: tokens.colorInk },
  rail: {
    width: RAIL_WIDTH,
    gap: tokens.spaceXxl,
    paddingRight: tokens.spaceMd,
    backgroundColor: tokens.colorCard,
    borderRightWidth: 1,
    borderRightColor: tokens.colorBorder,
  },
  brand: { height: tokens.sizeHit, justifyContent: 'center', paddingHorizontal: tokens.spaceMd },
  railGroup: { gap: tokens.spaceHair },
  railFoot: {
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  railItem: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusField,
  },
  railItemOn: { backgroundColor: tokens.colorNeutralFill },
  person: {
    minHeight: tokens.sizeHitPhoneHero,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceSm,
  },
  avatar: {
    width: tokens.space5xl,
    height: tokens.space5xl,
    borderRadius: tokens.spaceXl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralFill,
  },
  org: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  orgPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: tokens.sizeHit,
    paddingLeft: tokens.spaceXs,
    paddingRight: 14,
    borderRadius: tokens.sizeHit / 2,
  },
  orgRailed: {
    height: tokens.sizeHitPhoneHero,
    paddingLeft: tokens.spaceXs,
    paddingRight: tokens.spaceMd,
    borderRadius: tokens.radiusField,
  },
  tile: {
    width: tokens.space5xl,
    height: tokens.space5xl,
    borderRadius: tokens.radiusSmall,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
  },
  scrim: {
    flex: 1,
    justifyContent: 'center',
    padding: tokens.spaceXxl,
    backgroundColor: tokens.scrimDialog,
  },
  sheetFrame: {
    flexShrink: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  sheet: {
    gap: tokens.spaceLg,
    padding: tokens.spaceXxl,
  },
  invitations: { gap: tokens.spaceSm },
  orgWaiting: { height: undefined, minHeight: tokens.sizeHit, paddingVertical: tokens.spaceXxs },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  ring: {
    width: tokens.spaceMd,
    height: tokens.spaceMd,
    borderRadius: tokens.spaceMd / 2,
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
  },
  option: {
    minHeight: tokens.sizeHitPhoneHero,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusField,
  },
  optionOn: { backgroundColor: tokens.colorRowSelected },
  create: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder, borderRadius: 0 },
  createTile: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorAccentTintBorder,
    backgroundColor: tokens.colorCard,
  },
  created: { paddingTop: tokens.spaceLg, paddingHorizontal: tokens.spaceXl },
});
