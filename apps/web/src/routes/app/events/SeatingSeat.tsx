import type { SeatingPlan } from '@soirely/api-client';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Glyph } from '../../../components/Glyph.tsx';
import { TextAction } from '../../../components/SettingsParts.tsx';
import { sectionOf, usableSeats } from './seatingDraw.ts';
import {
  type TrayFilter,
  type WaitingParty,
  chairStateOf,
  groupOf,
  initialsOf,
  peopleIn,
  shownParties,
  takenAt,
  waitingParties,
} from './seatingGuests.ts';
import { type FloorItem, itemName } from './seatingItems.ts';
import { BackHead, Line, ShapeTile } from './SeatingParts.tsx';
import { rowLine } from './SeatingRows.tsx';
import { SeatLegend, StateMark, chairStateWord, tableLine } from './SeatingTables.tsx';

/** The Seat tab's Without a seat: the switch, the count, search, a chip per group and a row per party (sc-4013). */
export function SeatTray({
  plan,
  filter,
  onFilter,
  picked,
  onPick,
  readOnly,
  chips = true,
}: {
  plan: SeatingPlan;
  filter: TrayFilter;
  onFilter: (filter: TrayFilter) => void;
  picked: string | null;
  onPick: (id: string | null) => void;
  readOnly: boolean;
  chips?: boolean;
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
          {chips && groups.length > 1 && (
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
                        {initialsOf(party.lead.fullName ?? '')}
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

/** A table or row chosen in Seat: its chairs in order with their states in words, and what can be done with everyone at it (sc-4013). */
export function PlaceGuests({
  plan,
  item,
  readOnly,
  movingSeat,
  onPickSeated,
  tray,
  onUnseatAll,
  onMoveAll,
  onRename,
}: {
  plan: SeatingPlan;
  item: Extract<FloorItem, { kind: 'table' | 'row' }>;
  readOnly: boolean;
  movingSeat: number | null;
  onPickSeated: (item: FloorItem, seat: number) => void;
  tray: ReactNode;
  onUnseatAll: (item: FloorItem) => void;
  onMoveAll: (item: FloorItem) => void;
  onRename: (item: FloorItem) => void;
}) {
  const { t } = useTranslation();
  const place = item.one;
  const line = item.kind === 'table' ? tableLine(t, plan, item.one) : rowLine(t, plan, item.one);

  return (
    <div className="st-stack">
      <BackHead title={itemName(t, item)} line={line} />
      {takenAt(plan, place.id) === 0 ? (
        <>
          <Line>{t('seating.emptyTable')}</Line>
          {tray}
        </>
      ) : (
        <>
          <ul className="st-rows is-dense">
            {Array.from({ length: place.seats }, (_, index) => index + 1).map((seat) => {
              const { state, guest } = chairStateOf(
                plan,
                place.id,
                seat,
                place.unusableSeats.includes(seat),
              );

              const words = (
                <>
                  <StateMark
                    state={state}
                    square={item.kind === 'table' && item.one.shape === 'cocktail'}
                  />
                  <span className="st-row-words">
                    <span className="st-row-name">{t('seating.seatN', { n: seat })}</span>
                    <span className="st-row-line">
                      {[
                        chairStateWord(t, state, guest),
                        guest?.reply === 'maybe'
                          ? t('seating.notSureYet')
                          : guest?.reply === 'noReply'
                            ? t('seating.noReply')
                            : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </>
              );
              const on = movingSeat === seat;

              return (
                <li key={seat} className="st-row is-dense">
                  {state === 'taken' && !readOnly ? (
                    <button
                      type="button"
                      className={on ? 'st-party is-seat is-on' : 'st-party is-seat'}
                      aria-pressed={on}
                      onClick={() => onPickSeated(item, seat)}
                    >
                      {words}
                    </button>
                  ) : (
                    words
                  )}
                </li>
              );
            })}
          </ul>
          {!readOnly && (
            <div className="st-acts">
              <TextAction label={t('seating.unseatAll')} onClick={() => onUnseatAll(item)} />
              <TextAction label={t('seating.moveAll')} onClick={() => onMoveAll(item)} />
              <TextAction label={t('seating.rename')} onClick={() => onRename(item)} />
            </div>
          )}
        </>
      )}
      <SeatLegend />
    </div>
  );
}

/** Move everyone to…: only the tables with room for everyone at `from`. */
export function MoveAllPop({
  plan,
  from,
  onMove,
}: {
  plan: SeatingPlan;
  from: FloorItem;
  onMove: (to: Extract<FloorItem, { kind: 'table' }>) => void;
}) {
  const { t } = useTranslation();
  const n = takenAt(plan, from.one.id);
  const room = plan.tables.filter(
    (one) => one.id !== from.one.id && usableSeats(one) - takenAt(plan, one.id) >= n,
  );

  return (
    <div className="st-float st-pop is-move-all" role="dialog" aria-label={t('seating.moveAll')}>
      <h2>{t('seating.moveAll')}</h2>
      <p className="st-line">{t('seating.roomForAll', { count: n })}</p>
      <ul className="st-rows is-dense">
        {room.map((one) => (
          <li key={one.id}>
            <button
              type="button"
              className="st-party"
              onClick={() => onMove({ kind: 'table', one })}
            >
              <ShapeTile glyph={one.shape === 'rectangular' ? 'rect' : one.shape} />
              <span className="st-row-words">
                <span className="st-row-name">{one.name}</span>
                <span className="st-row-line">
                  {t('seating.freeLine', {
                    section: sectionOf(plan, one)?.name ?? t('seating.noSection'),
                    n: usableSeats(one) - takenAt(plan, one.id),
                  })}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
