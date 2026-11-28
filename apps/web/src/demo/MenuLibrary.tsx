import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { TextAction, TitleRow, type Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { DemoOffline } from './DemoOffline.tsx';
import { EventsShell } from './EventParts.tsx';
import { HintButton } from '../components/HintButton.tsx';
import { Pill } from './GuestsParts.tsx';
import {
  type Variant,
  type VariantAsk,
  type VariantForm,
  type VariantMode,
  addOutcome,
  blankVariant,
  checkVariants,
  firstVariantProblem,
  foldInto,
  hasVariants,
  othersFor,
  removeOutcome,
  removeVariant,
  stayingAfter,
  variantForm,
  variantSaveLabel,
  variantsOf,
  VW,
  waysName,
  withSavedVariants,
} from './dishVariants.ts';
import {
  AddVariantButton,
  NameDescFields,
  RowLine,
  VariantFields,
  VariantInsets,
} from './DishVariants.tsx';
import {
  type Diet,
  type DishAllergen,
  type DishForm,
  type FormErrors,
  type Lang,
  type LibDish,
  type LibraryStart,
  CURRENCIES,
  DESC_MAX,
  DIETS,
  DISH_ALLERGENS,
  LANGS,
  LW,
  NAME_MAX,
  allergenName,
  blankForm,
  checkDish,
  containsLine,
  dietName,
  duplicateLine,
  duplicateOf,
  firstProblem,
  formOf,
  isFailureSaid,
  lengthOf,
  libraryStart,
  noMatchLine,
  savedDish,
  shownDishes,
} from './menuLibrary.ts';
import { SIDEBAR_EVENTS } from './settings.ts';
import { useSwitcherStart } from './switcher.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import './guests.css';
import './menu.css';
import './menuLibrary.css';

/** The organisation's Menu library at a desk (board MenuLibrary, page e32, sc-3901): the list A to Z, and Add dish or Edit docked beside it. */
export function MenuLibraryPage() {
  const [params] = useSearchParams();
  const raw = params.get('state');
  const format = params.get('format');
  const lang: Lang = LANGS.includes(format as Lang) ? (format as Lang) : 'en';
  const noBudget = params.get('budget') === 'no';
  useSwitcherStart();

  return (
    <LibraryAt
      key={`${raw ?? ''}|${lang}|${String(noBudget)}`}
      raw={raw}
      lang={lang}
      noBudget={noBudget}
    />
  );
}

function LibraryAt({ raw, lang, noBudget }: { raw: string | null; lang: Lang; noBudget: boolean }) {
  const [first] = useState(() => libraryStart(raw));

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <TodaySidebar
          events={SIDEBAR_EVENTS}
          tell={tell}
          library={first.access}
          hideLibrary={!first.access}
          inert={covered}
        />
      )}
    >
      {(tell) =>
        first.access ? (
          <Library first={first} lang={lang} budget={first.budget && !noBudget} tell={tell} />
        ) : (
          <NoAccess tell={tell} />
        )
      }
    </EventsShell>
  );
}

function NoAccess({ tell }: { tell: Tell }) {
  return (
    <div className="desk-page">
      <div className="desk-column" role="alert">
        <TitleRow title={LW.forbiddenTitle} bell={<DemoBell tell={tell} />} />
        <p className="desk-line">{LW.forbiddenBody}</p>
        <TextAction label={LW.forbiddenBack} onClick={() => tell('Back to Today.')} />
      </div>
    </div>
  );
}

type Panel =
  | { kind: 'add' }
  | { kind: 'edit'; id: string }
  | { kind: 'gone'; name: string }
  | { kind: 'variants'; id: string; mode: VariantMode; variantId: string | null };

interface VariantState {
  forms: VariantForm[];
  pressed: boolean;
  failing: boolean;
  failed: boolean;
}

function variantForms(
  dish: LibDish,
  mode: VariantMode,
  variantId: string | null,
  lang: Lang,
  currency: string,
  over: readonly Partial<VariantForm>[] = [],
): VariantForm[] {
  const was = variantsOf(dish).find((one) => one.id === variantId);
  const base =
    mode === 'edit' && was != null
      ? [variantForm(was, lang, currency)]
      : mode === 'addFirst'
        ? [blankVariant(currency), blankVariant(currency)]
        : [blankVariant(currency)];

  return base.map((form, at) => ({ ...form, ...over[at] }));
}

/** A state that opens pressed: the duplicate question Save would ask, once nothing else is refused. */
function duplicateAtStart(
  form: DishForm,
  first: LibraryStart,
  was: LibDish | null,
  lang: Lang,
  budget: boolean,
): string | null {
  if (firstProblem(checkDish(form, lang, budget)) != null) return null;
  if (was != null && form.name.trim() === was.name) return null;
  const match = duplicateOf(form.name, first.dishes, was?.id ?? null);

  return match == null ? null : duplicateLine(match);
}

function firstVariantFocus(
  first: LibraryStart,
  vstate: VariantState | null,
  lang: Lang,
  budget: boolean,
): string | null {
  const opened = first.opened;
  if (vstate?.pressed !== true || opened?.kind !== 'variants') return null;
  const dish = first.dishes.find((one) => one.id === opened.id);
  if (dish == null) return null;
  const errors = checkVariants(vstate.forms, {
    where: 'library',
    lang,
    budget,
    others: othersFor(dish, opened.mode, opened.variantId ?? null),
  });

  return firstVariantProblem(errors, vstate.forms);
}

