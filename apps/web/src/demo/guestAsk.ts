/** sc-1363: when a guest who is not sure yet is asked again, on the guest page's sample (AC, not built). */

import type { Lang } from './guest.ts';
import { addDays } from './today.ts';

export type AskKey = 'week' | 'twoWeeks' | 'weekBefore' | 'beforeClose' | 'never';
export type AskDateKey = Exclude<AskKey, 'never'>;

/** Days as `YYYY-MM-DD` in the event's timezone, by our clock. `replyBy` is null unless Reply by applies (sc-3780, not reopened). */
export interface AskClock {
  today: string;
  start: string;
  replyBy: string | null;
}

export type AskView =
  | {
      kind: 'question';
      pick: AskKey | null;
      saving: boolean;
      error: 'empty' | 'net' | null;
      moved: boolean;
    }
  | { kind: 'saved'; day: string; live: boolean }
  | { kind: 'wont'; live: boolean }
  | { kind: 'closeNow' }
  | { kind: 'none' };

export const QUESTION: Extract<AskView, { kind: 'question' }> = {
  kind: 'question',
  pick: null,
  saving: false,
  error: null,
  moved: false,
};

export function askDay(key: AskDateKey, clock: AskClock): string | null {
  switch (key) {
    case 'week':
      return addDays(clock.today, 7);
    case 'twoWeeks':
      return addDays(clock.today, 14);
    case 'weekBefore':
      return addDays(clock.start, -7);
    case 'beforeClose':
      return clock.replyBy == null ? null : addDays(clock.replyBy, -3);
  }
}

/** Tomorrow or later, at least 3 days before the start, and on or before Reply by when it applies; Don't ask me again with any date. */
export function offer(clock: AskClock): readonly AskKey[] {
  const keys: readonly AskDateKey[] =
    clock.replyBy == null
      ? ['week', 'twoWeeks', 'weekBefore']
      : ['week', 'twoWeeks', 'beforeClose'];
  const earliest = addDays(clock.today, 1);
  const latest = [addDays(clock.start, -3), clock.replyBy]
    .filter((day): day is string => day != null)
    .sort()[0];
  const dates = keys.filter((key) => {
    const day = askDay(key, clock);

    return day != null && day >= earliest && latest != null && day <= latest;
  });

  return dates.length > 0 ? [...dates, 'never'] : [];
}

export function askShown(view: AskView | null, clock: AskClock): boolean {
  if (view == null) return false;
  if (view.kind === 'question') return offer(clock).length > 0;

  return view.kind !== 'none';
}

export function picked(view: AskView, key: AskKey): AskView {
  if (view.kind !== 'question' || view.saving) return view;

  return { ...view, pick: key, error: view.error === 'empty' ? null : view.error };
}

export function saveFirst(view: AskView): AskView {
  if (view.kind !== 'question' || view.saving) return view;
  if (view.pick == null) return { ...view, error: 'empty' };

  return { ...view, saving: true, error: null };
}

export function saveSettled(view: AskView, clock: AskClock): AskView {
  if (view.kind !== 'question' || view.pick == null) return view;
  if (view.pick === 'never') return { kind: 'wont', live: true };
  const day = askDay(view.pick, clock);

  return day == null ? view : { kind: 'saved', day, live: true };
}

/** A failed first Save, as the board's Save Tweak plays it: `net` keeps the choice, `moved` and `close` are the 422, `changed` the 409. */
export type SaveFail = 'net' | 'moved' | 'close' | 'changed';

export const SAVE_FAILS: readonly SaveFail[] = ['net', 'moved', 'close', 'changed'];

export function isSaveFail(value: string | null): value is SaveFail {
  return value != null && (SAVE_FAILS as readonly string[]).includes(value);
}

/** The ask after a failed Save; the 409 drops it, since the answer is no longer Not sure yet. */
export function saveFailed(view: AskView, fail: SaveFail, clock: AskClock): AskView | null {
  if (view.kind !== 'question') return view;
  if (fail === 'changed') return null;
  if (fail === 'net') return { ...view, saving: false, error: 'net' };
  if (fail === 'close' || offer(clock).length === 0) return { kind: 'closeNow' };

  return { ...QUESTION, moved: true };
}

