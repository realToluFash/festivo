import {
  ApiError,
  DISH_DIETS,
  type Dish,
  type DishDiet,
  VARIANTS_PER_DISH_MAXIMUM,
} from '@soirely/api-client';
import {
  type DishForm,
  type DishProblems,
  type VariantForm,
  type VariantMode,
  addVariantOutcome,
  blankVariantForm,
  firstVariantProblem,
  hasProblem,
  removeVariantOutcome,
  variantDetailsOf,
  variantFormOf,
  variantProblems,
  blankDishForm,
  dishDetailsOf,
  dishFormOf,
  moneyLanguage,
  dishProblems,
  firstDishProblem,
  roleName,
  sameNamedDish,
  shownDishes,
} from '@soirely/domain';
import { type TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { HintButton } from '../../../components/HintButton.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { TitleRow } from '../../../components/SettingsParts.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { keepsWhatLoaded, useOffline } from '../../../offline.ts';
import { useSession } from '../../../session.ts';
import { Forbidden } from '../Forbidden.tsx';
import { ActionGlyph, ContainsMark, DishFields } from './DishParts.tsx';
import {
  AddVariantButton,
  NameDescFields,
  RowLine,
  type ShownVariant,
  type VariantAsk,
  VariantFields,
  VariantInsets,
} from './VariantParts.tsx';
import '../../../components/desk.css';
import '../../../components/SettingsParts.css';
import '../../../components/EventsSearch.css';
import '../../../components/eventPage.css';
import '../events/guests.css';
import './menuLibrary.css';

/** The organisation's Menu library at a desk (sc-3901): the list A to Z, and Add dish or Edit docked beside it. */
export function MenuLibrary() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;

  return (
    <Library
      key={organisation.id}
      organisationId={organisation.id}
      currency={organisation.currency}
      role={organisation.role}
    />
  );
}

type Load =
  | { kind: 'loading' }
  | { kind: 'forbidden' }
  | { kind: 'failed' }
  | { kind: 'loaded'; dishes: Dish[]; manage: boolean; prices: boolean };

type Panel =
  | { kind: 'add' }
  | { kind: 'edit'; id: string }
  | { kind: 'gone' }
  | {
      kind: 'variant';
      mode: VariantMode;
      dishId: string;
      variantId: string | null;
      forms: VariantForm[];
      pressed: boolean;
      failed: boolean;
      busy: boolean;
    };

interface RowVariants {
  prices: boolean;
  ask: VariantAsk | null;
  limit: boolean;
  lit: string | null;
  onAdd: () => void;
  onEdit: (variant: ShownVariant) => void;
  onRemove: (variant: ShownVariant) => void;
  onKeep: (variant: ShownVariant) => void;
  onConfirm: (variant: ShownVariant) => void;
}

const shownOf = (dish: Dish): ShownVariant[] =>
  dish.variants.map((one) => ({ ...one, price: one.lastPrice ?? null }));

function withoutContains(problems: DishProblems): DishProblems {
  return { ...problems, contains: null, clashes: [], currency: null, amount: null };
}

interface FormState {
  form: DishForm;
  pressed: boolean;
  asking: string | null;
  failed: boolean;
  busy: boolean;
}

