import {
  ApiError,
  type Membership,
  type OrganisationRole,
  type RoleHolder,
  type RolesCatalogue,
} from '@soirely/api-client';
import {
  HOLDERS_SHOWN,
  LOCALE_CODES,
  MARGIN,
  ROLE_NAME_MAXIMUM,
  extrasOf,
  levelOf,
  lockedAreas,
  replacementsFor,
  roleName,
  roleNameOf,
  roleNameProblem,
  sameGrant,
  settableLevels,
  shownHolders,
  takenRoleNames,
  whatTheySee,
  withExtra,
  withLevel,
  withoutRole,
} from '@soirely/domain';
import { type TFunction, getFixedT } from 'i18next';
import { type ReactNode, type Ref, useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { currentLocale } from '../i18n/index.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { LEVEL_BORDER_ON, LEVEL_PADDING, roomBeside, stacksRows } from '../rowArrangement.ts';
import { tokens } from '../theme/tokens.ts';
import { DestructiveButton, PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { Field, FieldError, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { AnswerHeading } from './AnswerHeading.tsx';
import {
  AboveKeys,
  type DockInset,
  SETTLED_MS,
  useAboveKeyboard,
  useFocusOnAnswer,
} from './Screen.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Text } from './Text.tsx';

/** maxLength counts UTF-16 units, and a letter typed with its accent decomposed is two or more of them. */
const TYPED_MAXIMUM = ROLE_NAME_MAXIMUM * 4;

/** Each switch an area carries beside its level, by its permission. */
const EXTRAS: Record<string, { name: string; means: string; off: string; on: string }> = {
  [MARGIN]: {
    name: 'rolesScreen.margin',
    means: 'rolesScreen.marginMeans',
    off: 'rolesScreen.marginHidden',
    on: 'rolesScreen.marginShown',
  },
  'events.create': {
    name: 'rolesScreen.createEvents',
    means: 'rolesScreen.createEventsMeans',
    off: 'rolesScreen.createEventsOff',
    on: 'rolesScreen.createEventsOn',
  },
};

/** Settings > Roles' list, `Roles-*`: each role, Built in on the five seeded ones only. */
export function RoleList({
  kind,
  organisation,
  roles,
  open,
  opener,
  onOpen,
}: {
  kind: LayoutKind;
  organisation: Membership;
  roles: OrganisationRole[];
  open: string | null;
  /** Each row's ref, for focus to go back to the row whose page was left (sc-11173). */
  opener?: ((key: string) => Ref<ViewInstance>) | undefined;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const landscape = kind === 'tabletLandscape';

  return (
    <View style={[styles.card, landscape ? styles.listDense : styles.list]}>
      {roles.map((role, index) => (
        <Pressable
          key={role.id}
          ref={opener?.(`role.${role.id}`)}
          style={[
            styles.pick,
            landscape && styles.pickDense,
            !landscape && index > 0 && styles.divided,
            landscape && open === role.id && styles.pickOpen,
          ]}
          onPress={() => onOpen(role.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: open === role.id }}
          testID={`roles.role.${role.seededAs ?? role.id}`}
        >
          <View style={styles.fill}>
            <View style={styles.pickName}>
              <Text
                size={landscape ? tokens.typeRowTitle.size : tokens.typeTitleSection.size}
                weight={landscape && open === role.id ? 'semibold' : 'bold'}
                style={landscape && open === role.id ? styles.accent : undefined}
              >
                {roleName(t, role)}
              </Text>
              {role.seededAs != null && (
                <View style={styles.pill}>
                  <Text size={tokens.typePill.size} weight="semibold" muted>
                    {t('rolesScreen.builtIn')}
                  </Text>
                </View>
              )}
            </View>
            {!landscape && (
              <Text size={tokens.typeBody.size} muted>
                {t(describe(role), { name: organisation.name })}
              </Text>
            )}
            <Text size={tokens.typeSmall.size} muted>
              {t('rolesScreen.holders', { count: role.holders })}
            </Text>
          </View>
          <Text
            size={tokens.typeTitleDialog.size}
            muted
            accessibilityElementsHidden
            importantForAccessibility="no"
            accessible={false}
          >
            ›
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A role's grid, or a new one's: Owner's is fixed, and a caller changes only what they hold (sc-66). */
export function RolePage({
  kind,
  organisation,
  catalogue,
  role,
  saved,
  answer,
  savedAnswer,
  removeAnswer,
  onRemove,
  onSaved,
  onEdited,
  onDiscarded,
  onUsed,
}: {
  kind: LayoutKind;
  organisation: Membership;
  catalogue: RolesCatalogue;
  role: OrganisationRole | null;
  saved: boolean;
  /** The tap that opened the page: its name takes screen reader focus. */
  answer?: unknown;
  /** The tap that created the role: "Saved." takes screen reader focus. */
  savedAnswer?: unknown;
  /** Remove role was asked and kept: Remove role takes screen reader focus (sc-11173). */
  removeAnswer?: unknown;
  onRemove: () => void;
  onSaved: (role: OrganisationRole) => void;
  onEdited: () => void;
  /** Discard changes was tapped: on a phone, the title at the top takes focus. */
  onDiscarded?: () => void;
  /** Anything done on the page, a change or a look, so it stays open through a turn. */
  onUsed: () => void;
}) {
  const { t } = useTranslation();
  const phone = kind === 'phone';
  const held = organisation.permissions;
  const creating = role == null;
  const editable = !(role?.fixed ?? false);
  const naming = creating || (editable && role.seededAs == null);
  const startingGrant = role?.permissions ?? [];
  const [discarded, setDiscarded] = useState<object | undefined>(undefined);
  const nameAnswer = phone ? answer : (discarded ?? answer);
  const { read: nameInput } = useFocusOnAnswer<TextInputInstance>(naming ? nameAnswer : undefined);
  const { read: removeButton } = useFocusOnAnswer<ViewInstance>(removeAnswer);
  const { ref: nameAboveKeyboard, onLayout: liftName } = useAboveKeyboard();
  const [nameHeight, setNameHeight] = useState(0);
  const [grant, setGrant] = useState<string[]>(startingGrant);
  const [typed, setTyped] = useState(role?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [status, setStatus] = useState<'editing' | 'saving' | 'failed'>('editing');
  const [rooms, setRooms] = useState<ReadonlyMap<string, number>>(new Map());
  const stacked = phone || stacksRows(rooms.values());
  const measured = useCallback((row: string, room: number | null) => {
    setRooms((before) => {
      if ((before.get(row) ?? null) === room) return before;
      const after = new Map(before);
      if (room == null) after.delete(row);
      else after.set(row, room);

      return after;
    });
  }, []);
  const title = role == null ? '' : roleName(t, role);
  // The API refuses a seeded role's label in every language (sc-2301), whatever the caller reads.
  const everyLanguage = LOCALE_CODES.map((locale) => getFixedT(locale));
  const renamed = !creating && naming && roleNameOf(typed) !== roleNameOf(role.name ?? '');
  const dirty = creating || renamed || !sameGrant(grant, startingGrant);
  const rows = catalogue.areas.map(({ area, permissions }) => {
    const levels = editable ? settableLevels(grant, held, area, permissions) : [];
    const extras = extrasOf(area, permissions).flatMap((permission) => {
      const words = EXTRAS[permission];

      return words == null
        ? []
        : [{ permission, words, locked: editable && !held.includes(permission) }];
    });

    return { area, permissions, levels, extras, locked: editable && levels.length < 2 };
  });
  const lockedLabels = (editable ? lockedAreas(grant, held, catalogue.areas) : []).flatMap(
    (locked) => {
      const label = catalogue.areas.some(({ area }) => area === locked)
        ? `rolesScreen.area.${locked}`
        : EXTRAS[locked]?.name;

      return label == null ? [] : [t(label)];
    },
  );
  const removable = role?.removable === true;

  function change(next: string[]): void {
    setGrant(next);
    setStatus('editing');
    onEdited();
    onUsed();
  }

  function refuseName(message: string): void {
    setNameError(message);
    nameInput.current?.focus();
  }

  async function save(): Promise<void> {
    if (status === 'saving') return;

    if (creating || renamed) {
      const problem = roleNameProblem(
        typed,
        takenRoleNames(catalogue.roles, role?.id, everyLanguage),
      );

      if (problem != null) {
        refuseName(t(`rolesScreen.${problem}`, { most: ROLE_NAME_MAXIMUM }));
        return;
      }
    }

    setStatus('saving');

    try {
      const result = creating
        ? await api.createRole(organisation.id, { name: roleNameOf(typed), permissions: grant })
        : await api.updateRole(
            organisation.id,
            role.id,
            renamed ? { name: roleNameOf(typed), permissions: grant } : { permissions: grant },
          );

      setStatus('editing');
      setTyped(result.name ?? '');
      onSaved(result);
    } catch (error) {
      const refusal = error instanceof ApiError ? error.fieldErrors().name : undefined;

      if (naming && refusal != null) {
        setStatus('editing');
        refuseName(refusal);
        return;
      }

      setStatus('failed');
    }
  }

  const remove = removable && (
    <View style={styles.start}>
      <DestructiveButton
        ref={removeButton}
        label={t('rolesScreen.remove')}
        onPress={onRemove}
        testID="roles.remove"
      />
    </View>
  );
  const savedLine = t('rolesScreen.saved');

  return (
    <View style={styles.stack}>
      <View style={[styles.card, styles.padded, !stacked && styles.head]}>
        <View style={[styles.fill, styles.headText]}>
          {naming ? (
            <View
              ref={nameAboveKeyboard}
              onLayout={(event) => {
                setNameHeight(event.nativeEvent.layout.height);
                liftName();
              }}
            >
              <Field label={t('rolesScreen.nameLabel')} error={nameError}>
                <TextField
                  ref={nameInput}
                  value={typed}
                  maxLength={TYPED_MAXIMUM}
                  wrong={nameError != null}
                  autoCorrect={false}
                  autoComplete="off"
                  accessibilityLabel={t('rolesScreen.nameLabel')}
                  style={styles.nameInput}
                  onFocus={onUsed}
                  onChangeText={(next) => {
                    setTyped(next);
                    setNameError(null);
                    onEdited();
                  }}
                  testID="roles.name"
                />
              </Field>
            </View>
          ) : (
            <AnswerHeading answer={nameAnswer} size={tokens.typeTitleDialog.size} weight="bold">
              {title}
            </AnswerHeading>
          )}
          <Text size={tokens.typeBody.size} muted>
            {t(describe(role), { name: organisation.name })}
          </Text>
        </View>
        {!stacked && remove}
      </View>

      {role?.fixed === true && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          body={t('rolesScreen.ownerNote', { name: organisation.name })}
        />
      )}
      {saved &&
        (savedAnswer !== undefined ? (
          <Notice
            tone="done"
            mark={tokens.marks.done.glyph}
            body={savedLine}
            answer={savedAnswer}
            takesFocus
          />
        ) : (
          <ReadOut words={savedLine}>
            <Notice tone="done" mark={tokens.marks.done.glyph} body={savedLine} />
          </ReadOut>
        ))}
      {lockedLabels.length > 0 && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          body={t('rolesScreen.lockedIntro', {
            count: lockedLabels.length,
            role: roleName(t, organisation.role),
            areas: new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(
              lockedLabels,
            ),
          })}
        />
      )}

      <View style={[styles.card, styles.grid]}>
        <Text size={tokens.typeLabel.size} weight="semibold" muted style={styles.gridHeading}>
          {t('rolesScreen.gridHeading')}
        </Text>
        {rows.map(({ area, permissions, levels, extras, locked }) => {
          const level = levelOf(grant, area);
          const named = t(`rolesScreen.area.${area}`);

          return (
            <View key={area} style={[styles.area, styles.divided]}>
              <GridRow
                phone={phone}
                stacked={stacked}
                onRoom={measured}
                name={named}
                means={t(`rolesScreen.means.${area}`)}
                fixed={editable && !locked ? null : t(`rolesScreen.level.${level}`)}
                options={levels.map((value) => ({
                  value,
                  label: t(`rolesScreen.level.${value}`),
                }))}
                value={level}
                onPick={(value) => change(withLevel(grant, area, value, permissions))}
                testID={`roles.area.${area}`}
              />
              {locked && (
                <Text size={tokens.typeSmall.size} muted>
                  {t('rolesScreen.lockedLine', { area: named })}
                </Text>
              )}
              {level !== 'nothing' &&
                extras.map(({ permission, words, locked: extraLocked }) => (
                  <View key={permission} style={styles.extra}>
                    <GridRow
                      phone={phone}
                      stacked={stacked}
                      onRoom={measured}
                      name={t(words.name)}
                      means={t(words.means, { name: organisation.name })}
                      fixed={
                        editable && !extraLocked
                          ? null
                          : grant.includes(permission)
                            ? t(words.on)
                            : t(words.off)
                      }
                      options={[
                        { value: 'off', label: t(words.off) },
                        { value: 'on', label: t(words.on) },
                      ]}
                      value={grant.includes(permission) ? 'on' : 'off'}
                      onPick={(value) => change(withExtra(grant, permission, value === 'on'))}
                      testID={`roles.extra.${permission}`}
                    />
                    {extraLocked && (
                      <Text size={tokens.typeSmall.size} muted>
                        {t('rolesScreen.lockedLine', { area: t(words.name) })}
                      </Text>
                    )}
                  </View>
                ))}
            </View>
          );
        })}
      </View>

      {status === 'failed' && (
        <View accessibilityRole="alert">
          <FieldError message={t('rolesScreen.failedSave')} />
        </View>
      )}
      {editable && dirty && (
        <Unsaved phone={phone} field={naming ? nameHeight : 0}>
          <View style={styles.unsaved}>
            <Text size={tokens.typeBodyPhone.size}>
              {unsavedLine(t, creating, title, role?.holders ?? 0)}
            </Text>
            <PrimaryButton
              label={
                status === 'saving'
                  ? t('rolesScreen.saving')
                  : creating
                    ? t('rolesScreen.create')
                    : t('rolesScreen.save', { role: title })
              }
              busy={status === 'saving'}
              onPress={() => void save()}
              testID="roles.save"
            />
            {!creating && (
              <SecondaryButton
                label={t('rolesScreen.discard')}
                onPress={() => {
                  setGrant(startingGrant);
                  setTyped(role.name ?? '');
                  setNameError(null);
                  setStatus('editing');
                  setDiscarded({});
                  onDiscarded?.();
                }}
                testID="roles.discard"
              />
            )}
          </View>
        </Unsaved>
      )}

      <View style={[styles.card, styles.padded]}>
        <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
          {t('rolesScreen.whoHeading')}
        </Text>
        <Text size={tokens.typeBodyPhone.size} muted={(role?.holders ?? 0) === 0}>
          {(role?.holders ?? 0) === 0
            ? t('rolesScreen.nobody')
            : t('rolesScreen.holders', { count: role?.holders ?? 0 })}
        </Text>
        {role != null && <Holders holders={role.holderNames} onMore={onUsed} />}
      </View>

      <View style={[styles.card, styles.padded]}>
        <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
          {t('rolesScreen.seeHeading')}
        </Text>
        <WhatTheySee grant={grant} areas={catalogue.areas.map((entry) => entry.area)} />
        {stacked && remove}
      </View>
    </View>
  );
}

function Holders({ holders, onMore }: { holders: readonly RoleHolder[]; onMore: () => void }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const { shown, more } = shownHolders(holders, all);
  const firstRevealed = useRef<ViewInstance>(null);

  useEffect(() => {
    if (!all) return;

    // TalkBack drops a hover sent before the rows it reveals have reached its tree (sc-9950).
    const focus = setTimeout(() => moveScreenReaderFocus(firstRevealed.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, [all]);

  if (holders.length === 0) return null;

  return (
    <View style={styles.holders}>
      {shown.map((holder, index) => (
        <View
          key={index}
          ref={index === HOLDERS_SHOWN ? firstRevealed : undefined}
          style={styles.holder}
          accessible
        >
          <Text size={tokens.typeBodyPhone.size}>{holder.name}</Text>
          {holder.suspended && (
            <Text size={tokens.typeSmall.size} weight="semibold" style={styles.holderWord}>
              {t('membersScreen.state.suspended')}
            </Text>
          )}
        </View>
      ))}
      {more > 0 && (
        <Pressable
          style={styles.moreHolders}
          onPress={() => {
            setAll(true);
            onMore();
          }}
          accessibilityRole="button"
          testID="roles.moreHolders"
        >
          <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accent}>
            {t('rolesScreen.moreHolders', { count: more })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function GridRow<T extends string>({
  phone,
  stacked,
  onRoom,
  name,
  means,
  fixed,
  options,
  value,
  onPick,
  testID,
}: {
  phone: boolean;
  /** Buttons under the name rather than beside it, as on the phone (sc-12226). */
  stacked: boolean;
  /** What the name keeps with the buttons beside it, or null where it has none to keep. */
  onRoom: (row: string, room: number | null) => void;
  name: string;
  means: string;
  /** The level shown as words, where this caller cannot pick one. */
  fixed: string | null;
  options: { value: T; label: string }[];
  value: T;
  onPick: (value: T) => void;
  testID: string;
}) {
  const [row, setRow] = useState(0);
  const [labels, setLabels] = useState<Partial<Record<T, number>>>({});
  const widths = options.flatMap((option) => labels[option.value] ?? []);
  const room =
    fixed == null && row > 0 && widths.length === options.length ? roomBeside(row, widths) : null;

  useEffect(() => onRoom(testID, room), [onRoom, testID, room]);
  useEffect(() => () => onRoom(testID, null), [onRoom, testID]);

  const picker = fixed == null && (
    <View
      style={[styles.levels, stacked ? !phone && styles.levelsWrap : styles.levelsBeside]}
      accessibilityRole="radiogroup"
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          style={[
            styles.level,
            phone && styles.fill,
            stacked && !phone && styles.levelGrow,
            option.value === value && styles.levelOn,
          ]}
          onPress={() => onPick(option.value)}
          accessibilityRole="radio"
          accessibilityState={{ checked: option.value === value }}
          testID={`${testID}.${option.value}`}
        >
          <Text
            size={tokens.typeBody.size}
            weight="semibold"
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              setLabels((before) =>
                before[option.value] === width ? before : { ...before, [option.value]: width },
              );
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <>
      <View style={styles.rowHead} onLayout={(event) => setRow(event.nativeEvent.layout.width)}>
        <View style={[styles.fill, styles.rowText]}>
          <Text size={tokens.typeBodyPhone.size} weight="semibold">
            {name}
          </Text>
          <Text size={tokens.typeSmall.size} muted>
            {means}
          </Text>
        </View>
        {fixed != null && (
          <Text size={tokens.typeBody.size} weight="semibold" testID={`${testID}.fixed`}>
            {fixed}
          </Text>
        )}
        {!stacked && picker}
      </View>
      {stacked && picker}
    </>
  );
}

function WhatTheySee({ grant, areas }: { grant: string[]; areas: string[] }) {
  const { t } = useTranslation();
  const list = new Intl.ListFormat(currentLocale(), { type: 'conjunction' });
  const { hidden, readOnly } = whatTheySee(grant, areas);
  const named = (some: string[]) => list.format(some.map((area) => t(`rolesScreen.area.${area}`)));
  const budget = levelOf(grant, 'budget');

  return (
    <>
      <Text size={tokens.typeBodyPhone.size}>
        {hidden.length > 0
          ? t('rolesScreen.seeHidden', { areas: named(hidden) })
          : t('rolesScreen.seeAllShown')}
      </Text>
      <Text size={tokens.typeBodyPhone.size}>
        {readOnly.length > 0
          ? t('rolesScreen.seeRead', { areas: named(readOnly) })
          : t('rolesScreen.seeAllChange')}
        {budget !== 'nothing' &&
          ` ${grant.includes(MARGIN) ? t('rolesScreen.seeMargin') : t('rolesScreen.seeNoMargin')}`}
      </Text>
      <Text size={tokens.typeSmall.size} muted>
        {t('rolesScreen.seeNote')}
      </Text>
    </>
  );
}

/** Removing a role members hold sends nothing until the role they move to is chosen (sc-66). */
export function RemoveRole({
  answer,
  phone,
  organisation,
  role,
  roles,
  onKeep,
  onRemoved,
}: {
  /** The tap that asked: the title takes screen reader focus. */
  answer?: unknown;
  /** Stacked with the confirming button on top on a phone, and in a row with Keep first on a tablet. */
  phone: boolean;
  organisation: Membership;
  role: OrganisationRole;
  roles: OrganisationRole[];
  onKeep: () => void;
  onRemoved: (roles: OrganisationRole[]) => void;
}) {
  const { t } = useTranslation();
  const firstChoice = useRef<ViewInstance>(null);
  const [replacement, setReplacement] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [refused, setRefused] = useState<object>();
  // TalkBack ignores the hover that moves its focus onto a role scrolled out of sight (sc-11563).
  useFocusOnAnswer(refused, firstChoice);
  const [status, setStatus] = useState<'asking' | 'removing' | 'failed'>('asking');
  const held = organisation.permissions;
  const title = roleName(t, role);
  const choices = replacementsFor(roles, role, held);
  const chosen = choices.find((one) => one.id === replacement);

  async function remove(): Promise<void> {
    if (role.holders > 0 && replacement == null) {
      setMissing(true);
      setRefused({});
      return;
    }

    const moving = role.holders > 0 ? replacement : null;
    setStatus('removing');

    try {
      await api.deleteRole(organisation.id, role.id, moving);
    } catch {
      setStatus('failed');
      return;
    }

    onRemoved(withoutRole(roles, role, moving));
  }

  const confirm = (
    <DestructiveButton
      label={
        role.holders === 0
          ? t('rolesScreen.removeConfirmEmpty', { role: title })
          : t('rolesScreen.removeConfirm', { role: title })
      }
      busy={status === 'removing'}
      onPress={() => void remove()}
      testID="roles.remove.confirm"
    />
  );
  const keep = (
    <QuietButton
      label={t('rolesScreen.keep', { role: title })}
      onPress={onKeep}
      testID="roles.remove.keep"
    />
  );

  return (
    <View style={[styles.card, styles.padded, styles.removing]}>
      <AnswerHeading answer={answer} size={tokens.typeTitleDialog.size} weight="bold">
        {t('rolesScreen.removeTitle', { role: title })}
      </AnswerHeading>
      {role.holders === 0 ? (
        <Text size={tokens.typeBodyPhone.size}>{t('rolesScreen.removeNobody')}</Text>
      ) : (
        <>
          <Text size={tokens.typeBodyPhone.size}>
            {t('rolesScreen.removeMove', { count: role.holders })}
          </Text>
          <View style={styles.choices}>
            {choices.map((one, index) => (
              <Pressable
                key={one.id}
                ref={index === 0 ? firstChoice : undefined}
                style={[styles.choice, replacement === one.id && styles.choiceOn]}
                onPress={() => {
                  setReplacement(one.id);
                  setMissing(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: replacement === one.id }}
                testID={`roles.replacement.${one.seededAs ?? one.id}`}
              >
                <View style={[styles.radio, replacement === one.id && styles.radioOn]}>
                  {replacement === one.id && <View style={styles.radioDot} />}
                </View>
                <View style={[styles.fill, styles.rowText]}>
                  <Text size={tokens.typeBodyPhone.size} weight="semibold">
                    {roleName(t, one)}
                  </Text>
                  <Text size={tokens.typeSmall.size} muted>
                    {t(describe(one), { name: organisation.name })}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          {missing && (
            <View accessibilityRole="alert">
              <FieldError message={t('rolesScreen.removeNoReplacement')} />
            </View>
          )}
          {chosen != null && (
            <Text size={tokens.typeBody.size} muted>
              {t('rolesScreen.removeAfter', { role: roleName(t, chosen) })}
            </Text>
          )}
        </>
      )}
      {status === 'failed' && (
        <View accessibilityRole="alert">
          <FieldError message={t('rolesScreen.failedRemove')} />
        </View>
      )}
      {phone ? (
        <>
          {confirm}
          {keep}
        </>
      ) : (
        <View style={styles.pair}>
          {keep}
          {confirm}
        </View>
      )}
    </View>
  );
}

/** Only Owner's line is a fact about what it holds; only someone who can change roles reaches this page. */
function describe(role: OrganisationRole | null): string {
  if (role == null) return 'rolesScreen.describeNew';
  if (role.fixed) return 'rolesScreen.describeOwner';

  return role.seededAs != null ? 'rolesScreen.describeSeeded' : 'rolesScreen.describeCustom';
}

function unsavedLine(t: TFunction, creating: boolean, title: string, holders: number): string {
  if (creating) return t('rolesScreen.unsavedNew');
  if (holders === 0) return t('rolesScreen.unsavedNobody', { role: title });

  return t('rolesScreen.unsaved', { role: title, count: holders });
}

const DOCKED: DockInset = { horizontal: tokens.spaceLg, vertical: tokens.spaceSm };

/** On the phone the bar rests on the keys while it and the name it saves both fit above them (sc-7099). */
function Unsaved({
  phone,
  field,
  children,
}: {
  phone: boolean;
  field: number;
  children: ReactNode;
}) {
  return phone ? (
    <AboveKeys inset={DOCKED} field={field}>
      {children}
    </AboveKeys>
  ) : (
    children
  );
}

const RADIO = tokens.sizeMark + tokens.spaceHair;

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
  stack: { gap: tokens.spaceLg },
  card: {
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  padded: {
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceXl,
    paddingHorizontal: tokens.spaceLg,
  },
  list: { paddingVertical: tokens.spaceXxs, paddingHorizontal: tokens.spaceLg },
  listDense: { gap: tokens.spaceXxs, padding: tokens.spaceMd },
  divided: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder },
  pick: {
    minHeight: tokens.sizeHit + tokens.spaceXxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceSm,
  },
  pickDense: {
    minHeight: tokens.sizeHit + tokens.spaceXl,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusField,
  },
  pickOpen: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: tokens.spaceHair,
    borderLeftColor: tokens.colorAccent,
    backgroundColor: tokens.colorRowSelected,
  },
  pickName: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  pill: {
    minHeight: tokens.sizePill,
    justifyContent: 'center',
    paddingVertical: tokens.spaceHair,
    paddingHorizontal: tokens.spaceSm,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorNeutralFill,
  },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: tokens.spaceLg },
  headText: { gap: tokens.spaceXs },
  nameInput: { fontSize: tokens.typeTitleSection.size, fontWeight: '700' },
  grid: { paddingVertical: tokens.spaceXs, paddingHorizontal: tokens.spaceLg },
  gridHeading: { paddingTop: tokens.spaceMd, paddingBottom: tokens.spaceSm },
  area: { gap: tokens.spaceSm, paddingVertical: tokens.spaceLg },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  rowText: { gap: tokens.spaceHair },
  levels: { flexDirection: 'row', gap: tokens.spaceXs },
  levelsBeside: { flexShrink: 0 },
  levelsWrap: { flexWrap: 'wrap' },
  level: {
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LEVEL_PADDING,
    paddingVertical: tokens.spaceXs,
    borderRadius: tokens.sizeHit / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  levelGrow: { flexGrow: 1 },
  levelOn: {
    borderWidth: LEVEL_BORDER_ON,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  extra: {
    gap: tokens.spaceSm,
    marginTop: tokens.spaceXxs,
    paddingTop: tokens.spaceMd,
    paddingLeft: tokens.spaceMd,
    borderLeftWidth: tokens.spaceHair,
    borderLeftColor: tokens.colorInsetBorder,
  },
  unsaved: {
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
    backgroundColor: tokens.colorAttentionTint,
  },
  holders: { gap: tokens.spaceXs },
  accent: { color: tokens.colorAccentText },
  holder: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceSm,
  },
  holderWord: { color: tokens.colorInkSecondary },
  moreHolders: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  removing: { gap: tokens.spaceMd },
  pair: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spaceLg,
  },
  choices: { gap: tokens.spaceXs },
  choice: {
    minHeight: tokens.sizeHit + tokens.spaceXl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceXs,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  choiceOn: {
    borderWidth: tokens.spaceHair,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
    borderWidth: tokens.spaceHair,
    borderColor: tokens.colorControlBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorCard,
  },
  radioOn: { borderColor: tokens.colorAccent },
  radioDot: {
    width: tokens.spaceMd,
    height: tokens.spaceMd,
    borderRadius: tokens.spaceMd / 2,
    backgroundColor: tokens.colorAccent,
  },
});
