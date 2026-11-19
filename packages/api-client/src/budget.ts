/** What a decision costs (sc-86): the API's answer to `POST /api/events/{id}/budget/what-if`, both ends of the range moved. */

export type WhatIfChange = 'guests' | 'tables' | 'staff_hours' | 'days';

export interface Moved {
  from: string;
  to: string;
  delta: string;
}

export interface MovedLine {
  id: string;
  label: string;
  category: string;
  basis: string;
  quantity: {
    confirmed: { from: number; to: number };
    potential: { from: number; to: number };
    reason: string | null;
  };
  /** False for a line with no price yet: its cost is not known, never 0. */
  known: boolean;
  cost: { confirmed: Moved; potential: Moved } | null;
}

export interface WhatIf {
  currency: string;
  confirmed: Moved;
  potential: Moved;
  fullCostKnown: boolean;
  lines: MovedLine[];
}

function asMoved(raw: unknown): Moved | null {
  const one = raw as Record<string, unknown> | null | undefined;

  return one != null &&
    typeof one.from === 'string' &&
    typeof one.to === 'string' &&
    typeof one.delta === 'string'
    ? { from: one.from, to: one.to, delta: one.delta }
    : null;
}

function asCount(raw: unknown): { from: number; to: number } | null {
  const one = raw as Record<string, unknown> | null | undefined;

  return one != null && typeof one.from === 'number' && typeof one.to === 'number'
    ? { from: one.from, to: one.to }
    : null;
}

function asMovedLine(raw: unknown): MovedLine | null {
  const line = raw as Record<string, unknown> | null | undefined;
  const quantity = line?.quantity as Record<string, unknown> | null | undefined;
  const cost = line?.cost as Record<string, unknown> | null | undefined;
  const confirmed = asCount(quantity?.confirmed);
  const potential = asCount(quantity?.potential);
  const costs =
    cost == null
      ? null
      : { confirmed: asMoved(cost.confirmed), potential: asMoved(cost.potential) };

  if (
    line == null ||
    typeof line.id !== 'string' ||
    typeof line.label !== 'string' ||
    typeof line.category !== 'string' ||
    typeof line.basis !== 'string' ||
    typeof line.known !== 'boolean' ||
    confirmed == null ||
    potential == null ||
    (quantity?.reason !== null && typeof quantity?.reason !== 'string') ||
    (costs != null && (costs.confirmed == null || costs.potential == null)) ||
    (costs == null) === line.known
  )
    return null;

  return {
    id: line.id,
    label: line.label,
    category: line.category,
    basis: line.basis,
    quantity: { confirmed, potential, reason: quantity.reason },
    known: line.known,
    cost: costs == null ? null : (costs as MovedLine['cost']),
  };
}

export function asWhatIf(raw: unknown): WhatIf | null {
  const body = raw as Record<string, unknown> | null | undefined;
  const confirmed = asMoved(body?.confirmed);
  const potential = asMoved(body?.potential);
  const lines = Array.isArray(body?.lines) ? body.lines.map(asMovedLine) : null;

  if (
    body == null ||
    typeof body.currency !== 'string' ||
    typeof body.fullCostKnown !== 'boolean' ||
    confirmed == null ||
    potential == null ||
    lines == null ||
    lines.some((line) => line == null)
  )
    return null;

  return {
    currency: body.currency,
    confirmed,
    potential,
    fullCostKnown: body.fullCostKnown,
    lines: lines as MovedLine[],
  };
}
