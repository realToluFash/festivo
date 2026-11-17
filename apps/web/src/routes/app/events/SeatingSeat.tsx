import type { SeatingPlan } from '@soirely/api-client';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Glyph } from '../../../components/Glyph.tsx';
import { Line } from './SeatingParts.tsx';
import {
  type TrayFilter,
  type WaitingParty,
  groupOf,
  peopleIn,
  shownParties,
  waitingParties,
} from './seatingGuests.ts';

function initials(name: string): string {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0]?.toLocaleUpperCase() ?? '')
    .join('');
}

/** The Seat tab's Without a seat: the switch, the count, search, a chip per group and a row per party (sc-4013). */
export function SeatTray({
  plan,
  filter,
  onFilter,
  picked,
  onPick,
  readOnly,
}: {
  plan: SeatingPlan;
  filter: TrayFilter;
  onFilter: (filter: TrayFilter) => void;
  picked: string | null;
  onPick: (id: string | null) => void;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const switchId = useId();
  const headId = useId();
  const parties = waitingParties(plan.guests);
  const coming = parties.filter((party) => party.lead.reply === 'coming');
  const count = coming.reduce((sum, party) => sum + peopleIn(party), 0);
  const unsure = parties
    .filter((party) => party.lead.reply !== 'coming')
    .reduce((sum, party) => sum + peopleIn(party), 0);
  const shown = shownParties(parties, filter);
  const nobodySeated = plan.guests.every((guest) => guest.seat == null);
  const groups = [
    ...new Set(
      parties
        .filter((party) => filter.unsure || party.lead.reply === 'coming')
        .map((party) => groupOf(party) ?? ''),
    ),
  ]
    .map((group) => ({
      group,
      n: parties
        .filter(
          (party) =>
            (filter.unsure || party.lead.reply === 'coming') && (groupOf(party) ?? '') === group,
        )
        .reduce((sum, party) => sum + peopleIn(party), 0),
    }))
    .sort((a, b) => (a.group === '' ? 1 : b.group === '' ? -1 : a.group.localeCompare(b.group)));

  const title = (party: WaitingParty) =>
    party.companions.length > 0
      ? t('seating.partyTitle', {
          name: party.lead.fullName ?? '',
          count: party.companions.length,
        })
      : (party.lead.fullName ?? '');

  return (
    <div className="st-stack is-tray">
      <div className="st-switch-row">
        <span id={switchId}>{t('seating.showUnsure')}</span>
        <button
          type="button"
          role="switch"
          className="st-switch"
          aria-checked={filter.unsure}
          aria-labelledby={switchId}
          onClick={() => onFilter({ ...filter, unsure: !filter.unsure })}
        >
          <span className="st-switch-track" aria-hidden="true">
            <span className="st-switch-knob" />
          </span>
        </button>
      </div>
      <div className="st-tray-head">
        <h2 id={headId}>{t('seating.withoutSeat')}</h2>
        <span className="st-tray-count">{t('seating.trayCount', { n: count })}</span>
      </div>
      {filter.unsure && unsure > 0 && (
        <p className="st-line is-strong">{t('seating.moreUnsure', { count: unsure })}</p>
      )}
      {count === 0 && (!filter.unsure || unsure === 0) ? (
        <Line>{nobodySeated ? t('seating.nobodyComing') : t('seating.everyoneSeated')}</Line>
      ) : (
        <>
          <div className="st-search">
            <Glyph name="search" size={16} weight={2.2} />
            <input
              type="search"
              aria-label={t('seating.searchByName')}
              placeholder={t('seating.searchByName')}
              value={filter.search}
              onChange={(event) => onFilter({ ...filter, search: event.target.value })}
            />
          </div>
          {groups.length > 1 && (
            <div className="st-chips">
              {groups.map(({ group, n }) => (
                <button
                  key={group}
                  type="button"
                  role="checkbox"
                  aria-checked={filter.groups.includes(group)}
                  className={filter.groups.includes(group) ? 'st-chip is-on' : 'st-chip'}
                  onClick={() =>
                    onFilter({
                      ...filter,
                      groups: filter.groups.includes(group)
                        ? filter.groups.filter((one) => one !== group)
                        : [...filter.groups, group],
                    })
                  }
                >
                  {t('seating.groupCount', {
                    group: group === '' ? t('seating.noGroup') : group,
                    n,
                  })}
                </button>
              ))}
            </div>
          )}
          {shown.length === 0 ? (
            <div className="st-stack is-tight">
              <p className="st-strong">{t('seating.noMatch')}</p>
              <div className="st-acts">
                <button
                  type="button"
                  className="desk-text"
                  onClick={() => onFilter({ ...filter, search: '', groups: [] })}
                >
                  {t('seating.clearSearch')}
                </button>
              </div>
            </div>
          ) : (
            <ul className="st-rows" aria-labelledby={headId}>
              {shown.map((party) => {
                const on = picked === party.lead.id;
                const reply =
                  party.lead.reply === 'maybe'
                    ? t('seating.notSureYet')
                    : party.lead.reply === 'noReply'
                      ? t('seating.noReply')
                      : null;

                return (
                  <li key={party.lead.id} className="st-party-line">
                    <button
                      type="button"
                      className={on ? 'st-party is-on' : 'st-party'}
                      aria-pressed={on}
                      disabled={readOnly}
                      onClick={() => onPick(on ? null : party.lead.id)}
                    >
                      <span className="st-avatar" aria-hidden="true">
                        {initials(party.lead.fullName ?? '')}
                      </span>
                      <span className="st-row-words">
                        <span className="st-row-name">{title(party)}</span>
                        <span className="st-row-line">
                          {[groupOf(party) ?? t('seating.noGroup'), reply]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
