import { initials } from '@soirely/domain';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { OrgPill } from '../components/OrgPill.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { meshFor } from '../mesh.ts';
import { NO_ORG } from './noOrg.ts';
import { OUTSIDE, enterFromSwitcher, inOrder, rowLabel, underWay } from './outsideEvents.ts';
import { EventRowWords } from './OutsideRows.tsx';
import { type Place, currentPlace, openerLabel, switchTo, useWhere, waiting } from './switcher.ts';
import '../components/orgMenu.css';
import '../components/SettingsParts.css';
import './today.css';
import './switcher.css';
import './outsideEvents.css';

const EDGE = 12;

/** The switcher for an account that also holds grants on other organisations' events (sc-68438): its organisations, Events from outside, then invitations and Create. */
export function OutsideSwitcher({ tell, toast }: { tell: Tell; toast: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const where = useWhere();
  const [open, setOpen] = useState(() => {
    const raw = params.get('switcher');

    return raw === 'outside' || raw === 'outside-one-org';
  });
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const current = currentPlace(where);
  const count = waiting(where).length;
  const close = useCallback((back: boolean) => {
    setOpen(false);
    if (back) button.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const drop = menu.current;
    const opener = button.current;
    if (!open || drop == null || opener == null) return;

    const place = (): void => {
      const box = opener.getBoundingClientRect();
      const top = box.bottom + 8;
      const left = Math.max(EDGE, Math.min(box.left, window.innerWidth - EDGE - drop.offsetWidth));
      drop.style.setProperty('top', `${top}px`);
      drop.style.setProperty('left', `${left}px`);
      drop.style.setProperty('max-height', `${Math.max(0, window.innerHeight - top - EDGE)}px`);
    };
    place();
    window.addEventListener('resize', place);

    return () => window.removeEventListener('resize', place);
  }, [open]);

  useEffect(() => {
    const shown = menu.current;
    if (!open || shown == null) return;

    const keys = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }

      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      if (step == null) return;

      event.preventDefault();
      const all = [...shown.querySelectorAll<HTMLElement>('button')];
      const at = all.indexOf(document.activeElement as HTMLElement);
      all[(at + step + all.length) % all.length]?.focus();
    };
    shown.addEventListener('keydown', keys);
    shown.querySelector<HTMLElement>('.sw-cell.is-current, button')?.focus();
    const outside = (event: MouseEvent): void => {
      if (!container.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('mousedown', outside);

    return () => {
      shown.removeEventListener('keydown', keys);
      document.removeEventListener('mousedown', outside);
    };
  }, [open, close]);

  function pick(place: Place): void {
    close(true);
    if (place.id === where.current) return;

    switchTo(place, pathname);
    if (toast) tell(`Now working in ${place.name}.`);
  }

  return (
    <div
      ref={container}
      className="sw"
      onBlur={(event) => {
        const to = event.relatedTarget;
        if (open && to != null && !event.currentTarget.contains(to)) close(false);
      }}
    >
      <OrgPill
        ref={button}
        id={current.id}
        name={current.name}
        label={openerLabel(current, count)}
        waiting={count > 0 ? (count === 1 ? '1 invitation' : `${count} invitations`) : null}
        open={open}
        onClick={() => (open ? close(true) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' || open) return;

          event.preventDefault();
          setOpen(true);
        }}
      />
      {open && (
        <div ref={menu} className="sw-menu" role="dialog" aria-labelledby={`${id}-asks`}>
          <div className="sw-head">
            <h2 id={`${id}-asks`} className="sw-asks">
              {t('switcher.asks')}
            </h2>
          </div>
          <div className="sw-body">
            <div className="sw-grid">
              <div role="group" aria-label={t('switcher.heading')} className="sw-list">
                {where.places.map((place) => {
                  const isCurrent = place.id === where.current;
                  const line = t('switcher.yourRole', { role: place.role });

                  return (
                    <button
                      key={place.id}
                      type="button"
                      className={isCurrent ? 'sw-cell is-current' : 'sw-cell'}
                      aria-current={isCurrent || undefined}
                      aria-label={t(isCurrent ? 'switcher.optionCurrent' : 'switcher.option', {
                        name: place.name,
                        line,
                      })}
                      onClick={() => pick(place)}
                    >
                      <span className="sw-mark" aria-hidden="true">
                        <span className={`sw-tile today-cover is-${meshFor(place.id)}`}>
                          {initials(place.name)}
                        </span>
                        {isCurrent && (
                          <span className="sw-badge is-tick">
                            <Glyph name="tick" size={11} weight={3.2} />
                          </span>
                        )}
                      </span>
                      <span className="sw-name">{place.name}</span>
                      <span className="sw-line">{line}</span>
                      {isCurrent && <span className="sw-current">{t('switcher.current')}</span>}
                    </button>
                  );
                })}
              </div>
              <section className="oe-switch" aria-labelledby={`${id}-outside`}>
                <h3 id={`${id}-outside`} className="oe-heading">
                  {OUTSIDE.fromOutside}
                </h3>
                {inOrder(where.outside).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="oe-row"
                    aria-label={rowLabel(event, { now: underWay(event), here: false })}
                    onClick={() => {
                      enterFromSwitcher(where.outside);
                      void navigate(`/demo/events/${event.id}?state=outside-in`);
                    }}
                  >
                    <EventRowWords event={event} here={false} />
                  </button>
                ))}
              </section>
              <div className="sw-more">
                {where.invitations.map((invitation) => (
                  <button
                    key={invitation.id}
                    type="button"
                    className="sw-cell"
                    aria-label={t('switcher.option', {
                      name: invitation.name,
                      line: t('invitations.fromNobody', { role: invitation.role }),
                    })}
                    onClick={() => tell(OUTSIDE.invitationsLater)}
                  >
                    <span className="sw-mark" aria-hidden="true">
                      <span className="sw-tile is-dashed">{initials(invitation.name)}</span>
                      <span className="sw-badge is-invite">
                        <span className="sw-ring is-small" />
                      </span>
                    </span>
                    <span className="sw-name">{invitation.name}</span>
                    <span className="sw-line is-invite">
                      {t('invitations.fromNobody', { role: invitation.role })}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="sw-cell is-create"
                  onClick={() => tell(NO_ORG.later(t('createOrganisation.row')))}
                >
                  <span className="sw-mark" aria-hidden="true">
                    <span className="sw-tile is-create">
                      <Glyph name="plus" size={20} weight={2.4} />
                    </span>
                  </span>
                  <span className="sw-name">{t('createOrganisation.row')}</span>
                </button>
              </div>
            </div>
            <p className="sw-note">{t('switcher.remembered')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
