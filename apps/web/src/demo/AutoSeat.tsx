import { Glyph } from '../components/Glyph.tsx';
import { Ask, TextAction } from '../components/SettingsParts.tsx';
import {
  type AutoSeat,
  AW,
  PROPOSED_AT,
  TRAY_SAID,
  changedWords,
  comingWithout,
  isChanged,
  many,
  proposedGuests,
  proposedParties,
  proposedTables,
  reasonWords,
  say,
  timeOf,
} from './autoSeat.ts';
import { acceptUi, discardUi } from './autoSeatUi.ts';
import { type Item, type Party, SW, YOU, initials, partyTitle, peopleIn } from './seating.ts';
import { useSeating } from './seatingContext.ts';
import { proposedUi } from './seatingSeed.ts';
import './autoSeat.css';

function byLine(auto: AutoSeat): string | null {
  return auto.by == null || auto.at == null
    ? null
    : say(AW.proposedBy, { name: auto.by, time: timeOf(auto.at) });
}

/** sc-4019: Auto-seat by group, at the top of the Seat tab. Without seating.manage it is not there at all. */
export function AutoSeatBlock() {
  const { ui, set } = useSeating();
  const n = comingWithout(ui.tray);
  const tables = proposedTables(ui.plan);
  const guests = proposedGuests(ui.plan);
  const by = byLine(ui.auto);

  if (ui.readOnly) return null;
  return (
    <section className="st-block st-auto" aria-labelledby="st-auto-h">
      <h2 id="st-auto-h" className="st-auto-h">
        {AW.title}
      </h2>
      <button
        type="button"
        className="button st-auto-go"
        disabled={n === 0}
        aria-describedby={n === 0 ? TRAY_SAID : undefined}
        onClick={() => set((now) => ({ ...now, auto: { ...now.auto, asking: true } }))}
      >
        {AW.title}
      </button>
      {by != null && (
        <>
          <p className="st-auto-by">
            <span className="st-auto-dash" aria-hidden="true" />
            {by}
          </p>
          {(tables.length > 0 || ui.auto.left.length > 0) && (
            <div className="st-auto-acts">
              {guests > 0 && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => set((now) => acceptUi(now, null))}
                >
                  {many('acceptAll', guests)}
                </button>
              )}
              <TextAction
                label={AW.discardAll}
                onClick={() => set((now) => discardUi(now, null))}
              />
            </div>
          )}
        </>
      )}
      {ui.auto.asking && (
        <Ask
          title={AW.title}
          line={many('askLine', n)}
          keep={AW.cancel}
          go={AW.propose}
          red={false}
          onKeep={() => set((now) => ({ ...now, auto: { ...now.auto, asking: false } }))}
          onGo={() => set((now) => proposedUi({ ...now, bar: null, undo: null }, YOU, PROPOSED_AT))}
        >
          <p>{AW.askFirst}</p>
          {ui.auto.by != null && (
            <p className="st-auto-replaces">
              {say(AW.replaces, { name: ui.auto.by, time: timeOf(ui.auto.at ?? PROPOSED_AT) })}
            </p>
          )}
        </Ask>
      )}
    </section>
  );
}

function ProposedTable({ item, parties }: { item: Item; parties: readonly Party[] }) {
  const { ui, set } = useSeating();
  const changed = isChanged(item, ui.auto);
  const ids = proposedParties(item);
  const here = ids
    .map((id) => parties.find((party) => party.id === id))
    .filter((party): party is Party => party != null);

  return (
    <li className={changed ? 'st-auto-table is-changed' : 'st-auto-table'}>
      <div className="st-auto-table-head">
        <span className="st-row-name">{item.name}</span>
        <span className="st-row-line">
          {many('guests', item.chairs.filter((chair) => chair.proposed != null).length)}
        </span>
      </div>
      <ul className="st-rows is-dense">
        {here.map((party) => (
          <li key={party.id} className="st-party-line">
            <span className="st-party is-proposed">
              <span className="st-avatar is-proposed" aria-hidden="true">
                {initials(party.name)}
              </span>
              <span className="st-row-words">
                <span className="st-row-name">{partyTitle(party)}</span>
                <span className="st-row-line">
                  {AW.proposed} · {party.group ?? SW.noGroup}
                </span>
              </span>
            </span>
          </li>
        ))}
      </ul>
      {changed ? (
        <>
          <p className="st-auto-changed">
            <Glyph name="warn" size={15} weight={2.2} />
            <span>{changedWords([item])}</span>
          </p>
          <div className="st-auto-acts">
            <TextAction
              label={AW.runAgain}
              onClick={() => set((now) => ({ ...now, auto: { ...now.auto, asking: true } }))}
            />
            <TextAction label={AW.discard} onClick={() => set((now) => discardUi(now, item.id))} />
          </div>
        </>
      ) : (
        <div className="st-auto-acts">
          <button
            type="button"
            className="desk-text"
            aria-label={say(AW.acceptAt, { table: item.name })}
            onClick={() => set((now) => acceptUi(now, [item.id]))}
          >
            {AW.accept}
          </button>
          <button
            type="button"
            className="desk-text"
            aria-label={say(AW.discardAt, { table: item.name })}
            onClick={() => set((now) => discardUi(now, item.id))}
          >
            {AW.discard}
          </button>
        </div>
      )}
    </li>
  );
}

/** Without a seat keeps proposed guests in its count until they are accepted: Proposed · {n} by table, then Left over · {n} with each reason. */
export function AutoSeatTray() {
  const { ui } = useSeating();
  const tables = proposedTables(ui.plan);
  const proposed = proposedGuests(ui.plan);
  const left = ui.auto.left
    .map((one) => ({ one, party: ui.tray.find((party) => party.id === one.party) }))
    .filter(
      (row): row is { one: (typeof ui.auto.left)[number]; party: Party } => row.party != null,
    );
  const leftN = left.reduce((sum, row) => sum + peopleIn(row.party), 0);

  if (tables.length === 0 && left.length === 0) return null;
  return (
    <div className="st-auto-tray">
      {tables.length > 0 && (
        <section aria-labelledby="st-auto-proposed">
          <h3 id="st-auto-proposed" className="st-auto-sub">
            {say(AW.proposedCount, { n: proposed })}
          </h3>
          <ul className="st-auto-tables">
            {tables.map((item) => (
              <ProposedTable key={item.id} item={item} parties={ui.tray} />
            ))}
          </ul>
        </section>
      )}
      {left.length > 0 && (
        <section aria-labelledby="st-auto-left">
          <h3 id="st-auto-left" className="st-auto-sub">
            {say(AW.leftOver, { n: leftN })}
          </h3>
          <ul className="st-rows">
            {left.map(({ one, party }) => (
              <li key={party.id} className="st-auto-left">
                <Glyph name="warn" size={15} weight={2.2} />
                <span className="st-row-words">
                  <span className="st-row-name">{partyTitle(party)}</span>
                  <span className="st-row-line is-amber">
                    {AW.notPlaced} {reasonWords(one.reason, party)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