function Library({
  organisationId,
  currency,
  role,
}: {
  organisationId: string;
  currency: string;
  role: Parameters<typeof roleName>[1];
}) {
  const { t, i18n } = useTranslation();
  const desk = useDeskTop();
  const language = moneyLanguage(i18n.language);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState<'dishes' | 'archived'>('dishes');
  const [query, setQuery] = useState('');
  const [diets, setDiets] = useState<readonly DishDiet[]>([]);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [state, setState] = useState<FormState | null>(null);
  const [askDelete, setAskDelete] = useState<string | null>(null);
  const [variantAsk, setVariantAsk] = useState<VariantAsk | null>(null);
  const [limitAt, setLimitAt] = useState<string | null>(null);
  const [said, setSaid] = useState<{ line: string; failed: boolean } | null>(null);
  const focusAfter = useRef<string | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const { watch, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    title,
  });

  useEffect(() => {
    let current = true;

    watch(api.dishes(organisationId)).then(
      (library) =>
        current &&
        setLoad({
          kind: 'loaded',
          dishes: library.dishes,
          manage: library.canManage,
          prices: library.seesPrices,
        }),
      (error: unknown) =>
        current &&
        setLoad((was) =>
          error instanceof ApiError && error.status === 403
            ? { kind: 'forbidden' }
            : was.kind === 'loaded' && keepsWhatLoaded(error)
              ? was
              : { kind: 'failed' },
        ),
    );

    return () => {
      current = false;
    };
  }, [organisationId, refresh, watch]);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  if (load.kind === 'forbidden') return <Forbidden />;

  const dishes = load.kind === 'loaded' ? load.dishes : [];
  const manage = load.kind === 'loaded' && load.manage;
  const prices = load.kind === 'loaded' && load.prices;
  const active = dishes.filter((one) => one.archivedAt == null);
  const archived = dishes.filter((one) => one.archivedAt != null);
  const inTab = tab === 'dishes' ? active : archived;
  const chips = tab === 'dishes' ? diets : [];
  const shown = shownDishes(inTab, query, chips, i18n.language);
  const looking = query.trim() !== '' || chips.length > 0;
  const editing =
    panel?.kind === 'edit' ? (dishes.find((one) => one.id === panel.id) ?? null) : null;
  const plain = editing == null || editing.variants.length === 0;
  const checked = (form: DishForm) => {
    const found = dishProblems(form, language, prices);

    return plain ? found : withoutContains(found);
  };
  const problems = state?.pressed === true ? checked(state.form) : null;
  const variantDish =
    panel?.kind === 'variant' ? (dishes.find((one) => one.id === panel.dishId) ?? null) : null;

  function replace(next: Dish) {
    setLoad((was) =>
      was.kind !== 'loaded'
        ? was
        : {
            ...was,
            dishes: was.dishes.some((one) => one.id === next.id)
              ? was.dishes.map((one) => (one.id === next.id ? next : one))
              : [...was.dishes, next],
          },
    );
  }

  function patch(next: Partial<DishForm>) {
    setState((now) =>
      now == null ? now : { ...now, form: { ...now.form, ...next }, asking: null },
    );
  }

  function open(next: Panel, form: DishForm) {
    setPanel(next);
    setState({ form, pressed: false, asking: null, failed: false, busy: false });
    setAskDelete(null);
    focusAfter.current = 'lib-panel-title';
  }

  function close(back?: string) {
    const from =
      panel?.kind === 'edit'
        ? `lib-edit-${panel.id}`
        : panel?.kind === 'variant'
          ? panel.variantId == null
            ? `lib-addv-${panel.dishId}`
            : `lib-vedit-${panel.variantId}`
          : 'lib-add';
    setPanel(null);
    setState(null);
    focusAfter.current = back ?? from;
  }

  function say(line: string, failed = false) {
    setSaid({ line, failed });
    focusAfter.current = 'lib-said';
  }

  async function save(anyway = false) {
    if (state == null || panel == null || panel.kind === 'gone' || state.busy) return;
    const problem = firstDishProblem(checked(state.form));
    if (problem != null) {
      setState({ ...state, pressed: true, asking: null });
      focusAfter.current = problem;
      return;
    }
    const selfId = panel.kind === 'edit' ? panel.id : null;
    const renamed = editing == null || state.form.name.trim() !== editing.name;
    const match = renamed && !anyway ? sameNamedDish(state.form.name, dishes, selfId) : null;
    if (match != null) {
      setState({
        ...state,
        pressed: true,
        asking: askLine(t, match.dish.name, match.archivedOnly),
      });
      focusAfter.current = 'lib-asking';
      return;
    }
    setState({ ...state, pressed: true, busy: true, failed: false });
    const details = dishDetailsOf(state.form, language, prices && plain, anyway);

    try {
      const saved =
        selfId == null
          ? await api.addDish(organisationId, details)
          : await api.editDish(organisationId, selfId, details);
      replace(saved);
      setPanel(null);
      setState(null);
      say(
        selfId == null
          ? t('menuLibrary.added', { name: saved.name })
          : t('menuLibrary.saved', { name: saved.name }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.is('dish_name_shared')) {
        setState((now) =>
          now == null
            ? now
            : {
                ...now,
                busy: false,
                asking: askLine(t, error.problem.sharedWith ?? '', error.problem.archived === true),
              },
        );
        focusAfter.current = 'lib-asking';
        return;
      }
      if (error instanceof ApiError && error.status === 404 && selfId != null) {
        setLoad((was) =>
          was.kind === 'loaded'
            ? { ...was, dishes: was.dishes.filter((one) => one.id !== selfId) }
            : was,
        );
        setPanel({ kind: 'gone' });
        setState(null);
        focusAfter.current = 'lib-panel-title';
        return;
      }
      setState((now) => (now == null ? now : { ...now, busy: false, failed: true }));
      focusAfter.current = 'lib-failed';
    }
  }

  async function act(dish: Dish, kind: 'archive' | 'restore' | 'delete') {
    try {
      if (kind === 'delete') {
        await api.deleteDish(organisationId, dish.id);
        setLoad((was) =>
          was.kind === 'loaded'
            ? { ...was, dishes: was.dishes.filter((one) => one.id !== dish.id) }
            : was,
        );
        setAskDelete(null);
        say(t('menuLibrary.deleted', { name: dish.name }));
        return;
      }
      replace(
        kind === 'archive'
          ? await api.archiveDish(organisationId, dish.id)
          : await api.restoreDish(organisationId, dish.id),
      );
      say(
        kind === 'archive'
          ? t('menuLibrary.archivedLine', { name: dish.name })
          : t('menuLibrary.restored', { name: dish.name }),
      );
    } catch (error) {
      setAskDelete(null);
      if (kind === 'delete' && error instanceof ApiError && error.is('dish_in_use')) {
        replace({ ...dish, usedByEvent: true });
        say(error.problem.title, true);
        return;
      }
      say(
        t(
          kind === 'archive'
            ? 'menuLibrary.failedArchive'
            : kind === 'restore'
              ? 'menuLibrary.failedRestore'
              : 'menuLibrary.failedDelete',
          { name: dish.name },
        ),
        true,
      );
    }
  }

  function openVariant(dish: Dish, mode: VariantMode, variant: ShownVariant | null) {
    setVariantAsk(null);
    setLimitAt(null);
    setAskDelete(null);
    setSaid(null);
    setState(null);
    const blank = blankVariantForm(currency);
    setPanel({
      kind: 'variant',
      mode,
      dishId: dish.id,
      variantId: variant?.id ?? null,
      forms:
        variant != null
          ? [variantFormOf(variant, variant.price, language, currency)]
          : mode === 'addFirst'
            ? [blank, blank]
            : [blank],
      pressed: false,
      failed: false,
      busy: false,
    });
    focusAfter.current = 'lib-panel-title';
  }

  function addVariant(dish: Dish) {
    if (addVariantOutcome(dish.variants, false) === 'limit') {
      setVariantAsk(null);
      setSaid(null);
      setLimitAt(dish.id);
      return;
    }
    openVariant(dish, dish.variants.length === 0 ? 'addFirst' : 'add', null);
  }

  function othersOf(dish: Dish | null, mode: VariantMode, variantId: string | null) {
    if (dish == null || mode === 'addFirst') return [];

    return dish.variants.filter((one) => one.id !== variantId);
  }

  async function saveVariants() {
    if (panel?.kind !== 'variant' || variantDish == null || panel.busy) return;
    const found = variantProblems(
      panel.forms,
      othersOf(variantDish, panel.mode, panel.variantId),
      language,
      prices,
    );
    if (hasProblem(found)) {
      setPanel({ ...panel, pressed: true, failed: false });
      focusAfter.current = firstVariantProblem(found, panel.forms);
      return;
    }
    const details = panel.forms.map((form) => variantDetailsOf(form, 'library', language, prices));
    const [first, second] = details;
    setPanel({ ...panel, pressed: true, busy: true, failed: false });

    try {
      const saved =
        panel.variantId == null || first == null
          ? await api.addDishVariants(organisationId, panel.dishId, details)
          : await api.editDishVariant(organisationId, panel.dishId, panel.variantId, first);
      replace(saved);
      setPanel(null);
      if (panel.mode === 'addFirst' && first != null && second != null)
        say(
          t('dishVariants.addedTwo', {
            count: 2,
            dish: saved.name,
            first: first.name,
            second: second.name,
          }),
        );
      else if (panel.mode === 'add' && first != null)
        say(t('dishVariants.added', { variant: first.name, dish: saved.name }));
      else if (first != null) say(t('dishVariants.saved', { variant: first.name }));
    } catch (error) {
      if (error instanceof ApiError && error.is('variant_limit')) {
        setPanel(null);
        setLimitAt(panel.dishId);
        return;
      }
      setPanel((now) => (now?.kind === 'variant' ? { ...now, busy: false, failed: true } : now));
      focusAfter.current = 'lib-failed';
    }
  }

  function askRemoveVariant(dish: Dish, variant: ShownVariant) {
    setLimitAt(null);
    setSaid(null);
    const outcome = removeVariantOutcome(dish.variants, variant);
    if (outcome.kind === 'refused') {
      setVariantAsk({ variantId: variant.id, kind: 'refused', lines: outcome.lines });
      return;
    }
    setVariantAsk({ variantId: variant.id, kind: outcome.kind, failed: null });
    focusAfter.current = `lib-vask-${variant.id}`;
  }

  async function confirmVariant(dish: Dish, variant: ShownVariant) {
    const staying = dish.variants.find((one) => one.id !== variant.id) ?? null;
    const folding = dish.variants.length <= 2;

    try {
      replace(await api.removeDishVariant(organisationId, dish.id, variant.id));
      setVariantAsk(null);
      if (panel?.kind === 'variant' && panel.dishId === dish.id) setPanel(null);
      if (folding && staying != null)
        say(
          t(prices ? 'dishVariants.foldedPrice' : 'dishVariants.folded', {
            dish: dish.name,
            variant: staying.name,
          }),
        );
      else say(t('dishVariants.removed', { variant: variant.name, dish: dish.name }));
    } catch (error) {
      if (error instanceof ApiError && error.is('variant_last_everyone')) {
        setVariantAsk({ variantId: variant.id, kind: 'refused', lines: ['lastEveryone'] });
        return;
      }
      setVariantAsk((was) =>
        was?.variantId === variant.id && was.kind !== 'refused'
          ? {
              ...was,
              failed: t('dishVariants.failedChange', {
                dish: dish.name,
                count: dish.variants.length,
              }),
            }
          : was,
      );
      focusAfter.current = `lib-vfailed-${variant.id}`;
    }
  }

  function rowVariants(dish: Dish): RowVariants {
    return {
      prices,
      ask: variantAsk,
      limit: limitAt === dish.id,
      lit: panel?.kind === 'variant' ? panel.variantId : null,
      onAdd: () => addVariant(dish),
      onEdit: (variant) => openVariant(dish, 'edit', variant),
      onRemove: (variant) => askRemoveVariant(dish, variant),
      onKeep: (variant) => {
        setVariantAsk(null);
        focusAfter.current = `lib-vremove-${variant.id}`;
      },
      onConfirm: (variant) => void confirmVariant(dish, variant),
    };
  }

  function clearAll() {
    setQuery('');
    setDiets([]);
    focusAfter.current = 'lib-find';
  }

  const openAdd = () => open({ kind: 'add' }, blankDishForm(currency));

  return (
    <div className="desk desk-page lib-page">
      {desk.offline}
      <TitleRow
        title={t('menuLibrary.title')}
        titleRef={title}
        action={
          <span className="lib-top-acts">
            {refreshing && <Refreshing />}
            {manage && (
              <button
                id="lib-add"
                type="button"
                className="gs-pill is-primary lib-add"
                onClick={openAdd}
              >
                <Glyph name="plus" size={16} weight={2.6} />
                {t('menuLibrary.addDish')}
              </button>
            )}
          </span>
        }
        bell={desk.bell}
      />
      {desk.said}
      <p className="lib-sub">{t('menuLibrary.sub')}</p>
      {load.kind === 'loaded' && !manage && (
        <p className="mn-lock">
          <Glyph name="lock" size={16} weight={2.2} />
          {t('menuLibrary.lock', { role: roleName(t, role) })}
        </p>
      )}
      <p
        id="lib-said"
        className={said?.failed === true ? 'lib-said is-failed' : 'lib-said'}
        role="status"
        tabIndex={-1}
      >
        {said != null && (
          <>
            <Glyph name={said.failed ? 'alert' : 'tick'} size={17} weight={2.6} />
            {said.line}
          </>
        )}
      </p>
      {load.kind === 'loading' || load.kind === 'failed' ? (
        <Loading />
      ) : dishes.length === 0 && panel == null ? (
        <Empty manage={manage} onAdd={openAdd} />
      ) : (
        <div className={panel != null ? 'mn-split lib-split is-docked' : 'mn-split lib-split'}>
          <div className="lib-list">
            <div className="lib-tabs" role="tablist" aria-label={t('menuLibrary.tabs')}>
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
                  {t(one === 'dishes' ? 'menuLibrary.dishes' : 'menuLibrary.archived')}
                  <span className="lib-tab-count">
                    {(one === 'dishes' ? active : archived).length}
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
                query={query}
                diets={diets}
                chips={tab === 'dishes'}
                onQuery={setQuery}
                onDiets={setDiets}
              />
              <div className="lib-count-row">
                <p className="lib-count" role="status">
                  {looking
                    ? t('menuLibrary.countOf', { shown: shown.length, count: inTab.length })
                    : t('menuLibrary.count', { count: inTab.length })}
                </p>
                {looking && (
                  <button type="button" className="desk-text" onClick={clearAll}>
                    {t('menuLibrary.clearAll')}
                  </button>
                )}
              </div>
              {inTab.length === 0 ? (
                <p className="lib-none">
                  {t(tab === 'archived' ? 'menuLibrary.noArchived' : 'menuLibrary.emptyTitle')}
                </p>
              ) : shown.length === 0 ? (
                <div className="lib-nomatch">
                  <p>{noMatchLine(t, query, chips)}</p>
                  <button type="button" className="desk-text" onClick={clearAll}>
                    {t('menuLibrary.clearAll')}
                  </button>
                </div>
              ) : (
                <ul className="lib-rows">
                  {shown.map((dish) => (
                    <DishRow
                      key={dish.id}
                      dish={dish}
                      manage={manage}
                      lit={editing?.id === dish.id || variantDish?.id === dish.id}
                      language={language}
                      variants={rowVariants(dish)}
                      asking={askDelete === dish.id}
                      onEdit={() =>
                        open({ kind: 'edit', id: dish.id }, dishFormOf(dish, language, currency))
                      }
                      onArchive={() => void act(dish, 'archive')}
                      onRestore={() => void act(dish, 'restore')}
                      onAskDelete={() => {
                        setAskDelete(dish.id);
                        focusAfter.current = `lib-ask-${dish.id}`;
                      }}
                      onKeep={() => {
                        setAskDelete(null);
                        focusAfter.current = `lib-delete-${dish.id}`;
                      }}
                      onDelete={() => void act(dish, 'delete')}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
          {panel?.kind === 'gone' && (
            <aside className="mn-panel lib-panel" aria-labelledby="lib-panel-title">
              <PanelTop
                eyebrow={null}
                title={t('menuLibrary.gone')}
                onClose={() => close('lib-add')}
              />
              <div className="mn-panel-body">
                <p className="desk-line">{t('menuLibrary.goneBody')}</p>
              </div>
            </aside>
          )}
          {panel?.kind === 'variant' && variantDish != null && (
            <aside className="mn-panel lib-panel" aria-labelledby="lib-panel-title">
              <PanelTop
                eyebrow={null}
                title={
                  panel.mode === 'addFirst'
                    ? t('dishVariants.addFirstTitle', { dish: variantDish.name })
                    : panel.mode === 'add'
                      ? t('dishVariants.addTitle', { dish: variantDish.name })
                      : t('dishVariants.editTitle', {
                          variant:
                            variantDish.variants.find((one) => one.id === panel.variantId)?.name ??
                            '',
                        })
                }
                onClose={() => close()}
              />
              <div className="mn-panel-body">
                <VariantFields
                  mode={panel.mode}
                  dish={variantDish}
                  forms={panel.forms}
                  problems={
                    panel.pressed
                      ? variantProblems(
                          panel.forms,
                          othersOf(variantDish, panel.mode, panel.variantId),
                          language,
                          prices,
                        )
                      : null
                  }
                  where="library"
                  prices={prices}
                  language={language}
                  heldCurrency={
                    variantDish.variants.find((one) => one.id === panel.variantId)?.lastPrice
                      ?.currency ?? ''
                  }
                  onPatch={(at, next) =>
                    setPanel({
                      ...panel,
                      forms: panel.forms.map((form, i) => (i === at ? { ...form, ...next } : form)),
                    })
                  }
                />
              </div>
              <div className="mn-panel-foot">
                {panel.failed && (
                  <p id="lib-failed" className="mn-failed" role="alert" tabIndex={-1}>
                    <Glyph name="alert" size={16} weight={2.2} />
                    {t('menuLibrary.failedSave')}
                  </p>
                )}
                <div className="mn-panel-acts">
                  <button type="button" className="desk-text" onClick={() => close()}>
                    {t('menuLibrary.cancel')}
                  </button>
                  <Pill
                    label={
                      panel.mode === 'addFirst'
                        ? t('dishVariants.addVariants')
                        : panel.mode === 'add'
                          ? t('dishVariants.addVariant')
                          : t('dishVariants.saveVariant')
                    }
                    busy={panel.busy}
                    onClick={() => void saveVariants()}
                  />
                </div>
              </div>
            </aside>
          )}
          {panel != null && panel.kind !== 'gone' && panel.kind !== 'variant' && state != null && (
            <aside className="mn-panel lib-panel" aria-labelledby="lib-panel-title">
              <PanelTop
                eyebrow={panel.kind === 'edit' ? t('menuLibrary.edit') : null}
                title={panel.kind === 'edit' ? (editing?.name ?? '') : t('menuLibrary.addDish')}
                onClose={() => close()}
              />
              <div className="mn-panel-body">
                {plain ? (
                  <DishFields
                    form={state.form}
                    problems={problems}
                    notStated={editing != null && editing.allergens == null}
                    editing={editing}
                    prices={prices}
                    language={language}
                    onPatch={patch}
                  />
                ) : (
                  <NameDescFields form={state.form} problems={problems} onPatch={patch} />
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
                        {t('menuLibrary.cancel')}
                      </button>
                      <Pill
                        label={t(
                          editing == null ? 'menuLibrary.addAnyway' : 'menuLibrary.saveAnyway',
                        )}
                        busy={state.busy}
                        onClick={() => void save(true)}
                      />
                    </div>
                  </div>
                )}
                {state.failed && (
                  <p id="lib-failed" className="mn-failed" role="alert" tabIndex={-1}>
                    <Glyph name="alert" size={16} weight={2.2} />
                    {t('menuLibrary.failedSave')}
                  </p>
                )}
                {state.asking == null && (
                  <div className="mn-panel-acts">
                    <button type="button" className="desk-text" onClick={() => close()}>
                      {t('menuLibrary.cancel')}
                    </button>
                    <Pill
                      label={t('menuLibrary.save')}
                      busy={state.busy}
                      onClick={() => void save()}
                    />
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

function askLine(t: TFunction, name: string, archivedOnly: boolean): string {
  return t(archivedOnly ? 'menuLibrary.duplicateArchived' : 'menuLibrary.duplicate', { name });
}

function noMatchLine(t: TFunction, query: string, diets: readonly DishDiet[]): string {
  if (query.trim() === '') return t('menuLibrary.noMatchDiets');

  return t(diets.length === 0 ? 'menuLibrary.noMatch' : 'menuLibrary.noMatchBoth', {
    query: query.trim(),
  });
}

function Pill({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="gs-pill is-primary"
      aria-busy={busy || undefined}
      onClick={onClick}
    >
      {label}
    </button>
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
  const { t } = useTranslation();

  return (
    <div className="mn-panel-top">
      <div className="mn-panel-names">
        {eyebrow != null && <p className="mn-eyebrow">{eyebrow}</p>}
        <h2 id="lib-panel-title" tabIndex={-1}>
          {title}
        </h2>
      </div>
      <button
        type="button"
        className="ev-round mn-close"
        aria-label={t('menuLibrary.close')}
        onClick={onClose}
      >
        <Glyph name="clear" size={16} weight={2.4} />
      </button>
    </div>
  );
}

function Loading() {
  const { t } = useTranslation();

  return (
    <div className="lib-loading" aria-busy="true">
      <p className="lib-loading-words" role="status">
        {t('menuLibrary.loading')}
      </p>
      {[0, 1, 2, 3].map((one) => (
        <div key={one} className="lib-bone" aria-hidden="true" />
      ))}
    </div>
  );
}

function Empty({ manage, onAdd }: { manage: boolean; onAdd: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="desk-card lib-empty">
      <h2>{t('menuLibrary.emptyTitle')}</h2>
      {manage && (
        <>
          <p>{t('menuLibrary.emptyBody')}</p>
          <Pill label={t('menuLibrary.addDish')} busy={false} onClick={onAdd} />
        </>
      )}
    </div>
  );
}

function Toolbar({
  query,
  diets,
  chips,
  onQuery,
  onDiets,
}: {
  query: string;
  diets: readonly DishDiet[];
  chips: boolean;
  onQuery: (query: string) => void;
  onDiets: (diets: readonly DishDiet[]) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="lib-toolbar">
      <div className="ev-search lib-search" role="search">
        <div className="ev-field">
          <Glyph name="search" size={18} weight={2.2} />
          <input
            id="lib-find"
            type="search"
            aria-label={t('menuLibrary.find')}
            placeholder={t('menuLibrary.find')}
            value={query}
            spellCheck={false}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query !== '') {
                event.preventDefault();
                onQuery('');
              }
            }}
          />
          {query !== '' && (
            <button
              type="button"
              className="ev-clear"
              aria-label={t('menuLibrary.clearFind')}
              onClick={() => {
                onQuery('');
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
            {t('menuLibrary.suitableFor')}
          </span>
          <div className="gs-chips gs-filters">
            {DISH_DIETS.map((diet) => {
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
                        : DISH_DIETS.filter((one) => one === diet || diets.includes(one)),
                    )
                  }
                >
                  {on && <Glyph name="tick" size={16} weight={2.6} />}
                  {t(`guestNeeds.dietName.${diet}`)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DishRow({
  dish,
  manage,
  lit,
  asking,
  onEdit,
  onArchive,
  onRestore,
  onAskDelete,
  onKeep,
  onDelete,
  language,
  variants,
}: {
  dish: Dish;
  manage: boolean;
  lit: boolean;
  asking: boolean;
  language: ReturnType<typeof moneyLanguage>;
  variants: RowVariants;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onAskDelete: () => void;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const name = dish.name;
  const ways = dish.variants.length > 0;

  return (
    <li className={lit ? 'lib-row is-lit' : 'lib-row'}>
      <div className="lib-row-main">
        <div className="lib-cols">
          <div className="lib-col-name">
            <h3>
              {ways ? t('dishVariants.ways', { dish: name, count: dish.variants.length }) : name}
            </h3>
            {dish.description != null && <p className="mn-quiet">{dish.description}</p>}
            {dish.usedByEvent && <p className="lib-used">{t('menuLibrary.usedBy')}</p>}
          </div>
          <div className="lib-col-contains">
            {ways ? (
              <p className="mn-quiet">{t('dishVariants.eachOwn')}</p>
            ) : (
              <ContainsMark dish={dish} />
            )}
          </div>
          <div className="lib-col-diets">
            {!ways && dish.diets.length > 0 && (
              <ul className="lib-tags" aria-label={t('menuLibrary.tagsFor', { name })}>
                {dish.diets.map((diet) => (
                  <li key={diet} className="lib-tag">
                    {t(`guestNeeds.dietName.${diet}`)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {manage && (
          <div className="lib-acts" role="group" aria-label={t('menuLibrary.actionsFor', { name })}>
            {dish.archivedAt != null ? (
              <HintButton
                id={`lib-restore-${dish.id}`}
                label={t('menuLibrary.restoreAria', { name })}
                hint={t('menuLibrary.restore')}
                className="lib-act"
                onClick={onRestore}
              >
                <ActionGlyph icon="restore" />
              </HintButton>
            ) : (
              <>
                <AddVariantButton id={`lib-addv-${dish.id}`} dish={name} onClick={variants.onAdd} />
                <HintButton
                  id={`lib-edit-${dish.id}`}
                  label={t('menuLibrary.editAria', { name })}
                  hint={t('menuLibrary.edit')}
                  className="lib-act"
                  onClick={onEdit}
                >
                  <ActionGlyph icon="edit" />
                </HintButton>
                {dish.usedByEvent ? (
                  <HintButton
                    id={`lib-archive-${dish.id}`}
                    label={t('menuLibrary.archiveAria', { name })}
                    hint={t('menuLibrary.archive')}
                    className="lib-act"
                    onClick={onArchive}
                  >
                    <ActionGlyph icon="archive" />
                  </HintButton>
                ) : (
                  <HintButton
                    id={`lib-delete-${dish.id}`}
                    label={t('menuLibrary.deleteAria', { name })}
                    hint={t('menuLibrary.delete')}
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
      {variants.limit && (
        <RowLine
          id={`lib-vrow-${dish.id}`}
          words={[t('dishVariants.limit', { most: VARIANTS_PER_DISH_MAXIMUM })]}
        />
      )}
      {ways && (
        <VariantInsets
          dish={name}
          variants={shownOf(dish)}
          where="library"
          ids="lib"
          manage={manage && dish.archivedAt == null}
          prices={variants.prices}
          language={language}
          asking={variants.ask}
          lit={variants.lit}
          onEdit={variants.onEdit}
          onRemove={variants.onRemove}
          onKeep={variants.onKeep}
          onConfirm={variants.onConfirm}
        />
      )}
      {asking && (
        <div className="mn-ask">
          <p id={`lib-ask-${dish.id}`} tabIndex={-1}>
            {t('menuLibrary.deleteAsk', { name })}
          </p>
          <div className="mn-ask-acts">
            <button type="button" className="desk-text" onClick={onKeep}>
              {t('menuLibrary.keepIt')}
            </button>
            <button type="button" className="gs-pill is-secondary" onClick={onDelete}>
              {t('menuLibrary.deleteDish')}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
