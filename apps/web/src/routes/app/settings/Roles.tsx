import {
  ApiError,
  type Membership,
  type OrganisationRole,
  type RolesCatalogue,
} from '@soirely/api-client';
import {
  LOCALE_CODES,
  MARGIN,
  ROLE_NAME_MAXIMUM,
  levelOf,
  roleName,
  roleNameProblem,
  sameGrant,
  settableLevels,
  whatTheySee,
  withLevel,
  withMargin,
} from '@soirely/domain';
import i18next, { type TFunction } from 'i18next';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { SettingsSections } from '../../../components/SettingsSections.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { can, useSession } from '../../../session.ts';
import { Forbidden } from '../Forbidden.tsx';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; catalogue: RolesCatalogue };

/** What the detail pane shows: a role, a role being made, or a role being removed. */
type Pane = { kind: 'role'; id: string } | { kind: 'new' } | { kind: 'removing'; id: string };

export function Roles() {
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const organisationId = organisation?.id;

  useEffect(() => {
    if (organisationId == null) return;
    let current = true;

    api.roles(organisationId).then(
      (catalogue) => current && setLoad({ kind: 'loaded', catalogue }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt]);

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
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p>{t('rolesScreen.failedLoad')}</p>
            <button
              type="button"
              className="button"
              onClick={() => {
                setLoad({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
              {t('rolesScreen.retry')}
            </button>
          </div>
        </div>
      )}
      {load.kind === 'loaded' && (
        <RolesLoaded
          key={organisation.id}
          organisation={organisation}
          catalogue={load.catalogue}
          manages={can(session, 'members.manage')}
          held={organisation.permissions}
          onChange={(catalogue) => setLoad({ kind: 'loaded', catalogue })}
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
  onChange,
}: {
  organisation: Membership;
  catalogue: RolesCatalogue;
  manages: boolean;
  held: string[];
  onChange: (catalogue: RolesCatalogue) => void;
}) {
  const { t } = useTranslation();
  const [pane, setPane] = useState<Pane>(() => ({
    kind: 'role',
    id: (catalogue.roles.find((role) => !role.fixed) ?? catalogue.roles[0])?.id ?? '',
  }));
  const [saved, setSaved] = useState(false);
  // At phone and tablet portrait width a role opens on its own page, with ‹ Roles back to the list.
  const [opened, setOpened] = useState(false);
  const name = (role: OrganisationRole) => roleName(t, role);
  const selected =
    pane.kind === 'new' ? null : (catalogue.roles.find((role) => role.id === pane.id) ?? null);

  function open(next: Pane): void {
    setPane(next);
    setSaved(false);
    setOpened(true);
  }

  return (
    <div className="roles" data-open={opened}>
      <section className="card roles-list" aria-labelledby="roles-title">
        <div className="roles-list-head">
          <h1 id="roles-title">{t('rolesScreen.title')}</h1>
          <p className="muted">{t('rolesScreen.intro', { name: organisation.name })}</p>
          {manages && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => open({ kind: 'new' })}
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
            aria-pressed={pane.kind !== 'new' && pane.id === role.id}
            onClick={() => open({ kind: 'role', id: role.id })}
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
        <button type="button" className="link-button roles-back" onClick={() => setOpened(false)}>
          <span aria-hidden="true">‹ </span>
          {t('rolesScreen.title')}
        </button>
        {pane.kind === 'removing' && selected != null ? (
          <Removing
            organisation={organisation}
            role={selected}
            roles={catalogue.roles}
            held={held}
            onKeep={() => open({ kind: 'role', id: selected.id })}
            onRemoved={(next) => {
              onChange(next);
              open({ kind: 'role', id: next.roles.find((role) => !role.fixed)?.id ?? '' });
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
            }}
            onEdited={() => setSaved(false)}
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
  onRemove,
  onSaved,
  onEdited,
}: {
  organisation: Membership;
  role: OrganisationRole | null;
  catalogue: RolesCatalogue;
  manages: boolean;
  held: string[];
  saved: boolean;
  onRemove: () => void;
  onSaved: (role: OrganisationRole) => void;
  onEdited: () => void;
}) {
  const { t } = useTranslation();
  const creating = role == null;
  const editable = manages && !(role?.fixed ?? false);
  const startingGrant = role?.permissions ?? [];
  const [grant, setGrant] = useState<string[]>(startingGrant);
  const [typed, setTyped] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [status, setStatus] = useState<'editing' | 'saving' | 'failed'>('editing');
  const title = role == null ? '' : roleName(t, role);
  // The API refuses a seeded role's label in every language (sc-2301), whatever the caller reads.
  const everyLanguage = LOCALE_CODES.map((locale) => i18next.getFixedT(locale));
  const dirty = creating || !sameGrant(grant, startingGrant);
  const areas = catalogue.areas.map((entry) => entry.area);
  // A caller changes only what they hold (sc-66): a row with nothing left to pick is locked.
  const rows = catalogue.areas.map(({ area, permissions }) => {
    const levels = editable ? settableLevels(grant, held, area, permissions) : [];

    return { area, permissions, levels, locked: editable && levels.length < 2 };
  });
  const marginLocked = editable && !held.includes(MARGIN);
  const lockedAreas = rows.flatMap(({ area, permissions, locked }) => [
    ...(locked ? [t(`rolesScreen.area.${area}`)] : []),
    ...(marginLocked && grant.includes(`${area}.read`) && permissions.includes(MARGIN)
      ? [t('rolesScreen.margin')]
      : []),
  ]);

  function change(next: string[]): void {
    setGrant(next);
    onEdited();
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status === 'saving') return;

    if (creating) {
      const problem = roleNameProblem(
        typed,
        catalogue.roles.flatMap((one) => everyLanguage.map((word) => roleName(word, one))),
      );

      if (problem != null) {
        setNameError(t(`rolesScreen.${problem}`, { most: ROLE_NAME_MAXIMUM }));
        document.getElementById('role-name')?.focus();
        return;
      }
    }

    setStatus('saving');

    try {
      const result = creating
        ? await api.createRole(organisation.id, { name: typed.trim(), permissions: grant })
        : await api.updateRole(organisation.id, role.id, { permissions: grant });

      setStatus('editing');
      onSaved(result);
    } catch (error) {
      const refusal = error instanceof ApiError ? error.fieldErrors().name : undefined;

      if (creating && refusal != null) {
        setNameError(refusal);
        setStatus('editing');
        document.getElementById('role-name')?.focus();
        return;
      }

      setStatus('failed');
    }
  }

  return (
    <form noValidate onSubmit={(event) => void save(event)}>
      <div className="roles-detail-head">
        <div className="roles-detail-title">
          {creating ? (
            <div className="field">
              <label htmlFor="role-name">{t('rolesScreen.nameLabel')}</label>
              <input
                id="role-name"
                className={nameError == null ? 'input' : 'input input-wrong'}
                type="text"
                value={typed}
                maxLength={ROLE_NAME_MAXIMUM + 10}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={nameError != null}
                aria-describedby={nameError == null ? undefined : 'role-name-error'}
                onChange={(event) => {
                  setTyped(event.target.value);
                  setNameError(null);
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
            <h2 id="role-title">{title}</h2>
          )}
          <p className="muted">
            {t(describe(role, manages), {
              name: organisation.name,
              area: t('rolesScreen.area.members'),
            })}
          </p>
        </div>
        {manages && role?.removable === true && (
          <button type="button" className="button button-danger" onClick={onRemove}>
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
        <div className="notice notice-done" role="status">
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <p className="notice-title">{t('rolesScreen.saved')}</p>
        </div>
      )}

      {lockedAreas.length > 0 && (
        <div className="notice notice-quiet">
          <Padlock />
          <p>
            {t('rolesScreen.lockedIntro', {
              count: lockedAreas.length,
              role: roleName(t, organisation.role),
              areas: new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(
                lockedAreas,
              ),
            })}
          </p>
        </div>
      )}

      <div className="roles-grid-head">
        <span>{t('rolesScreen.gridHeading')}</span>
      </div>
      <ul className="roles-grid">
        {rows.map(({ area, permissions, levels, locked }) => {
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
              {area === 'budget' && level !== 'nothing' && permissions.includes(MARGIN) && (
                <div className="roles-row roles-row-sub">
                  <div className="roles-row-text">
                    <span className="roles-row-name">{t('rolesScreen.margin')}</span>
                    <span className="muted">
                      {t('rolesScreen.marginMeans', { name: organisation.name })}
                    </span>
                  </div>
                  {editable && !marginLocked ? (
                    <Levels
                      label={t('rolesScreen.margin')}
                      options={[
                        { value: 'hidden', label: t('rolesScreen.marginHidden') },
                        { value: 'shown', label: t('rolesScreen.marginShown') },
                      ]}
                      value={grant.includes(MARGIN) ? 'shown' : 'hidden'}
                      onPick={(value) => change(withMargin(grant, value === 'shown'))}
                    />
                  ) : (
                    <span className="roles-fixed">
                      {marginLocked && <Padlock />}
                      {grant.includes(MARGIN)
                        ? t('rolesScreen.marginShown')
                        : t('rolesScreen.marginHidden')}
                    </span>
                  )}
                </div>
              )}
              {area === 'budget' && level !== 'nothing' && marginLocked && (
                <p className="muted roles-locked">
                  {t('rolesScreen.lockedLine', { area: t('rolesScreen.margin') })}
                </p>
              )}
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
              <button type="button" className="button" onClick={() => setGrant(startingGrant)}>
                {t('rolesScreen.discard')}
              </button>
            )}
            <button type="submit" className="button button-primary" disabled={status === 'saving'}>
              {status === 'saving'
                ? t('rolesScreen.saving')
                : creating
                  ? t('rolesScreen.create')
                  : t('rolesScreen.save', { role: title })}
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
        </div>
        <div className="roles-panel">
          <span className="roles-panel-heading">{t('rolesScreen.seeHeading')}</span>
          <WhatTheySee grant={grant} areas={areas} />
        </div>
      </div>
    </form>
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
  onRemoved: (catalogue: RolesCatalogue) => void;
}) {
  const { t } = useTranslation();
  const [replacement, setReplacement] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<'asking' | 'removing' | 'failed'>('asking');
  const title = roleName(t, role);
  const choices = roles.filter(
    (one) => one.id !== role.id && one.permissions.every((permission) => held.includes(permission)),
  );
  const chosen = choices.find((one) => one.id === replacement);

  async function remove(): Promise<void> {
    if (role.holders > 0 && replacement == null) {
      setMissing(true);
      document.querySelector<HTMLInputElement>('input[name="role-replacement"]')?.focus();
      return;
    }

    setStatus('removing');

    try {
      await api.deleteRole(organisation.id, role.id, role.holders > 0 ? replacement : null);
      onRemoved(await api.roles(organisation.id));
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="roles-removing">
      <h2 id="role-title">{t('rolesScreen.removeTitle', { role: title })}</h2>
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
              <label
                key={one.id}
                className="roles-replacement"
                htmlFor={`role-replacement-${one.id}`}
              >
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
                <span className="roles-row-name">{roleName(t, one)}</span>
                <span className="muted roles-replacement-means">
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
        <button
          type="button"
          className="button button-dark"
          disabled={status === 'removing'}
          onClick={() => void remove()}
        >
          {role.holders === 0
            ? t('rolesScreen.removeConfirmEmpty', { role: title })
            : t('rolesScreen.removeConfirm', { role: title })}
        </button>
        <button type="button" className="button" onClick={onKeep}>
          {t('rolesScreen.keep', { role: title })}
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
