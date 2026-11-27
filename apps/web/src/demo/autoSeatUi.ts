import {
  AW,
  NO_PROPOSAL,
  accepted,
  changedWords,
  isChanged,
  proposedParties,
  proposedTables,
  say,
  seatedWords,
  withoutProposal,
} from './autoSeat.ts';
import type { Party } from './seating.ts';
import type { Ui } from './seatingSeed.ts';

/** Accept seats every unchanged table asked for and refuses only the changed ones; one Undo reverses all it seated (Decided, 21 Oct). */
export function acceptUi(now: Ui, ids: readonly string[] | null): Ui {
  const tables = proposedTables(now.plan).filter((item) => ids == null || ids.includes(item.id));
  const changed = tables.filter((item) => isChanged(item, now.auto));
  const ok = tables.filter((item) => !isChanged(item, now.auto)).map((item) => item.id);

  if (ok.length === 0) {
    const words = changedWords(changed);

    return { ...now, bar: { kind: 'amber', words }, undo: null, spoken: words };
  }
  const done = accepted(now.plan, now.tray, ok);
  const words = [
    seatedWords(done.guests, ok.length),
    changed.length > 0 ? changedWords(changed) : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    ...now,
    plan: done.plan,
    tray: done.tray,
    auto: {
      ...now.auto,
      stamps: Object.fromEntries(
        Object.entries(now.auto.stamps).filter(([id]) => !ok.includes(id)),
      ),
    },
    undo: { plan: now.plan, tray: now.tray, auto: now.auto },
    bar: { kind: 'undo', words, does: 'undo' },
    save: 'saving',
    spoken: words,
  };
}

/** Discard has no Undo: nothing was seated, and Auto-seat brings the proposal back. */
export function discardUi(now: Ui, id: string | null): Ui {
  const item = now.plan.items.find((one) => one.id === id);
  const words = item == null ? AW.discardedAll : say(AW.discarded, { table: item.name });

  return {
    ...now,
    plan: withoutProposal(now.plan, id ?? undefined),
    auto: id == null ? NO_PROPOSAL : now.auto,
    bar: { kind: 'tint', words },
    undo: null,
    spoken: words,
  };
}

/** The parties in neither list: the rest of Without a seat, as before. */
export function outsideProposal(ui: Pick<Ui, 'plan' | 'auto'>, parties: readonly Party[]): Party[] {
  const inIt = new Set([
    ...ui.plan.items.flatMap((item) => proposedParties(item)),
    ...ui.auto.left.map((one) => one.party),
  ]);

  return parties.filter((party) => !inIt.has(party.id));
}
