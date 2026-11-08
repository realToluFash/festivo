import { useCallback, useEffect } from 'react';

import { useLater } from '../useLater.ts';
import {
  EARLIER,
  HOLD_MS,
  OPEN,
  SEND_MS,
  TODAY,
  type View,
  type Visit,
  sameAnswer,
} from './guest.ts';
import {
  type Field,
  type From,
  type GuestKitchen,
  type Person,
  blankParty,
  changes,
  firstError,
  fromRecord,
  recorded,
  ruledOut,
  saved,
  toggled,
} from './guestKitchen.ts';
import { ALLERGENS, type Access, type Allergen, DIETS, type Diet } from './guestKitchenWords.ts';

type Go = (change: (was: Visit) => Partial<Visit>, want?: string) => void;

export interface GuestKitchenActions {
  open: (from: From) => void;
  allergy: (key: string, code: Allergen) => void;
  diet: (key: string, code: Diet) => void;
  write: (key: string, field: Field, value: string) => void;
  host: (key: string, code: Access, remove: boolean) => void;
  back: () => void;
  next: () => void;
  save: () => void;
  skip: () => void;
  toStep: () => void;
  send: () => void;
}

function checkView(from: From): View {
  return {
    kind: 'check',
    busy: false,
    failed: false,
    refused: false,
    from: from === 'changing' ? 'changing' : 'answer',
  };
}

/** A guest recorded as Coming has a record to come back to: the sample `kitchen_returning` opens on. */
function fresh(from: From, was: Visit): GuestKitchen {
  const record = was.recorded?.answer === 'coming' ? recorded(was.companionsComing, EARLIER) : null;

  return {
    people: record == null ? blankParty(was.companionsComing) : fromRecord(record),
    record,
    tried: false,
    alert: null,
    meals: false,
    refuses: false,
    from,
    saved: false,
  };
}

/** What Send does once it lands: refused by a page out of date (the saved line goes), or saved with the answer. */
export function landed(was: Visit): Partial<Visit> {
  const kitchen = was.kitchen;
  if (kitchen == null || was.view.kind !== 'check') return {};
  const idle: View = { ...was.view, busy: false };
  const focus = (want: string) => ({ want, wantId: was.wantId + 1 });

  if (kitchen.refuses) {
    return { view: idle, kitchen: { ...kitchen, alert: 'refused', saved: false } };
  }
  const record = saved(kitchen, TODAY);
  const kept = { ...kitchen, record, people: fromRecord(record), tried: false, alert: null };
  if (kitchen.from === 'closed') {
    return { view: { kind: 'closed' }, kitchen: { ...kept, saved: true }, ...focus('kitchen') };
  }
  const coming = sameAnswer(was.recorded, 'coming');

  return {
    recorded: coming ? was.recorded : { answer: 'coming', on: TODAY },
    view: { kind: 'recorded', same: coming && !changes(kitchen) },
    kitchen: kept,
    ...focus('greeting'),
  };
}

/** After the date, Save lands on the closed page with the saved line; only the needs are sent (sc-3780). */
export function savedClosed(was: Visit): Partial<Visit> {
  const kitchen = was.kitchen;
  if (kitchen == null || was.view.kind !== 'kitchen') return {};
  const record = saved(kitchen, TODAY);

  return {
    view: { kind: 'closed' },
    kitchen: { ...kitchen, record, people: fromRecord(record), tried: false, saved: true },
    want: 'kitchen',
    wantId: was.wantId + 1,
  };
}

/** Back and Leave it as it is, after the date: the record as it was, and focus back on Update. */
function backToClosed(was: Visit): Partial<Visit> {
  const kitchen = was.kitchen;
  if (kitchen == null) return { view: { kind: 'closed' } };
  const people = kitchen.record == null ? kitchen.people : fromRecord(kitchen.record);

  return { view: { kind: 'closed' }, kitchen: { ...kitchen, people, tried: false, alert: null } };
}

