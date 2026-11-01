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
  type RoleNameProblem,
  sameGrant,
  settableLevels,
  shownHolders,
  takenRoleNames,
  whatTheySee,
  withExtra,
  withLevel,
  withoutRole,
} from '@soirely/domain';
import i18next, { type TFunction } from 'i18next';
import {
  type FormEvent,
  Fragment,
  type RefCallback,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { BackControl } from '../../../components/BackControl.tsx';
import { api } from '../../../api.ts';
import { SettingsSections } from '../../../components/SettingsSections.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { offButton } from '../../../offButton.ts';
import { can, useSession } from '../../../session.ts';
import { focusStep, useFocusOnceShown, useStepFocus } from '../../../stepFocus.ts';
import { Forbidden } from '../Forbidden.tsx';
import { ArrivalNotice } from '../../../components/PageArrival.tsx';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; retried: boolean }
  | { kind: 'loaded'; catalogue: RolesCatalogue };

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

/** The width at which styles.css shows a role on its own page, in place of the list. */
const ONE_PANE = '(width <= 60rem)';

/** What the detail pane shows: a role, a role being made, or a role being removed. */
type Pane = { kind: 'role'; id: string } | { kind: 'new' } | { kind: 'removing'; id: string };

export function Roles() {
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const organisationId = organisation?.id;
  const retrying = useRef(false);
  const [heading, arriveAtHeading] = useStepFocus();
  const [failedLine, arriveAtFailed] = useStepFocus<HTMLParagraphElement>();

  useEffect(() => {
    if (organisationId == null) return;
    let current = true;

    api.roles(organisationId).then(
      (catalogue) => {
        if (!current) return;
        setLoad({ kind: 'loaded', catalogue });
        if (retrying.current) arriveAtHeading();
        retrying.current = false;
      },
      () => {
        if (!current) return;
        const retried = retrying.current;
        retrying.current = false;
        setLoad({ kind: 'failed', retried });
        if (retried) arriveAtFailed();
      },
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt, arriveAtHeading, arriveAtFailed]);

  if (organisation == null) return null;
  if (!can(session, 'members.read')) return <Forbidden />;

  return (
    <div className="settings settings-wide">
      <SettingsSections />
      {load.kind === 'loading' && (
        <p className="muted" role="status">
          {t('rolesScreen.loading')}
        </p>
      )}
      {load.kind === 'failed' && (
        <ArrivalNotice
          role={load.retried ? undefined : 'alert'}
          line={t('rolesScreen.failedLoad')}
          lineRef={failedLine}
          focusable={load.retried}
          retry={t('rolesScreen.retry')}
          onRetry={() => {
            retrying.current = true;
            setLoad({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
        />
      )}
      {load.kind === 'loaded' && (
        <RolesLoaded
          key={organisation.id}
          organisation={organisation}
          catalogue={load.catalogue}
          manages={can(session, 'members.manage')}
          held={organisation.permissions}
          headingRef={heading}
          onChange={(catalogue) => setLoad({ kind: 'loaded', catalogue })}
          onReload={() => setAttempt((n) => n + 1)}
        />
      )}
    </div>
  );
}

function RolesLoaded({
  organisation,
  catalogue,
  manages,
  held,
  headingRef,
  onChange,
  onReload,
}: {
  organisation: Membership;
  catalogue: RolesCatalogue;
  manages: boolean;
  held: string[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChange: (catalogue: RolesCatalogue) => void;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const [pane, setPane] = useState<Pane>(() => ({
    kind: 'role',
    id: (catalogue.roles.find((role) => !role.fixed) ?? catalogue.roles[0])?.id ?? '',
  }));
  const [saved, setSaved] = useState(false);
  // At phone and tablet portrait width a role opens on its own page, with ‹ Roles back to the list.
  const [opened, setOpened] = useState(false);
  const [roleStartRef, arriveAtRole] = useStepFocus<HTMLElement>();
  const startsRole = useCallback(
    (element: HTMLElement | null) => {
      roleStartRef.current = element;
    },
    [roleStartRef],
  );
  const [savedNotice, arriveAtSaved] = useStepFocus<HTMLDivElement>();
  const land = useFocusOnceShown();
  const listed = useRef<HTMLElement>(null);
  const newRole = useRef<HTMLButtonElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const name = (role: OrganisationRole) => roleName(t, role);
  const selected =
    pane.kind === 'new' ? null : (catalogue.roles.find((role) => role.id === pane.id) ?? null);

  function open(next: Pane): void {
    setPane(next);
    setSaved(false);
    setOpened(true);
  }

  function backToList(): void {
    setOpened(false);
    land(
      () =>
        (pane.kind === 'new'
          ? newRole.current
          : listed.current?.querySelector<HTMLElement>(`[data-role="${pane.id}"]`)) ??
        headingRef.current,
    );
  }

  function pick(next: Pane): void {
    open(next);
    if (window.matchMedia(ONE_PANE).matches) arriveAtRole();
  }

  return (
    <div className="roles" data-open={opened}>
      <section ref={listed} className="card roles-list" aria-labelledby="roles-title">
        <div className="roles-list-head">
          <h1 id="roles-title" ref={headingRef} tabIndex={-1}>
            {t('rolesScreen.title')}
          </h1>
          <p className="muted">{t('rolesScreen.intro', { name: organisation.name })}</p>
          {manages && (
            <button
              ref={newRole}
              type="button"
              className="button button-primary"
              onClick={() => pick({ kind: 'new' })}
            >
              {t('rolesScreen.newRole')}
            </button>
          )}
        </div>
        {catalogue.roles.map((role) => (
          <button
            key={role.id}
            type="button"
            className="roles-pick"
            data-role={role.id}
            title={name(role)}
            aria-pressed={pane.kind !== 'new' && pane.id === role.id}
            onClick={() => pick({ kind: 'role', id: role.id })}
          >
            <span className="roles-pick-text">
              <span className="roles-pick-name">
                <strong>{name(role)}</strong>
                {role.seededAs != null && (
                  <span className="pill-quiet">{t('rolesScreen.builtIn')}</span>
                )}
              </span>
              <span className="muted">{t('rolesScreen.holders', { count: role.holders })}</span>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
      </section>

      <section className="card roles-detail" aria-labelledby="role-title">
        <BackControl className="roles-back" label={t('rolesScreen.title')} onClick={backToList} />
        {pane.kind === 'removing' && selected != null ? (
          <Removing
            organisation={organisation}
            role={selected}
            roles={catalogue.roles}
            held={held}
            onKeep={() => {
              open({ kind: 'role', id: selected.id });
              land(() => removeButton.current);
            }}
            onRemoved={(roles) => {
              onChange({ ...catalogue, roles });
              open({ kind: 'role', id: roles.find((role) => !role.fixed)?.id ?? '' });
              if (window.matchMedia(ONE_PANE).matches) arriveAtRole();
              else land(() => headingRef.current);
              onReload();
            }}
          />
        ) : (
          <Editing
            key={pane.kind === 'new' ? 'new' : pane.id}
            organisation={organisation}
            role={selected}
            catalogue={catalogue}
            manages={manages}
            held={held}
            saved={saved}
            startRef={startsRole}
            savedRef={savedNotice}
            removeRef={removeButton}
            onRemove={() => selected != null && open({ kind: 'removing', id: selected.id })}
            onSaved={(role) => {
              const exists = catalogue.roles.some((one) => one.id === role.id);
              onChange({
                ...catalogue,
                roles: exists
                  ? catalogue.roles.map((one) => (one.id === role.id ? role : one))
                  : [...catalogue.roles, role],
              });
              setPane({ kind: 'role', id: role.id });
              setSaved(true);
              arriveAtSaved();
            }}
            onEdited={() => setSaved(false)}
            onDiscarded={arriveAtRole}
          />
        )}
      </section>
    </div>
  );
}

function Editing({
  organisation,
  role,
  catalogue,
  manages,
  held,
  saved,
  startRef,
  savedRef,
  removeRef,
  onRemove,
  onSaved,
  onEdited,
  onDiscarded,
}: {
  organisation: Membership;
  role: OrganisationRole | null;
  catalogue: RolesCatalogue;
  manages: boolean;
  held: string[];
  saved: boolean;
  /** The role's name, or the field it is typed in: where its own page begins. */
  startRef: RefCallback<HTMLElement>;
  savedRef: RefObject<HTMLDivElement | null>;
  removeRef: RefObject<HTMLButtonElement | null>;
  onRemove: () => void;
  onSaved: (role: OrganisationRole) => void;
  onEdited: () => void;
  onDiscarded: () => void;
}) {
  const { t } = useTranslation();
  const creating = role == null;
  const editable = manages && !(role?.fixed ?? false);
  const naming = creating || (editable && role.seededAs == null);
  const startingGrant = role?.permissions ?? [];
  const [grant, setGrant] = useState<string[]>(startingGrant);
  const [typed, setTyped] = useState(role?.name ?? '');
  // A problem the screen has words for is translated as it shows, so it follows a language change (sc-13151).
  const [nameRefusal, setNameRefusal] = useState<
    { problem: RoleNameProblem } | { words: string } | null
  >(null);
  const nameError =
    nameRefusal == null
      ? null
      : 'problem' in nameRefusal
        ? t(`rolesScreen.${nameRefusal.problem}`, { most: ROLE_NAME_MAXIMUM })
        : nameRefusal.words;
  const [status, setStatus] = useState<'editing' | 'saving' | 'failed'>('editing');
  const title = role == null ? '' : roleName(t, role);
  // The API refuses a seeded role's label in every language (sc-2301), whatever the caller reads.
  const everyLanguage = LOCALE_CODES.map((locale) => i18next.getFixedT(locale));
  const renamed = !creating && naming && roleNameOf(typed) !== roleNameOf(role.name ?? '');
  const dirty = creating || renamed || !sameGrant(grant, startingGrant);
  const areas = catalogue.areas.map((entry) => entry.area);
  // A caller changes only what they hold (sc-66): a row with nothing left to pick is locked.
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

  function change(next: string[]): void {
    setGrant(next);
    onEdited();
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status === 'saving') return;

    if (creating || renamed) {
      const problem = roleNameProblem(
        typed,
        takenRoleNames(catalogue.roles, role?.id, everyLanguage),
      );

      if (problem != null) {
        setNameRefusal({ problem });
        document.getElementById('role-name')?.focus();
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
      const refusal =
        error instanceof ApiError
          ? error.problem.violations?.find((one) => one.propertyPath === 'name')
          : undefined;

      if (naming && refusal != null) {
        setNameRefusal(
          refusal.code === 'role_name_taken'
            ? { problem: 'nameTaken' }
            : { words: refusal.message },
        );
        setStatus('editing');
        document.getElementById('role-name')?.focus();
        return;
      }

      setStatus('failed');
    }
  }

  const saveLabel =
    status === 'saving'
      ? t('rolesScreen.saving')
      : creating
        ? t('rolesScreen.create')
        : t('rolesScreen.save', { role: title });

  return (
    <form noValidate onSubmit={(event) => void save(event)}>
      <div className="roles-detail-head">
        <div className="roles-detail-title">
          {naming ? (
            <div className="field">
              <label htmlFor="role-name">{t('rolesScreen.nameLabel')}</label>
              <input
                ref={startRef}
                id="role-name"
                className={nameError == null ? 'input' : 'input input-wrong'}
                type="text"
                value={typed}
                maxLength={TYPED_MAXIMUM}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={nameError != null}
                aria-describedby={nameError == null ? undefined : 'role-name-error'}
                onChange={(event) => {
                  setTyped(event.target.value);
                  setNameRefusal(null);
                  onEdited();
                }}
              />
              {nameError != null && (
                <div className="field-error" id="role-name-error" role="alert">
                  <span className="mark mark-broken" aria-hidden="true">
                    ✕
                  </span>
                  <p>{nameError}</p>
                </div>
              )}
            </div>
          ) : (
            <h2 id="role-title" ref={startRef} tabIndex={-1}>
              {title}
            </h2>
          )}
          <p className="muted">
            {t(describe(role, manages), {
              name: organisation.name,
              area: t('rolesScreen.area.members'),
            })}
          </p>
        </div>
        {manages && role?.removable === true && (
          <button ref={removeRef} type="button" className="button button-danger" onClick={onRemove}>
            {t('rolesScreen.remove')}
          </button>
        )}
      </div>

      {role?.fixed === true && (
        <div className="notice notice-quiet">
          <span className="mark mark-info" aria-hidden="true">
            i
          </span>
          <p>{t('rolesScreen.ownerNote', { name: organisation.name })}</p>
        </div>
      )}
      {saved && (
        <div className="notice notice-done" ref={savedRef} tabIndex={-1}>
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <p className="notice-title">{t('rolesScreen.saved')}</p>
        </div>
      )}

      {lockedLabels.length > 0 && (
        <div className="notice notice-quiet">
          <Padlock />
          <p>
            {t('rolesScreen.lockedIntro', {
              count: lockedLabels.length,
              role: roleName(t, organisation.role),
              areas: new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(
                lockedLabels,
              ),
            })}
          </p>
        </div>
      )}

      <div className="roles-grid-head">
        <span>{t('rolesScreen.gridHeading')}</span>
      </div>
      <ul className="roles-grid">
        {rows.map(({ area, permissions, levels, extras, locked }) => {
          const level = levelOf(grant, area);

          return (
            <li key={area}>
              <div className="roles-row">
                <div className="roles-row-text">
                  <span className="roles-row-name">{t(`rolesScreen.area.${area}`)}</span>
                  <span className="muted">{t(`rolesScreen.means.${area}`)}</span>
                </div>
                {editable && !locked ? (
                  <Levels
                    label={t(`rolesScreen.area.${area}`)}
                    options={levels.map((value) => ({
                      value,
                      label: t(`rolesScreen.level.${value}`),
                    }))}
                    value={level}
                    onPick={(value) => change(withLevel(grant, area, value, permissions))}
                  />
                ) : (
                  <span className="roles-fixed">
                    {locked && <Padlock />}
                    {t(`rolesScreen.level.${level}`)}
                  </span>
                )}
              </div>
              {locked && (
                <p className="muted roles-locked">
                  {t('rolesScreen.lockedLine', { area: t(`rolesScreen.area.${area}`) })}
                </p>
              )}
              {level !== 'nothing' &&
                extras.map(({ permission, words, locked: extraLocked }) => (
                  <Fragment key={permission}>
                    <div className="roles-row roles-row-sub">
                      <div className="roles-row-text">
                        <span className="roles-row-name">{t(words.name)}</span>
                        <span className="muted">{t(words.means, { name: organisation.name })}</span>
                      </div>
                      {editable && !extraLocked ? (
                        <Levels
                          label={t(words.name)}
                          options={[
                            { value: 'off', label: t(words.off) },
                            { value: 'on', label: t(words.on) },
                          ]}
                          value={grant.includes(permission) ? 'on' : 'off'}
                          onPick={(value) => change(withExtra(grant, permission, value === 'on'))}
                        />
                      ) : (
                        <span className="roles-fixed">
                          {extraLocked && <Padlock />}
                          {grant.includes(permission) ? t(words.on) : t(words.off)}
                        </span>
                      )}
                    </div>
                    {extraLocked && (
                      <p className="muted roles-locked">
                        {t('rolesScreen.lockedLine', { area: t(words.name) })}
                      </p>
                    )}
                  </Fragment>
                ))}
            </li>
          );
        })}
      </ul>

      {status === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{t('rolesScreen.failedSave')}</p>
        </div>
      )}
      {editable && dirty && (
        <div className="notice notice-attention roles-unsaved">
          <p>{unsavedLine(t, creating, title, role?.holders ?? 0)}</p>
          <div className="roles-actions">
            {!creating && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  setGrant(startingGrant);
                  setTyped(role.name ?? '');
                  setNameRefusal(null);
                  onDiscarded();
                }}
              >
                {t('rolesScreen.discard')}
              </button>
            )}
            <button
              type="submit"
              className="button button-primary"
              {...offButton(status === 'saving')}
            >
              <span className="button-label">{saveLabel}</span>
            </button>
          </div>
        </div>
      )}

      <div className="roles-panels">
        <div className="roles-panel">
          <span className="roles-panel-heading">{t('rolesScreen.whoHeading')}</span>
          <p>
            {(role?.holders ?? 0) === 0
              ? t('rolesScreen.nobody')
              : t('rolesScreen.holders', { count: role?.holders ?? 0 })}
          </p>
          {role != null && <Holders holders={role.holderNames} />}
        </div>
        <div className="roles-panel">
          <span className="roles-panel-heading">{t('rolesScreen.seeHeading')}</span>
          <WhatTheySee grant={grant} areas={areas} />
        </div>
      </div>
    </form>
  );
}

function Holders({ holders }: { holders: readonly RoleHolder[] }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const { shown, more } = shownHolders(holders, all);
  const firstRevealed = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (all) firstRevealed.current?.focus();
  }, [all]);

  if (holders.length === 0) return null;

  return (
    <ul className="roles-holders">
      {shown.map((holder, index) => (
        <li
          key={index}
          ref={index === HOLDERS_SHOWN ? firstRevealed : undefined}
          tabIndex={index === HOLDERS_SHOWN ? -1 : undefined}
        >
          {holder.name}
          {holder.suspended && (
            <span className="pill-quiet">{t('membersScreen.state.suspended')}</span>
          )}
        </li>
      ))}
      {more > 0 && (
        <li>
          <button type="button" className="link-button" onClick={() => setAll(true)}>
            {t('rolesScreen.moreHolders', { count: more })}
          </button>
        </li>
      )}
    </ul>
  );
}

function Levels<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onPick: (value: T) => void;
}) {
  return (
    <div className="roles-levels" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="roles-level"
          aria-pressed={option.value === value}
          onClick={() => onPick(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Padlock() {
  return (
    <svg
      className="roles-padlock"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
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
      <p>
        {hidden.length > 0
          ? t('rolesScreen.seeHidden', { areas: named(hidden) })
          : t('rolesScreen.seeAllShown')}
      </p>
      <p>
        {readOnly.length > 0
          ? t('rolesScreen.seeRead', { areas: named(readOnly) })
          : t('rolesScreen.seeAllChange')}
        {budget !== 'nothing' &&
          ` ${grant.includes(MARGIN) ? t('rolesScreen.seeMargin') : t('rolesScreen.seeNoMargin')}`}
      </p>
      <p className="muted">{t('rolesScreen.seeNote')}</p>
    </>
  );
}

function Removing({
  organisation,
  role,
  roles,
  held,
  onKeep,
  onRemoved,
}: {
  organisation: Membership;
  role: OrganisationRole;
  roles: OrganisationRole[];
  held: string[];
  onKeep: () => void;
  onRemoved: (roles: OrganisationRole[]) => void;
}) {
  const { t } = useTranslation();
  const [replacement, setReplacement] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<'asking' | 'removing' | 'failed'>('asking');
  const title = roleName(t, role);
  const choices = replacementsFor(roles, role, held);
  const chosen = choices.find((one) => one.id === replacement);
  const heading = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => focusStep(heading.current), []);

  async function remove(): Promise<void> {
    if (role.holders > 0 && replacement == null) {
      setMissing(true);
      document.querySelector<HTMLInputElement>('input[name="role-replacement"]')?.focus();
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

  const removeLabel =
    role.holders === 0
      ? t('rolesScreen.removeConfirmEmpty', { role: title })
      : t('rolesScreen.removeConfirm', { role: title });
  const keepLabel = t('rolesScreen.keep', { role: title });

  return (
    <div className="roles-removing">
      <h2 id="role-title" ref={heading} tabIndex={-1}>
        {t('rolesScreen.removeTitle', { role: title })}
      </h2>
      {role.holders === 0 ? (
        <p>{t('rolesScreen.removeNobody')}</p>
      ) : (
        <>
          <p>{t('rolesScreen.removeMove', { count: role.holders })}</p>
          <fieldset
            className="roles-replacements"
            aria-describedby={missing ? 'role-replacement-error' : undefined}
          >
            <legend className="visually-hidden">{t('rolesScreen.replacementLegend')}</legend>
            {choices.map((one) => (
              <label key={one.id} className="option-card" htmlFor={`role-replacement-${one.id}`}>
                <input
                  id={`role-replacement-${one.id}`}
                  type="radio"
                  name="role-replacement"
                  checked={replacement === one.id}
                  onChange={() => {
                    setReplacement(one.id);
                    setMissing(false);
                  }}
                />
                <span className="roles-row-name option-card-name">{roleName(t, one)}</span>
                <span className="muted option-card-means">
                  {t(describe(one, true), { name: organisation.name })}
                </span>
              </label>
            ))}
          </fieldset>
          {missing && (
            <div className="field-error" id="role-replacement-error" role="alert">
              <span className="mark mark-broken" aria-hidden="true">
                ✕
              </span>
              <p>{t('rolesScreen.removeNoReplacement')}</p>
            </div>
          )}
          {chosen != null && (
            <p className="muted">{t('rolesScreen.removeAfter', { role: roleName(t, chosen) })}</p>
          )}
        </>
      )}
      {status === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{t('rolesScreen.failedRemove')}</p>
        </div>
      )}
      <div className="roles-actions">
        <button type="button" className="link-button" onClick={onKeep}>
          <span className="button-label">{keepLabel}</span>
        </button>
        <button
          type="button"
          className="button button-danger"
          {...offButton(status === 'removing')}
          onClick={() => void remove()}
        >
          <span className="button-label">{removeLabel}</span>
        </button>
      </div>
    </div>
  );
}

/** Only Owner's line is a fact about what it holds; any other line promises changes only to someone who can make them. */
function describe(role: OrganisationRole | null, manages: boolean): string {
  if (role == null) return 'rolesScreen.describeNew';
  if (role.fixed) return 'rolesScreen.describeOwner';
  if (role.seededAs != null)
    return manages ? 'rolesScreen.describeSeeded' : 'rolesScreen.describeSeededReadOnly';

  return manages ? 'rolesScreen.describeCustom' : 'rolesScreen.describeCustomReadOnly';
}

function unsavedLine(t: TFunction, creating: boolean, title: string, holders: number): string {
  if (creating) return t('rolesScreen.unsavedNew');
  if (holders === 0) return t('rolesScreen.unsavedNobody', { role: title });

  return t('rolesScreen.unsaved', { role: title, count: holders });
}