/** Another answer cancels the ask; Not sure yet again keeps it; Not sure yet after another answer asks again (sc-1439). */
export function afterAnswer(
  view: AskView | null,
  was: 'coming' | 'notComing' | 'notSure' | null,
  now: 'coming' | 'notComing' | 'notSure',
): AskView | null {
  if (now !== 'notSure') return null;
  if (was === 'notSure') return view;

  return QUESTION;
}

export const ASK_WORDS: Record<
  Lang,
  Record<
    AskKey | 'q' | 'save' | 'empty' | 'saved' | 'wont' | 'net' | 'moved' | 'close' | 'closeReplyBy',
    string
  >
> = {
  en: {
    q: 'When should we ask you again?',
    week: 'In a week',
    twoWeeks: 'In two weeks',
    weekBefore: 'A week before the event',
    beforeClose: 'Three days before answers close',
    never: 'Don’t ask me again',
    save: 'Save',
    empty: 'Choose when we should ask you, or Don’t ask me again.',
    saved: 'We’ll ask you on {{date}}.',
    wont: 'We won’t ask again.',
    net: 'Not saved. Check your connection and press Save again.',
    moved: 'Not saved. The choices have changed since you opened this page. Choose again.',
    close: 'Not saved. It is now too close to the event to ask you again.',
    closeReplyBy: 'Not saved. Answers close too soon for us to ask you again.',
  },
  es: {
    q: '[¿Cuándo se lo volvemos a preguntar?]',
    week: '[Dentro de una semana]',
    twoWeeks: '[Dentro de dos semanas]',
    weekBefore: '[Una semana antes del evento]',
    beforeClose: '[Tres días antes del cierre de las respuestas]',
    never: '[No me lo vuelvan a preguntar]',
    save: '[Guardar]',
    empty: '[Elija cuándo se lo volvemos a preguntar, o No me lo vuelvan a preguntar.]',
    saved: '[Se lo volveremos a preguntar el {{date}}.]',
    wont: '[No se lo volveremos a preguntar.]',
    net: '[No se ha guardado. Compruebe su conexión y pulse Guardar de nuevo.]',
    moved:
      '[No se ha guardado. Las opciones han cambiado desde que abrió esta página. Elija de nuevo.]',
    close: '[No se ha guardado. Ya falta muy poco para el evento para volver a preguntarle.]',
    closeReplyBy:
      '[No se ha guardado. Las respuestas se cierran demasiado pronto para volver a preguntarle.]',
  },
  fr: {
    q: '[Quand devons-nous vous le redemander ?]',
    week: '[Dans une semaine]',
    twoWeeks: '[Dans deux semaines]',
    weekBefore: '[Une semaine avant l’événement]',
    beforeClose: '[Trois jours avant la clôture des réponses]',
    never: '[Ne plus me le demander]',
    save: '[Enregistrer]',
    empty: '[Choisissez quand nous devons vous le redemander, ou Ne plus me le demander.]',
    saved: '[Nous vous le redemanderons le {{date}}.]',
    wont: '[Nous ne vous le redemanderons pas.]',
    net: '[Non enregistré. Vérifiez votre connexion et appuyez de nouveau sur Enregistrer.]',
    moved:
      '[Non enregistré. Les choix ont changé depuis l’ouverture de cette page. Choisissez de nouveau.]',
    close: '[Non enregistré. L’événement est désormais trop proche pour vous le redemander.]',
    closeReplyBy: '[Non enregistré. Les réponses ferment trop tôt pour vous le redemander.]',
  },
  pt: {
    q: '[Quando lhe devemos voltar a perguntar?]',
    week: '[Daqui a uma semana]',
    twoWeeks: '[Daqui a duas semanas]',
    weekBefore: '[Uma semana antes do evento]',
    beforeClose: '[Três dias antes de as respostas fecharem]',
    never: '[Não voltar a perguntar]',
    save: '[Guardar]',
    empty: '[Escolha quando lhe devemos voltar a perguntar, ou Não voltar a perguntar.]',
    saved: '[Voltamos a perguntar-lhe a {{date}}.]',
    wont: '[Não voltaremos a perguntar.]',
    net: '[Não foi guardado. Verifique a ligação à internet e toque novamente em Guardar.]',
    moved: '[Não foi guardado. As opções mudaram desde que abriu esta página. Escolha novamente.]',
    close: '[Não foi guardado. O evento está agora demasiado próximo para voltarmos a perguntar.]',
    closeReplyBy:
      '[Não foi guardado. As respostas fecham demasiado cedo para lhe voltarmos a perguntar.]',
  },
};
