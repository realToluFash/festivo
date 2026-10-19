import type { Membership } from '@soirely/api-client';
import { initials, roleName, waitingInvitations } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { WaitingInvitations } from '../invitations.ts';
import { InvitationRows } from './InvitationRows.tsx';

export function OrganisationSwitcher({
  current,
  organisations,
  waiting,
  onSwitch,
  onCreate,
}: {
  current: Membership;
  organisations: readonly Membership[];
  waiting: WaitingInvitations;
  onSwitch: (organisation: Membership) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const role = roleName(t, current.role);
  const count = waitingInvitations(waiting.invitations, waiting.outcomes);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent | KeyboardEvent): void => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !container.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);

    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="org-switcher" ref={container}>
      <button
        type="button"
        className="org-switcher-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          count > 0
            ? t('switcher.labelSwitchWaiting', { name: current.name, role, count })
            : t('switcher.labelSwitch', { name: current.name, role })
        }
        onClick={() => setOpen((shown) => !shown)}
      >
        <Tile name={current.name} />
        <Naming name={current.name} role={role} waiting={count} />
        <svg
          className="org-switcher-chevron"
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="org-switcher-menu">
          <p className="org-switcher-heading">{t('switcher.heading')}</p>
          <ul role="listbox" aria-label={t('switcher.heading')}>
            {organisations.map((organisation) => {
              const isCurrent = organisation.id === current.id;

              return (
                <li key={organisation.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    className={
                      isCurrent
                        ? 'org-switcher-option org-switcher-option-current'
                        : 'org-switcher-option'
                    }
                    onClick={() => {
                      setOpen(false);
                      if (!isCurrent) onSwitch(organisation);
                    }}
                  >
                    <Tile name={organisation.name} />
                    <Naming name={organisation.name} role={roleName(t, organisation.role)} />
                    {isCurrent && (
                      <span className="org-switcher-current">
                        <span className="mark mark-done" aria-hidden="true">
                          ✓
                        </span>
                        <span>{t('switcher.current')}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {waiting.invitations.length > 0 && (
            <section
              className="org-switcher-invitations"
              aria-labelledby="org-switcher-invitations"
            >
              <p id="org-switcher-invitations" className="org-switcher-heading">
                {t('invitations.heading')}
              </p>
              <InvitationRows
                waiting={waiting}
                place="menu"
                after={{
                  open: (id) => {
                    const joined = organisations.find((organisation) => organisation.id === id);

                    setOpen(false);
                    if (joined != null) onSwitch(joined);
                  },
                }}
              />
            </section>
          )}
          <p className="org-switcher-note">{t('switcher.remembered')}</p>
          <button
            type="button"
            className="org-switcher-create"
            onClick={() => {
              setOpen(false);
              onCreate();
            }}
          >
            <span className="org-tile org-tile-create" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span>{t('createOrganisation.row')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Tile({ name }: { name: string }) {
  return (
    <span className="org-tile" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function Naming({ name, role, waiting = 0 }: { name: string; role: string; waiting?: number }) {
  const { t } = useTranslation();

  return (
    <span className="org-naming">
      <span className="org-name">{name}</span>
      <span className="org-role">{t('switcher.yourRole', { role })}</span>
      {waiting > 0 && (
        <span className="org-switcher-waiting">
          <span className="org-switcher-ring" aria-hidden="true" />
          <span>{t('invitations.count', { count: waiting })}</span>
        </span>
      )}
    </span>
  );
}
