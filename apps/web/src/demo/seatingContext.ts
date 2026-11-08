import { createContext, useContext } from 'react';

import type { Item, Plan } from './seating.ts';
import type { Asking, PanelMode, Ui } from './seatingSeed.ts';
import type { Tell } from '../components/SettingsParts.tsx';

/** What the panel, the views and Print can do to the plan; Seating.tsx keeps the one copy of it. */
export interface SeatingApi {
  ui: Ui;
  set: (change: (ui: Ui) => Ui) => void;
  /** A change to the plan, saved as it is made (sc-5028): the save line says Saving… then Saved. Returns the refusal, if any. */
  commit: (id: string | null, change: (plan: Plan) => Plan, after?: Partial<Ui>) => void;
  edit: (id: string, change: Partial<Item>, after?: Partial<Ui>) => void;
  choose: (ids: string[]) => void;
  open: (mode: PanelMode | null) => void;
  ask: (asking: Asking) => void;
  pick: (party: string | null) => void;
  seatAt: (table: string, chair?: number) => void;
  seatJust: (party: string, table: string) => void;
  swap: (table: string, chair: number, party: string) => void;
  unseatAll: (table: string) => void;
  moveAll: (from: string, to: string) => void;
  duplicate: (id: string) => void;
  markChair: (id: string, index: number) => void;
  focusField: (key: string) => void;
  tell: Tell;
}

export const SeatingContext = createContext<SeatingApi | null>(null);

export function useSeating(): SeatingApi {
  const api = useContext(SeatingContext);

  if (api == null) throw new Error('Seating’s parts sit inside its page');
  return api;
}