function dishErrors(form: DishForm, dish: LibDish | null, lang: Lang, budget: boolean) {
  if (dish == null || !hasVariants(dish)) return checkDish(form, lang, budget);
  const found = checkDish(form, lang, false);

  return { ...found, contains: null, clashes: [], currency: null, amount: null };
}

interface FormState {
  form: DishForm;
  pressed: boolean;
  asking: string | null;
  failing: boolean;
  failed: boolean;
}

function Library({
  first,
  lang,
  budget,
  tell,
}: {
  first: LibraryStart;
  lang: Lang;
  budget: boolean;
  tell: Tell;
}) {
  const [dishes, setDishes] = useState(first.dishes);
  const [tab, setTab] = useState(first.tab);
  const [q, setQ] = useState(first.q);
  const [diets, setDiets] = useState<readonly Diet[]>(first.diets);
  const [panel, setPanel] = useState<Panel | null>(() => {
    const opened = first.opened;
    if (opened == null) return null;
    if (opened.kind === 'edit') return { kind: 'edit', id: opened.id };
    if (opened.kind === 'variants')
      return {
        kind: 'variants',
        id: opened.id,
        mode: opened.mode,
        variantId: opened.variantId ?? null,
      };

    return opened;
  });
  const [vstate, setVstate] = useState<VariantState | null>(() => {
    const opened = first.opened;
    if (opened?.kind !== 'variants') return null;
    const dish = first.dishes.find((one) => one.id === opened.id) as LibDish;

    return {
      forms: variantForms(
        dish,
        opened.mode,
        opened.variantId ?? null,
        lang,
        first.orgCurrency,
        opened.forms,
      ),
      pressed: opened.press === true,
      failing: first.failedSave,
      failed: false,
    };
  });
  const [variantAsk, setVariantAsk] = useState<{ dishId: string; ask: VariantAsk } | null>(
    first.variantAsk ?? null,
  );
  const [variantLimit, setVariantLimit] = useState<string | null>(first.variantLimit ?? null);
  const [state, setState] = useState<FormState | null>(() => {
    const opened = first.opened;
    if (opened == null || opened.kind === 'gone' || opened.kind === 'variants') return null;
    const was = opened.kind === 'edit' ? first.dishes.find((one) => one.id === opened.id) : null;
    const base = was == null ? blankForm(first.orgCurrency) : formOf(was, lang, first.orgCurrency);

    const form = { ...base, ...opened.form };

    return {
      form,
      pressed: opened.press === true,
      asking:
        opened.press === true ? duplicateAtStart(form, first, was ?? null, lang, budget) : null,
      failing: first.failedSave,
      failed: false,
    };
  });
  const [askDelete, setAskDelete] = useState(first.askDelete);
  const [said, setSaid] = useState(first.said);
  const focusAfter = useRef<string | null>(
    firstVariantFocus(first, vstate, lang, budget) ??
      (state?.pressed === true
        ? (firstProblem(dishErrors(state.form, null, lang, budget)) ??
          (state.asking == null ? null : 'lib-asking'))
        : null),
  );
  const made = useRef(0);
  const manage = first.manage;

  const active = dishes.filter((one) => !one.archived);
  const archived = dishes.filter((one) => one.archived);
  const inTab = tab === 'dishes' ? active : archived;
  const shown = shownDishes(inTab, q, tab === 'dishes' ? diets : []);
  const looking = q.trim() !== '' || (tab === 'dishes' && diets.length > 0);
  const editing =
    panel?.kind === 'edit' ? (dishes.find((one) => one.id === panel.id) ?? null) : null;
  const errors = state?.pressed === true ? dishErrors(state.form, editing, lang, budget) : null;
  const vdish =
    panel?.kind === 'variants' ? (dishes.find((one) => one.id === panel.id) ?? null) : null;
  const verrors =
    vstate != null && vstate.pressed && vdish != null && panel?.kind === 'variants'
      ? checkVariants(vstate.forms, {
          where: 'library',
          lang,
          budget,
          others: othersFor(vdish, panel.mode, panel.variantId),
        })
      : null;

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  function settleVariants() {
    setVariantAsk(null);
    setVariantLimit(null);
  }

  function openVariants(dish: LibDish, mode: VariantMode, variant: Variant | null) {
    settleVariants();
    setAskDelete(null);
    setState(null);
    setPanel({ kind: 'variants', id: dish.id, mode, variantId: variant?.id ?? null });
    setVstate({
      forms: variantForms(dish, mode, variant?.id ?? null, lang, first.orgCurrency),
      pressed: false,
      failing: false,
      failed: false,
    });
    focusAfter.current = 'lib-panel-title';
  }

  function pressAddVariant(dish: LibDish) {
    settleVariants();
    if (addOutcome(dish, false) === 'limit') {
      setVariantLimit(dish.id);
      return;
    }
    openVariants(dish, hasVariants(dish) ? 'add' : 'addFirst', null);
  }

  function saveVariants() {
    if (panel?.kind !== 'variants' || vstate == null || vdish == null) return;
    const how = { where: 'library' as const, lang, budget };
    const found = checkVariants(vstate.forms, {
      ...how,
      others: othersFor(vdish, panel.mode, panel.variantId),
    });
    const problem = firstVariantProblem(found, vstate.forms);
    if (problem != null) {
      setVstate({ ...vstate, pressed: true, failed: false });
      focusAfter.current = problem;
      return;
    }
    if (vstate.failing) {
      setVstate({ ...vstate, pressed: true, failing: false, failed: true });
      focusAfter.current = 'lib-failed';
      return;
    }
    const saved = withSavedVariants(vdish, panel.mode, panel.variantId, vstate.forms, how);
    setDishes((now) => now.map((one) => (one.id === vdish.id ? saved.dish : one)));
    setSaid(saved.said);
    setPanel(null);
    setVstate(null);
    focusAfter.current = 'lib-said';
  }

  function pressRemoveVariant(dish: LibDish, variant: Variant) {
    settleVariants();
    setAskDelete(null);
    const outcome = removeOutcome(dish, variant, 'library');
    if (outcome.kind === 'refused') {
      setVariantAsk({
        dishId: dish.id,
        ask: { variantId: variant.id, kind: 'refused', lines: outcome.lines },
      });
      return;
    }
    setVariantAsk({ dishId: dish.id, ask: { variantId: variant.id, kind: outcome.kind } });
    focusAfter.current = `lib-vask-${variant.id}`;
  }

  function changeVariants(dish: LibDish, next: LibDish, words: string) {
    setDishes((now) => now.map((one) => (one.id === dish.id ? next : one)));
    setVariantAsk(null);
    if (panel?.kind === 'variants' && panel.id === dish.id) {
      setPanel(null);
      setVstate(null);
    }
    setSaid(words);
    focusAfter.current = 'lib-said';
  }

  function foldDish(dish: LibDish, variant: Variant) {
    const staying = stayingAfter(dish, variant);
    if (staying == null) return;
    const folded = foldInto(dish, staying);
    changeVariants(
      dish,
      { ...folded.dish, price: budget ? folded.price : dish.price },
      VW.folded(dish.name, staying.name, budget ? 'library' : null),
    );
  }

  function patch(next: Partial<DishForm>) {
    setState((now) =>
      now == null ? now : { ...now, form: { ...now.form, ...next }, asking: null },
    );
  }

  function openAdd() {
    settleVariants();
    setVstate(null);
    setPanel({ kind: 'add' });
    setState({
      form: blankForm(first.orgCurrency),
      pressed: false,
      asking: null,
      failing: false,
      failed: false,
    });
    setAskDelete(null);
    focusAfter.current = 'lib-panel-title';
  }

  function openEdit(dish: LibDish) {
    settleVariants();
    setVstate(null);
    setPanel({ kind: 'edit', id: dish.id });
    setState({
      form: formOf(dish, lang, first.orgCurrency),
      pressed: false,
      asking: null,
      failing: false,
      failed: false,
    });
    setAskDelete(null);
    focusAfter.current = 'lib-panel-title';
  }

  function close(back?: string) {
    const from =
      panel?.kind === 'edit'
        ? `lib-edit-${panel.id}`
        : panel?.kind === 'variants'
          ? panel.mode === 'edit'
            ? `lib-vedit-${panel.variantId ?? ''}`
            : `lib-addv-${panel.id}`
          : 'lib-add';
    setPanel(null);
    setState(null);
    setVstate(null);
    focusAfter.current = back ?? from;
  }

  function save(anyway = false) {
    if (state == null || panel == null || panel.kind === 'gone' || panel.kind === 'variants')
      return;
    const found = dishErrors(state.form, editing, lang, budget);
    const problem = firstProblem(found);
    if (problem != null) {
      setState({ ...state, pressed: true, asking: null });
      focusAfter.current = problem;
      return;
    }
    const selfId = panel.kind === 'edit' ? panel.id : null;
    const renamed = editing == null || state.form.name.trim() !== editing.name;
    const match = renamed ? duplicateOf(state.form.name, dishes, selfId) : null;
    if (match != null && !anyway) {
      setState({ ...state, pressed: true, asking: duplicateLine(match) });
      focusAfter.current = 'lib-asking';
      return;
    }
    if (state.failing) {
      setState({ ...state, pressed: true, asking: null, failing: false, failed: true });
      focusAfter.current = 'lib-failed';
      return;
    }
    made.current += 1;
    const plain = savedDish(state.form, editing, selfId ?? `d-new-${made.current}`, lang, budget);
    const next =
      editing != null && hasVariants(editing)
        ? {
            ...plain,
            contains: editing.contains,
            diets: editing.diets,
            price: editing.price,
            variants: editing.variants ?? [],
          }
        : { ...plain, ...(editing?.variants == null ? {} : { variants: editing.variants }) };
    setDishes((now) =>
      editing == null ? [...now, next] : now.map((one) => (one.id === next.id ? next : one)),
    );
    setSaid(editing == null ? LW.added(next.name) : LW.saved(next.name));
    setPanel(null);
    setState(null);
    focusAfter.current = 'lib-said';
  }

  function archive(dish: LibDish) {
    setDishes((now) => now.map((one) => (one.id === dish.id ? { ...one, archived: true } : one)));
    setSaid(LW.archivedLine(dish.name));
    focusAfter.current = 'lib-said';
  }

  function restore(dish: LibDish) {
    setDishes((now) => now.map((one) => (one.id === dish.id ? { ...one, archived: false } : one)));
    setSaid(LW.restored(dish.name));
    focusAfter.current = 'lib-said';
  }

  function remove(dish: LibDish) {
    setDishes((now) => now.filter((one) => one.id !== dish.id));
    setAskDelete(null);
    setSaid(LW.deleted(dish.name));
    focusAfter.current = 'lib-said';
  }

  function clearAll() {
    setQ('');
    setDiets([]);
    focusAfter.current = 'lib-find';
  }

  const docked = panel != null;

  return (
    <div className="desk-page lib-page">
      <DemoOffline />
      <TitleRow
        title={LW.title}
        action={
          <span className="lib-top-acts">
            {first.refreshing && (
              <span className="lib-refreshing" role="status">
                <Glyph name="refresh" size={15} weight={2.4} />
                {LW.refreshing}
              </span>
            )}
            {manage && !first.loading && (
              <button
                id="lib-add"
                type="button"
                className="gs-pill is-primary lib-add"
                onClick={openAdd}
              >
                <Glyph name="plus" size={16} weight={2.6} />
                {LW.addDish}
              </button>
            )}
          </span>
        }
        bell={<DemoBell tell={tell} />}
      />
      <p className="lib-sub">{LW.sub}</p>
      {!manage && (
        <p className="mn-lock">
          <Glyph name="lock" size={16} weight={2.2} />
          {LW.lock}
        </p>
      )}
      <p
        id="lib-said"
        className={isFailureSaid(said) ? 'lib-said is-failed' : 'lib-said'}
        role="status"
        tabIndex={-1}
      >
        {said !== '' && (
          <>
            <Glyph name={isFailureSaid(said) ? 'alert' : 'tick'} size={17} weight={2.6} />
            {said}
          </>
        )}
      </p>
      {first.loading ? (
        <Loading />
      ) : dishes.length === 0 ? (
        <Empty manage={manage} onAdd={openAdd} />
      ) : (
        <div className={docked ? 'mn-split lib-split is-docked' : 'mn-split lib-split'}>
          <div className="lib-list">
            <div className="lib-tabs" role="tablist" aria-label={LW.tabs}>
              {(['dishes', 'archived'] as const).map((one) => (
                <button
                  key={one}
                  id={`lib-tab-${one}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === one}
                  aria-controls="lib-tabpanel"
                  className={tab === one ? 'lib-tab is-on' : 'lib-tab'}
                  onClick={() => {
                    setTab(one);
                    setAskDelete(null);
                  }}
                >
                  {one === 'dishes' ? LW.dishes : LW.archived}
                  <span className="lib-tab-count">
                    {one === 'dishes' ? active.length : archived.length}
                  </span>
                </button>
              ))}
            </div>
            <div
              id="lib-tabpanel"
              role="tabpanel"
              aria-labelledby={`lib-tab-${tab}`}
              className="lib-tabpanel"
            >
              <Toolbar
                q={q}
                diets={diets}
                chips={tab === 'dishes'}
                lang={lang}
                onQ={setQ}
                onDiets={setDiets}
              />
              <div className="lib-count-row">
                <p className="lib-count" role="status">
                  {looking ? LW.countOf(shown.length, inTab.length) : LW.count(inTab.length)}
                </p>
                {looking && (
                  <button type="button" className="desk-text" onClick={clearAll}>
                    {LW.clearAll}
                  </button>
                )}
              </div>
              {inTab.length === 0 ? (
                <p className="lib-none">{tab === 'archived' ? LW.noArchived : LW.emptyTitle}</p>
              ) : shown.length === 0 ? (
                <div className="lib-nomatch">
                  <p>{noMatchLine(q, tab === 'dishes' ? diets : [])}</p>
                  <button type="button" className="desk-text" onClick={clearAll}>
                    {LW.clearAll}
                  </button>
                </div>
              ) : (
                <ul className="lib-rows">
                  {shown.map((dish) => (
                    <DishRow
                      key={dish.id}
                      dish={dish}
                      lang={lang}
                      manage={manage}
                      lit={editing?.id === dish.id}
                      asking={askDelete === dish.id}
                      onEdit={() => openEdit(dish)}
                      onArchive={() => archive(dish)}
                      onRestore={() => restore(dish)}
                      onAskDelete={() => {
                        setAskDelete(dish.id);
                        focusAfter.current = `lib-ask-${dish.id}`;
                      }}
                      onKeep={() => {
                        setAskDelete(null);
                        focusAfter.current = `lib-delete-${dish.id}`;
                      }}
                      onDelete={() => remove(dish)}
                      variants={{
                        budget,
                        limit: variantLimit === dish.id,
                        ask: variantAsk?.dishId === dish.id ? variantAsk.ask : null,
                        lit: panel?.kind === 'variants' ? panel.variantId : null,
                        onAdd: () => pressAddVariant(dish),
                        onEdit: (variant) => openVariants(dish, 'edit', variant),
                        onRemove: (variant) => pressRemoveVariant(dish, variant),
                        onKeep: (variant) => {
                          setVariantAsk(null);
                          focusAfter.current = `lib-vremove-${variant.id}`;
                        },
                        onConfirmRemove: (variant) =>
                          changeVariants(
                            dish,
                            removeVariant(dish, variant),
                            VW.removed(variant.name, dish.name),
                          ),
                        onConfirmFold: (variant) => foldDish(dish, variant),
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
          {panel?.kind === 'gone' && (
            <aside className="mn-panel lib-panel" aria-labelledby="lib-panel-title">
              <PanelTop eyebrow={null} title={LW.gone} onClose={() => close('lib-add')} />
              <div className="mn-panel-body">
                <p className="desk-line">{LW.goneBody}</p>
              </div>
            </aside>
          )}
          {panel?.kind === 'variants' && vstate != null && vdish != null && (
            <aside className="mn-panel lib-panel" aria-labelledby="lib-panel-title">
              <PanelTop
                eyebrow={panel.mode === 'addFirst' ? null : waysName(vdish)}
                title={
                  panel.mode === 'addFirst'
                    ? VW.addFirstTitle(vdish.name)
                    : panel.mode === 'add'
                      ? VW.addTitle(vdish.name)
                      : VW.editTitle(
                          variantsOf(vdish).find((one) => one.id === panel.variantId)?.name ?? '',
                        )
                }
                onClose={() => close()}
              />
              <div className="mn-panel-body">
                <VariantFields
                  mode={panel.mode}
                  dish={vdish}
                  forms={vstate.forms}
                  errors={verrors}
                  where="library"
                  budget={budget}
                  lang={lang}
                  pricedIn={null}
                  onPatch={(at, next) =>
                    setVstate({
                      ...vstate,
                      forms: vstate.forms.map((form, i) =>
                        i === at ? { ...form, ...next } : form,
                      ),
                    })
                  }
                />
              </div>
              <div className="mn-panel-foot">
                {vstate.failed && (
                  <p id="lib-failed" className="mn-failed" role="alert" tabIndex={-1}>
                    <Glyph name="alert" size={16} weight={2.2} />
                    {VW.failedSave(variantSaveLabel(panel.mode))}
                  </p>
                )}
                <div className="mn-panel-acts">
                  <button type="button" className="desk-text" onClick={() => close()}>
                    {LW.cancel}
                  </button>
                  <Pill label={variantSaveLabel(panel.mode)} primary onClick={saveVariants} />
                </div>
              </div>
            </aside>
          )}
          {panel != null && panel.kind !== 'gone' && panel.kind !== 'variants' && state != null && (
            <aside className="mn-panel lib-panel" aria-labelledby="lib-panel-title">
              <PanelTop
                eyebrow={panel.kind === 'edit' ? LW.edit : null}
                title={panel.kind === 'edit' ? (editing?.name ?? '') : LW.addDish}
                onClose={() => close()}
              />
              <div className="mn-panel-body">
                {editing != null && hasVariants(editing) ? (
                  <>
                    <NameDescFields form={state.form} errors={errors} onPatch={patch} />
                    <p className="lib-own-copy">{LW.ownCopy}</p>
                  </>
                ) : (
                  <DishFields
                    form={state.form}
                    errors={errors}
                    notStated={editing != null && editing.contains == null}
                    editing={editing != null}
                    budget={budget}
                    lang={lang}
                    onPatch={patch}
                  />
                )}
              </div>
              <div className="mn-panel-foot">
                {state.asking != null && (
                  <div className="mn-ask lib-ask">
                    <p id="lib-asking" tabIndex={-1}>
                      {state.asking}
                    </p>
                    <div className="mn-ask-acts">
                      <button
                        type="button"
                        className="desk-text"
                        onClick={() => {
                          setState({ ...state, asking: null });
                          focusAfter.current = 'lib-name';
                        }}
                      >
                        {LW.cancel}
                      </button>
                      <Pill
                        label={editing == null ? LW.addAnyway : LW.saveAnyway}
                        primary
                        onClick={() => save(true)}
                      />
                    </div>
                  </div>
                )}
                {state.failed && (
                  <p id="lib-failed" className="mn-failed" role="alert" tabIndex={-1}>
                    <Glyph name="alert" size={16} weight={2.2} />
                    {LW.failedSave}
                  </p>
                )}
                {state.asking == null && (
                  <div className="mn-panel-acts">
                    <button type="button" className="desk-text" onClick={() => close()}>
                      {LW.cancel}
                    </button>
                    <Pill label={LW.save} primary onClick={() => save()} />
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

function PanelTop({
  eyebrow,
  title,
  onClose,
}: {
  eyebrow: string | null;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="mn-panel-top">
      <div className="mn-panel-names">
        {eyebrow != null && <p className="mn-eyebrow">{eyebrow}</p>}
        <h2 id="lib-panel-title" tabIndex={-1}>
          {title}
        </h2>
      </div>
      <button type="button" className="ev-round mn-close" aria-label={LW.close} onClick={onClose}>
        <Glyph name="clear" size={16} weight={2.4} />
      </button>
    </div>
  );
}

function Loading() {
  return (
    <div className="lib-loading" aria-busy="true">
      <p className="lib-loading-words" role="status">
        {LW.loading}
      </p>
      {[0, 1, 2, 3].map((one) => (
        <div key={one} className="lib-bone" aria-hidden="true" />
      ))}
    </div>
  );
}

function Empty({ manage, onAdd }: { manage: boolean; onAdd: () => void }) {
  return (
    <div className="desk-card lib-empty">
      <h2>{LW.emptyTitle}</h2>
      {manage && (
        <>
          <p>{LW.emptyBody}</p>
          <Pill label={LW.addDish} primary onClick={onAdd} />
        </>
      )}
    </div>
  );
}

function Toolbar({
  q,
  diets,
  chips,
  lang,
  onQ,
  onDiets,
}: {
  q: string;
  lang: Lang;
  diets: readonly Diet[];
  chips: boolean;
  onQ: (q: string) => void;
  onDiets: (diets: readonly Diet[]) => void;
}) {
  return (
    <div className="lib-toolbar">
      <div className="ev-search lib-search" role="search">
        <div className="ev-field">
          <Glyph name="search" size={18} weight={2.2} />
          <input
            id="lib-find"
            type="search"
            aria-label={LW.find}
            placeholder={LW.find}
            value={q}
            spellCheck={false}
            onChange={(event) => onQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && q !== '') {
                event.preventDefault();
                onQ('');
              }
            }}
          />
          {q !== '' && (
            <button
              type="button"
              className="ev-clear"
              aria-label={LW.clearFind}
              onClick={() => {
                onQ('');
                document.getElementById('lib-find')?.focus();
              }}
            >
              <span className="ev-clear-disc" aria-hidden="true">
                <Glyph name="clear" size={12} weight={3} />
              </span>
            </button>
          )}
        </div>
      </div>
      {chips && (
        <div className="lib-diets" role="group" aria-labelledby="lib-diets-label">
          <span id="lib-diets-label" className="lib-diets-label">
            {LW.suitableFor}
          </span>
          <div className="gs-chips gs-filters">
            {DIETS.map((diet) => {
              const on = diets.includes(diet);
              return (
                <button
                  key={diet}
                  type="button"
                  className={on ? 'gs-chip is-on' : 'gs-chip'}
                  aria-pressed={on}
                  onClick={() =>
                    onDiets(
                      on
                        ? diets.filter((one) => one !== diet)
                        : DIETS.filter((one) => one === diet || diets.includes(one)),
                    )
                  }
                >
                  {on && <Glyph name="tick" size={16} weight={2.6} />}
                  {dietName(diet, lang)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ContainsMark({ dish, lang }: { dish: Pick<LibDish, 'contains'>; lang: Lang }) {
  const kind = dish.contains == null ? 'unknown' : dish.contains === 'none' ? 'none' : 'some';

  return (
    <p className={`lib-contains is-${kind}`}>
      <span className="lib-mark" aria-hidden="true">
        {kind === 'unknown' ? '?' : kind === 'none' ? '0' : '!'}
      </span>
      {containsLine(dish.contains, lang)}
    </p>
  );
}

function DishRow({
  dish,
  lang,
  manage,
  lit,
  asking,
  onEdit,
  onArchive,
  onRestore,
  onAskDelete,
  onKeep,
  onDelete,
  variants,
}: {
  dish: LibDish;
  lang: Lang;
  manage: boolean;
  lit: boolean;
  asking: boolean;
  variants: RowVariants;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onAskDelete: () => void;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const withVariants = hasVariants(dish);

  return (
    <li className={lit ? 'lib-row is-lit' : 'lib-row'}>
      <div className="lib-row-main">
        <div className="lib-cols">
          <div className="lib-col-name">
            <h3>{waysName(dish)}</h3>
            {dish.desc !== '' && <p className="mn-quiet">{dish.desc}</p>}
            {dish.used && <p className="lib-used">{LW.usedBy}</p>}
          </div>
          <div className="lib-col-contains">
            {withVariants ? (
              <p className="mn-quiet">{VW.eachOwn}</p>
            ) : (
              <ContainsMark dish={dish} lang={lang} />
            )}
          </div>
          <div className="lib-col-diets">
            {!withVariants && dish.diets.length > 0 && (
              <ul className="lib-tags" aria-label={`${LW.suitableFor} · ${dish.name}`}>
                {dish.diets.map((diet) => (
                  <li key={diet} className="lib-tag">
                    {dietName(diet, lang)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {manage && (
          <div className="lib-acts" role="group" aria-label={LW.actionsFor(dish.name)}>
            {dish.archived ? (
              <HintButton
                id={`lib-restore-${dish.id}`}
                label={LW.restoreAria(dish.name)}
                hint={LW.restore}
                className="lib-act"
                onClick={onRestore}
              >
                <ActionGlyph icon="restore" />
              </HintButton>
            ) : (
              <>
                <AddVariantButton
                  id={`lib-addv-${dish.id}`}
                  dish={dish.name}
                  onClick={variants.onAdd}
                />
                <HintButton
                  id={`lib-edit-${dish.id}`}
                  label={LW.editAria(dish.name)}
                  hint={LW.edit}
                  className="lib-act"
                  onClick={onEdit}
                >
                  <ActionGlyph icon="edit" />
                </HintButton>
                {dish.used ? (
                  <HintButton
                    id={`lib-archive-${dish.id}`}
                    label={LW.archiveAria(dish.name)}
                    hint={LW.archive}
                    className="lib-act"
                    onClick={onArchive}
                  >
                    <ActionGlyph icon="archive" />
                  </HintButton>
                ) : (
                  <HintButton
                    id={`lib-delete-${dish.id}`}
                    label={LW.deleteAria(dish.name)}
                    hint={LW.delete}
                    className="lib-act"
                    onClick={onAskDelete}
                  >
                    <ActionGlyph icon="bin" />
                  </HintButton>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {variants.limit && <RowLine id={`lib-vrow-${dish.id}`} words={[VW.limit]} />}
      {withVariants && (
        <VariantInsets
          dish={dish}
          where="library"
          ids="lib"
          manage={manage && !dish.archived}
          budget={variants.budget}
          lang={lang}
          asking={variants.ask}
          lit={variants.lit}
          onEdit={variants.onEdit}
          onRemove={variants.onRemove}
          onKeep={variants.onKeep}
          onConfirmRemove={variants.onConfirmRemove}
          onConfirmFold={variants.onConfirmFold}
        />
      )}
      {asking && (
        <div className="mn-ask">
          <p id={`lib-ask-${dish.id}`} tabIndex={-1}>
            {LW.deleteAsk(dish.name)}
          </p>
          <div className="mn-ask-acts">
            <button type="button" className="desk-text" onClick={onKeep}>
              {LW.keepIt}
            </button>
            <Pill label={LW.deleteDish} onClick={onDelete} />
          </div>
        </div>
      )}
    </li>
  );
}

interface RowVariants {
  budget: boolean;
  limit: boolean;
  ask: VariantAsk | null;
  lit: string | null;
  onAdd: () => void;
  onEdit: (variant: Variant) => void;
  onRemove: (variant: Variant) => void;
  onKeep: (variant: Variant) => void;
  onConfirmRemove: (variant: Variant) => void;
  onConfirmFold: (variant: Variant) => void;
}

export type ActionIcon = 'edit' | 'archive' | 'restore' | 'bin' | 'remove';

/** Archive, Restore, Delete… and Remove… have no glyph in the web's set; these are drawn in its 24 px stroke, each a different shape. */
export function ActionGlyph({ icon }: { icon: ActionIcon }) {
  if (icon === 'edit') return <Glyph name="pen" size={20} weight={2} />;
  const paths: Record<Exclude<ActionIcon, 'edit'>, readonly string[]> = {
    archive: ['M3 4h18v4H3z', 'M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8', 'M10 12h4'],
    restore: [
      'M3 4h18v4H3z',
      'M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8',
      'M12 17v-6',
      'm9 13 3-3 3 3',
    ],
    bin: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v6', 'M14 11v6'],
    remove: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M8 12h8'],
  };

  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function Wrong({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {children}
    </p>
  );
}

function Optional() {
  return <span className="gs-optional">{LW.optional}</span>;
}

export function DishFields({
  form,
  errors,
  notStated,
  editing,
  budget,
  lang,
  beforePrice = null,
  onPatch,
}: {
  form: DishForm;
  errors: FormErrors | null;
  notStated: boolean;
  editing: boolean;
  budget: boolean;
  lang: Lang;
  beforePrice?: ReactNode;
  onPatch: (next: Partial<DishForm>) => void;
}) {
  const nameLength = lengthOf(form.name);
  const descLength = lengthOf(form.desc);
  const clashing = new Set(errors?.clashes.map((one) => one.diet) ?? []);

  return (
    <>
      <div className="desk-field">
        <label htmlFor="lib-name" className="desk-label gs-label">
          {LW.name}
        </label>
        <div className={errors?.name == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id="lib-name"
            type="text"
            value={form.name}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={errors?.name != null}
            aria-describedby={['lib-name-count', errors?.name == null ? '' : 'lib-name-error']
              .join(' ')
              .trim()}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </div>
        <p
          id="lib-name-count"
          className={nameLength > NAME_MAX ? 'lib-counter is-over' : 'lib-counter'}
        >
          {LW.counter(nameLength, NAME_MAX)}
        </p>
        {errors?.name != null && <Wrong id="lib-name-error">{errors.name}</Wrong>}
      </div>
      <div className="desk-field">
        <label htmlFor="lib-desc" className="desk-label gs-label">
          {LW.desc}
          <Optional />
        </label>
        <div className={errors?.desc == null ? 'desk-box lib-area' : 'desk-box lib-area is-wrong'}>
          <textarea
            id="lib-desc"
            rows={3}
            value={form.desc}
            aria-invalid={errors?.desc != null}
            aria-describedby={['lib-desc-count', errors?.desc == null ? '' : 'lib-desc-error']
              .join(' ')
              .trim()}
            onChange={(event) => onPatch({ desc: event.target.value })}
          />
        </div>
        <p
          id="lib-desc-count"
          className={descLength > DESC_MAX ? 'lib-counter is-over' : 'lib-counter'}
        >
          {LW.counter(descLength, DESC_MAX)}
        </p>
        {errors?.desc != null && <Wrong id="lib-desc-error">{errors.desc}</Wrong>}
      </div>
      <fieldset
        className="lib-set"
        aria-describedby={[
          'lib-contains-help',
          errors?.contains == null ? '' : 'lib-contains-error',
        ]
          .join(' ')
          .trim()}
        aria-invalid={errors?.contains != null || undefined}
      >
        <legend className="desk-label gs-label">{LW.containsLegend}</legend>
        <p id="lib-contains-help" className="desk-help">
          {LW.containsHelp}
        </p>
        {notStated && form.allergens.length === 0 && !form.none && (
          <p className="lib-contains is-unknown lib-not-stated">
            <span className="lib-mark" aria-hidden="true">
              ?
            </span>
            {LW.notStatedLine}
          </p>
        )}
        <div className="lib-ticks">
          {DISH_ALLERGENS.map((code: DishAllergen) => (
            <label key={code} className="gs-tick lib-tick">
              <input
                id={`lib-has-${code}`}
                type="checkbox"
                className="gs-box"
                checked={form.allergens.includes(code)}
                onChange={() =>
                  onPatch({
                    none: false,
                    allergens: form.allergens.includes(code)
                      ? form.allergens.filter((one) => one !== code)
                      : DISH_ALLERGENS.filter(
                          (one) => one === code || form.allergens.includes(one),
                        ),
                  })
                }
              />
              {allergenName(code, lang)}
            </label>
          ))}
        </div>
        <label className="gs-tick lib-tick lib-none-tick">
          <input
            id="lib-none"
            type="checkbox"
            className="gs-box"
            checked={form.none}
            onChange={() => onPatch({ none: !form.none, allergens: [] })}
          />
          {LW.none}
        </label>
        {errors?.contains != null && <Wrong id="lib-contains-error">{errors.contains}</Wrong>}
      </fieldset>
      <fieldset
        className="lib-set"
        aria-describedby={clashing.size > 0 ? 'lib-diets-error' : undefined}
      >
        <legend className="desk-label gs-label">
          {LW.dietsLegend}
          <Optional />
        </legend>
        <div className="lib-ticks">
          {DIETS.map((diet) => (
            <label key={diet} className="gs-tick lib-tick">
              <input
                id={`lib-diet-${diet}`}
                type="checkbox"
                className="gs-box"
                checked={form.diets.includes(diet)}
                aria-invalid={clashing.has(diet) || undefined}
                onChange={() =>
                  onPatch({
                    diets: form.diets.includes(diet)
                      ? form.diets.filter((one) => one !== diet)
                      : DIETS.filter((one) => one === diet || form.diets.includes(one)),
                  })
                }
              />
              {dietName(diet, lang)}
            </label>
          ))}
        </div>
        {errors != null && errors.clashes.length > 0 && (
          <div id="lib-diets-error" className="lib-clashes">
            {errors.clashes.map((one) => (
              <Wrong key={one.diet} id={`lib-clash-${one.diet}`}>
                {one.line}
              </Wrong>
            ))}
          </div>
        )}
      </fieldset>
      {beforePrice}
      {budget && (
        <fieldset className="lib-set" aria-describedby="lib-price-help">
          <legend className="desk-label gs-label">
            {LW.price}
            <Optional />
          </legend>
          <div className="lib-price">
            <div className="desk-field lib-currency">
              <label htmlFor="lib-currency" className="desk-unseen">
                {LW.currency}
              </label>
              <div className={errors?.currency == null ? 'desk-box' : 'desk-box is-wrong'}>
                <select
                  id="lib-currency"
                  value={form.currency}
                  aria-invalid={errors?.currency != null}
                  aria-describedby={errors?.currency == null ? undefined : 'lib-currency-error'}
                  onChange={(event) => onPatch({ currency: event.target.value })}
                >
                  {form.currency === '' && <option value="">{LW.chooseCurrency}</option>}
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="desk-field lib-amount">
              <label htmlFor="lib-amount" className="desk-unseen">
                {LW.amount}
              </label>
              <div className={errors?.amount == null ? 'desk-box' : 'desk-box is-wrong'}>
                <input
                  id="lib-amount"
                  type="text"
                  inputMode="decimal"
                  lang={lang}
                  value={form.amount}
                  autoComplete="off"
                  aria-invalid={errors?.amount != null}
                  aria-describedby={errors?.amount == null ? undefined : 'lib-amount-error'}
                  onChange={(event) => onPatch({ amount: event.target.value })}
                />
              </div>
            </div>
          </div>
          {errors?.currency != null && <Wrong id="lib-currency-error">{errors.currency}</Wrong>}
          {errors?.amount != null && <Wrong id="lib-amount-error">{errors.amount}</Wrong>}
          <p id="lib-price-help" className="desk-help">
            {LW.priceHint}
          </p>
        </fieldset>
      )}
      {editing && <p className="lib-own-copy">{LW.ownCopy}</p>}
    </>
  );
}