/** sc-3778's step on the guest's page: Yes leads to it, Next to Check and send, Send saves it with the answer. */
export function useGuestKitchen(visit: Visit, state: string | null, go: Go): GuestKitchenActions {
  const later = useLater();
  const land = useCallback(() => go(landed), [go]);

  useEffect(() => {
    if (state !== 'kitchen_sending') return;
    const timer = setTimeout(land, HOLD_MS);

    return () => clearTimeout(timer);
  }, [state, land]);

  const person = (key: string, change: (one: Person) => Partial<Person>, want?: string) =>
    go(
      (was) =>
        was.kitchen == null
          ? {}
          : {
              kitchen: {
                ...was.kitchen,
                people: was.kitchen.people.map((one) =>
                  one.key === key ? { ...one, ...change(one) } : one,
                ),
              },
            },
      want,
    );
  const from = visit.kitchen?.from ?? 'answer';

  return {
    open: (opened) =>
      go(
        (was) => ({
          view: { kind: 'kitchen' },
          kitchen:
            was.kitchen == null
              ? fresh(opened, was)
              : { ...was.kitchen, from: opened, alert: null },
        }),
        'kitchenHead',
      ),
    allergy: (key, code) =>
      person(key, (one) => ({ allergies: toggled(one.allergies, code, ALLERGENS) })),
    diet: (key, code) => person(key, (one) => ({ diet: toggled(one.diet, code, DIETS) })),
    write: (key, field, value) => person(key, () => ({ [field]: value })),
    host: (key, code, remove) =>
      person(
        key,
        (one) => ({
          removed: remove ? [...one.removed, code] : one.removed.filter((each) => each !== code),
        }),
        `${remove ? 'keep' : 'remove'}-${key}-${code}`,
      ),
    back: () =>
      from === 'closed'
        ? go(backToClosed, 'kitchen')
        : go(
            (was) => ({
              view: from === 'changing' ? { kind: 'changing', busy: null } : OPEN,
              kitchen: was.kitchen == null ? null : { ...was.kitchen, alert: null },
            }),
            'row-coming',
          ),
    next: () => {
      if (visit.kitchen == null) return;
      const failing = firstError(visit.kitchen);
      go(
        (was) =>
          was.kitchen == null
            ? {}
            : failing == null
              ? { view: checkView(from), kitchen: { ...was.kitchen, tried: false, alert: null } }
              : { kitchen: { ...was.kitchen, tried: true } },
        failing ?? 'checkHead',
      );
    },
    save: () => {
      if (visit.kitchen == null || visit.view.kind !== 'kitchen' || visit.view.busy === true)
        return;
      const failing = firstError(visit.kitchen);
      if (failing != null) {
        go(
          (was) => (was.kitchen == null ? {} : { kitchen: { ...was.kitchen, tried: true } }),
          failing,
        );
        return;
      }
      go(() => ({ view: { kind: 'kitchen', busy: true } }));
      later(SEND_MS, () => go(savedClosed));
    },
    skip: () =>
      from === 'closed'
        ? go(backToClosed, 'kitchen')
        : go(
            (was) =>
              was.kitchen == null
                ? {}
                : {
                    view: checkView(from),
                    kitchen: {
                      ...was.kitchen,
                      people:
                        was.kitchen.record == null
                          ? blankParty(was.kitchen.people.length - 1)
                          : fromRecord(was.kitchen.record),
                      tried: false,
                      alert: null,
                    },
                  },
            'checkHead',
          ),
    toStep: () =>
      go(
        (was) => ({
          view: { kind: 'kitchen' },
          kitchen: was.kitchen == null ? null : { ...was.kitchen, alert: null },
        }),
        'kitchenHead',
      ),
    send: () => {
      const { kitchen, view } = visit;
      if (kitchen == null || view.kind !== 'check' || view.busy) return;
      const marked = ruledOut(kitchen);
      if (marked != null) {
        go(
          (was) => (was.kitchen == null ? {} : { kitchen: { ...was.kitchen, alert: 'ruled' } }),
          marked,
        );
        return;
      }
      go((was) =>
        was.kitchen == null || was.view.kind !== 'check'
          ? {}
          : { view: { ...was.view, busy: true }, kitchen: { ...was.kitchen, alert: null } },
      );
      later(SEND_MS, land);
    },
  };
}
