import {
  ApiError,
  type Vendor,
  type VendorCategory,
  type VendorView,
  type VendorsPage,
  VENDOR_CATEGORIES,
} from '@soirely/api-client';
import { callingCode, countryChoices, formatEventDate, formatPhone } from '@soirely/domain';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import {
  Ask,
  Card,
  CardStep,
  Chevron,
  Dialog,
  Menu,
  OnCard,
  RowWords,
  Says,
  TextAction,
  TitleRow,
} from '../../../components/SettingsParts.tsx';
import { TYPING_PAUSE_MS } from '../../../components/ShellSearch.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { LayersContext, useDeskLayers } from '../../../layers.ts';
import { offButton } from '../../../offButton.ts';
import { codeChoice } from '../../../phoneProblem.ts';
import { can, useSession } from '../../../session.ts';
import { Forbidden } from '../Forbidden.tsx';
import {
  BLANK,
  type Draft,
  type DraftField,
  type Problems,
  changed,
  draftOf,
  draftProblems,
  fieldsToFix,
  refusedAt,
  typedOf,
} from './vendorsForm.ts';
import '../../../components/SettingsParts.css';
import '../../../components/AccountParts.css';
import './vendors.css';

interface Looking {
  view: VendorView;
  q: string;
  category: VendorCategory | 'all';
  page: number;
}

const NOT_LOOKING: Looking = { view: 'inUse', q: '', category: 'all', page: 1 };

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; page: VendorsPage };

type Editing = { kind: 'add' } | { kind: 'edit'; vendor: Vendor };

const PAGE_SIZE = 25;

const title = () => document.querySelector<HTMLElement>('.vd-desk h1');

/** Settings › Vendors at a desk (sc-82): the card, the directory a page at a time, its form, Archive and Restore, as the demo's Budget-A-Vendors draws them. */
export function Vendors() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;
  if (!can(session, 'vendors.read')) return <Forbidden />;

  return (
    <Directory
      key={organisation.id}
      organisationId={organisation.id}
      named={organisation.name}
      manages={can(session, 'vendors.manage')}
    />
  );
}

function Directory({
  organisationId,
  named,
  manages,
}: {
  organisationId: string;
  named: string;
  manages: boolean;
}) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const { layers, covered, setHost } = useDeskLayers();
  const [looking, setLooking] = useState<Looking>(NOT_LOOKING);
  const [typed, setTyped] = useState('');
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [menu, setMenu] = useState<'category' | 'filter' | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [told, setTold] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const backToSearch = useRef(false);

  useEffect(() => {
    const stop = new AbortController();
    api
      .vendors(
        organisationId,
        {
          view: looking.view,
          q: looking.q,
          category: looking.category === 'all' ? null : looking.category,
          page: looking.page,
        },
        { signal: stop.signal },
      )
      .then(
        (page) => {
          if (!stop.signal.aborted) setLoad({ kind: 'loaded', page });
        },
        () => {
          if (!stop.signal.aborted) setLoad({ kind: 'failed' });
        },
      );

    return () => stop.abort();
  }, [organisationId, looking, attempt]);

  useEffect(() => {
    const wait = window.setTimeout(
      () => setLooking((was) => (was.q === typed ? was : { ...was, q: typed, page: 1 })),
      TYPING_PAUSE_MS,
    );

    return () => window.clearTimeout(wait);
  }, [typed]);

  useEffect(() => {
    if (load.kind !== 'loaded' || !backToSearch.current) return;
    backToSearch.current = false;
    search.current?.focus();
  }, [load]);

  const look = (next: Omit<Looking, 'page'>) => {
    setTyped(next.q);
    setLooking({ ...next, page: 1 });
  };
  const turn = (page: number) => {
    setLooking((was) => ({ ...was, page }));
    title()?.focus();
  };
  const reread = () => setAttempt((n) => n + 1);
  const close = useCallback(() => setEditing(null), []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const tell = (words: string) => setTold(words);

  return (
    <LayersContext value={layers}>
      <div className="desk vd-desk">
        <div className="desk-page" inert={covered}>
          <div className="desk-column vd-column">
            <TitleRow title={t('vendors.title')} bell={desk.bell} />
            {load.kind === 'loading' && <Loading />}
            {load.kind === 'failed' && (
              <Failed
                onRetry={() => {
                  backToSearch.current = typed !== '';
                  setLoad({ kind: 'loading' });
                  setLooking((was) => (was.q === typed ? was : { ...was, q: typed, page: 1 }));
                  reread();
                }}
              />
            )}
            {load.kind === 'loaded' && (
              <Loaded
                page={load.page}
                looking={looking}
                typed={typed}
                named={named}
                manages={manages}
                menu={menu}
                search={search}
                onLook={look}
                onType={setTyped}
                onTurn={turn}
                onMenu={setMenu}
                onCloseMenu={closeMenu}
                onAdd={() => setEditing({ kind: 'add' })}
                onOpen={(vendor) => setEditing({ kind: 'edit', vendor })}
                onRestore={(vendor) => {
                  void api.restoreVendor(organisationId, vendor.id).then(
                    () => {
                      tell(t('vendors.restored', { name: vendor.name }));
                      reread();
                      title()?.focus();
                    },
                    () => tell(t('vendors.failedLine')),
                  );
                }}
              />
            )}
          </div>
        </div>
        {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
        <div ref={setHost} className="desk-layers" />
        {editing != null && (
          <VendorForm
            key={editing.kind === 'edit' ? editing.vendor.id : 'add'}
            organisationId={organisationId}
            vendor={editing.kind === 'edit' ? editing.vendor : null}
            onClose={close}
            onSaved={(vendor, added) => {
              close();
              tell(t(added ? 'vendors.added' : 'vendors.saved', { name: vendor.name }));
              reread();
            }}
            onArchived={(vendor) => {
              close();
              tell(t('vendors.archivedToast', { name: vendor.name }));
              reread();
              title()?.focus();
            }}
          />
        )}
      </div>
    </LayersContext>
  );
}

function Loaded({
  page,
  looking,
  typed,
  named,
  manages,
  menu,
  search,
  onLook,
  onType,
  onTurn,
  onMenu,
  onCloseMenu,
  onAdd,
  onOpen,
  onRestore,
}: {
  page: VendorsPage;
  looking: Looking;
  typed: string;
  named: string;
  manages: boolean;
  menu: 'category' | 'filter' | null;
  search: RefObject<HTMLInputElement | null>;
  onLook: (next: Omit<Looking, 'page'>) => void;
  onType: (typed: string) => void;
  onTurn: (page: number) => void;
  onMenu: (menu: 'category' | 'filter') => void;
  onCloseMenu: () => void;
  onAdd: () => void;
  onOpen: (vendor: Vendor) => void;
  onRestore: (vendor: Vendor) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const readerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { page: _page, ...kept } = looking;
  const searching = looking.q.trim() !== '' || looking.category !== 'all';
  const here = looking.view === 'archived' ? page.archived : page.inUse;
  const nothingInUse = page.inUse === 0 && looking.view === 'inUse' && !searching;
  const pages = Math.max(1, Math.ceil(page.total / PAGE_SIZE));
  const from = page.vendors.length === 0 ? 0 : (page.page - 1) * PAGE_SIZE + 1;
  const categoryWord = (key: VendorCategory) => t(`vendors.categories.${key}`);
  const card =
    page.inUse === 0
      ? {
          says: t('vendors.noneYet'),
          line: t('vendors.noneYetLine', { organisation: named }),
          tags: page.archived > 0 ? [t('vendors.archivedCount', { count: page.archived })] : [],
        }
      : {
          says: t('vendors.vendors', { count: page.inUse }),
          line: t('vendors.cardLine', { organisation: named }),
          tags: [
            t('vendors.inUseCount', { count: page.inUse }),
            ...(page.archived > 0 ? [t('vendors.archivedCount', { count: page.archived })] : []),
          ],
        };

  return (
    <>
      <Card>
        {card.tags.length > 0 && (
          <ul className="desk-glass-tags">
            {card.tags.map((tag) => (
              <li key={tag} className="desk-glass">
                {tag}
              </li>
            ))}
          </ul>
        )}
        <div className="desk-said-lines">
          <Says>{card.says}</Says>
          <OnCard>{card.line}</OnCard>
        </div>
        {manages && <CardStep label={t('vendors.add')} onClick={onAdd} />}
      </Card>
      {page.inUse + page.archived > 0 && (
        <>
          <div className="vd-tools">
            <div className="vd-search" role="search">
              <Glyph name="search" size={18} weight={2.2} />
              <input
                ref={search}
                type="search"
                aria-label={t('vendors.search')}
                placeholder={t('vendors.search')}
                value={typed}
                spellCheck={false}
                onChange={(event) => onType(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && typed !== '') {
                    event.preventDefault();
                    onLook({ ...kept, q: '' });
                  }
                }}
              />
              {typed !== '' && (
                <button
                  type="button"
                  className="vd-clear"
                  aria-label={t('vendors.clearSearch')}
                  onClick={() => {
                    onLook({ ...kept, q: '' });
                    search.current?.focus();
                  }}
                >
                  <Glyph name="clear" size={16} weight={2.4} />
                </button>
              )}
            </div>
            <Menu
              items={[
                { key: 'all', word: t('vendors.allCategories'), count: here },
                ...VENDOR_CATEGORIES.map((key) => ({
                  key,
                  word: categoryWord(key),
                  count: page.categories[key],
                })),
              ]}
              picked={looking.category}
              open={menu === 'category'}
              onOpen={() => onMenu('category')}
              onClose={onCloseMenu}
              onPick={(key) => onLook({ ...kept, category: key as VendorCategory | 'all' })}
            />
            <Menu
              items={[
                { key: 'inUse', word: t('vendors.inUse'), count: page.inUse },
                { key: 'archived', word: t('vendors.archived'), count: page.archived },
              ]}
              picked={looking.view}
              open={menu === 'filter'}
              onOpen={() => onMenu('filter')}
              onClose={onCloseMenu}
              onPick={(key) => onLook({ ...kept, view: key as VendorView })}
            />
          </div>
          <p className={searching && page.total > 0 ? 'vd-count' : 'desk-unseen'} role="status">
            {searching && page.total > 0 ? t('vendors.vendors', { count: page.total }) : ''}
          </p>
          {page.total === 0 ? (
            !nothingInUse && (
              <NoMatch
                looking={looking}
                categoryWord={categoryWord}
                onLook={(next) => onLook(next)}
              />
            )
          ) : (
            <>
              <ul className="desk-rows" aria-label={t('vendors.title')}>
                {page.vendors.map((one) => (
                  <li key={one.id}>
                    <VendorRow
                      vendor={one}
                      line={[
                        one.contactName,
                        categoryWord(one.category),
                        one.archivedAt != null
                          ? t('vendors.archivedOn', {
                              date: formatEventDate(one.archivedAt, readerZone, locale, false),
                            })
                          : (one.emailAddress ??
                            (one.phoneNumber == null ? null : formatPhone(one.phoneNumber))),
                      ]
                        .filter((part) => part != null && part !== '')
                        .join(' · ')}
                      manages={manages}
                      onOpen={() => onOpen(one)}
                      onRestore={() => onRestore(one)}
                    />
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <Pager
                  from={from}
                  to={from + page.vendors.length - 1}
                  total={page.total}
                  page={page.page}
                  pages={pages}
                  onTurn={onTurn}
                />
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function Loading() {
  const { t } = useTranslation();

  return (
    <div className="desk-loading" role="status" aria-label={t('vendors.loading')}>
      <span className="desk-unseen">{t('vendors.loading')}</span>
      <span className="desk-sunk is-card" aria-hidden="true" />
      <ul className="desk-rows" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <li key={bar} className="desk-row is-bones">
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar}`} />
              <span className={`desk-sunk is-line b${bar}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="desk-failed" role="alert">
      <h2>{t('vendors.failed')}</h2>
      <p className="desk-line">{t('vendors.failedLine')}</p>
      <TextAction label={t('vendors.tryAgain')} onClick={onRetry} />
    </div>
  );
}

/** What was looked for, and a way back for whichever narrowed it; never the empty directory. */
function NoMatch({
  looking,
  categoryWord,
  onLook,
}: {
  looking: Looking;
  categoryWord: (key: VendorCategory) => string;
  onLook: (next: Omit<Looking, 'page'>) => void;
}) {
  const { t } = useTranslation();
  const { page: _page, ...kept } = looking;
  const typed = looking.q.trim();
  const category = looking.category === 'all' ? null : categoryWord(looking.category);
  const line =
    typed === '' && category == null && looking.view === 'archived'
      ? t('vendors.noneArchived')
      : typed === '' && category != null
        ? t(looking.view === 'archived' ? 'vendors.noneArchivedIn' : 'vendors.noneIn', { category })
        : category == null
          ? t('vendors.noMatch', { typed })
          : t('vendors.noMatchIn', { typed, category });

  return (
    <div className="vd-none" role="status">
      <p className="vd-none-line">{line}</p>
      <div className="vd-none-actions">
        {typed !== '' && (
          <TextAction label={t('vendors.clearSearch')} onClick={() => onLook({ ...kept, q: '' })} />
        )}
        {looking.category !== 'all' && (
          <TextAction
            label={t('vendors.everyCategory')}
            onClick={() => onLook({ ...kept, category: 'all' })}
          />
        )}
      </div>
    </div>
  );
}

/** The name over its contact, category and reach; an archived one is not opened, it is restored. */
function VendorRow({
  vendor,
  line,
  manages,
  onOpen,
  onRestore,
}: {
  vendor: Vendor;
  line: string;
  manages: boolean;
  onOpen: () => void;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  const words = <RowWords title={vendor.name} lines={line === '' ? [] : [line]} />;

  if (vendor.archivedAt != null || !manages)
    return (
      <div className="desk-row">
        {words}
        {vendor.archivedAt != null && manages && (
          <TextAction label={t('vendors.restore')} onClick={onRestore} />
        )}
      </div>
    );

  return (
    <button id={`vendor-${vendor.id}`} type="button" className="desk-row" onClick={onOpen}>
      {words}
      <Chevron />
    </button>
  );
}

function Pager({
  from,
  to,
  total,
  page,
  pages,
  onTurn,
}: {
  from: number;
  to: number;
  total: number;
  page: number;
  pages: number;
  onTurn: (page: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <nav className="vd-pager" aria-label={t('vendors.pages')}>
      <p className="vd-pager-words">{t('vendors.page', { from, to, total })}</p>
      <button
        type="button"
        className="desk-text"
        {...offButton(page === 1)}
        onClick={() => onTurn(page - 1)}
      >
        {t('vendors.previous')}
      </button>
      <button
        type="button"
        className="desk-text"
        {...offButton(page === pages)}
        onClick={() => onTurn(page + 1)}
      >
        {t('vendors.next')}
      </button>
    </nav>
  );
}

const firstProblem = () =>
  window.setTimeout(() => {
    document.querySelector<HTMLElement>('.desk-dialog [aria-invalid="true"]')?.focus();
  }, 0);

/** Add a vendor or Edit vendor: Name and Category, then the optional fields, each checked at the field before anything is sent and again by the API. */
function VendorForm({
  organisationId,
  vendor,
  onClose,
  onSaved,
  onArchived,
}: {
  organisationId: string;
  vendor: Vendor | null;
  onClose: () => void;
  onSaved: (vendor: Vendor, added: boolean) => void;
  onArchived: (vendor: Vendor) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [from] = useState(() => (vendor == null ? BLANK : draftOf(vendor)));
  const [draft, setDraft] = useState<Draft>(from);
  const [problems, setProblems] = useState<Problems>({});
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const name = useRef<HTMLInputElement>(null);
  const toFix = fieldsToFix(problems);

  const set = (field: keyof Draft, value: string) => {
    const next = { ...draft, [field]: value } as Draft;
    const now = draftProblems(next, t);
    const kept: Problems = { ...problems };
    const linked = field === 'country' || field === 'phone' ? ['country', 'phone'] : [field];
    for (const one of linked as (keyof Problems)[]) {
      if (kept[one] == null) continue;
      const line = now[one];
      if (line == null) delete kept[one];
      else kept[one] = line;
    }
    setDraft(next);
    setProblems(kept);
  };
  const refused = (error: unknown) => {
    setBusy(false);
    const found =
      error instanceof ApiError ? refusedAt(error.problem.violations ?? []) : ({} as Problems);
    if (Object.keys(found).length === 0) {
      setFailed(
        error instanceof ApiError && error.code === 'conflict' && error.problem.detail
          ? error.problem.detail
          : t('vendors.failedLine'),
      );
      return;
    }
    setProblems(found);
    firstProblem();
  };
  const save = () => {
    if (busy) return;
    const found = draftProblems(draft, t);
    setProblems(found);
    setFailed(null);
    if (Object.keys(found).length > 0) {
      firstProblem();
      return;
    }
    setBusy(true);
    const sent =
      vendor == null
        ? api.addVendor(organisationId, typedOf(draft))
        : api.editVendor(organisationId, vendor.id, typedOf(draft));
    sent.then((saved) => onSaved(saved, vendor == null), refused);
  };
  const archive = () => {
    if (vendor == null || busy) return;
    setBusy(true);
    api.archiveVendor(organisationId, vendor.id).then(onArchived, refused);
  };
  const dismiss = () => (changed(draft, from) ? setAsking(true) : onClose());
  const field = (key: DraftField, label: string, extra: Partial<TextProps> = {}) => (
    <TextField
      id={`${id}-${key}`}
      label={label}
      value={draft[key]}
      error={problems[key] ?? null}
      onChange={(value) => set(key, value)}
      {...extra}
    />
  );

  return (
    <>
      <Dialog
        title={t(vendor == null ? 'vendors.addTitle' : 'vendors.editTitle')}
        verb={t(busy ? 'vendors.saving' : vendor == null ? 'vendors.addVerb' : 'vendors.saveVerb')}
        on={!busy}
        first={name}
        onDismiss={dismiss}
        onConfirm={save}
      >
        <div className="vd-wide">
          {toFix > 0 && (
            <p className="desk-error vd-to-fix" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {t('vendors.toFix', { count: toFix })}
            </p>
          )}
          {failed != null && (
            <p className="desk-error vd-to-fix" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {failed}
            </p>
          )}
          <div className="vd-columns">
            <div className="desk-fields">
              {field('name', t('vendors.name'), { inputRef: name, autoComplete: 'organization' })}
              <div className="desk-field">
                <label htmlFor={`${id}-category`} className="desk-label">
                  {t('vendors.category')}
                </label>
                <div
                  className={
                    problems.category == null ? 'desk-box vd-select' : 'desk-box vd-select is-wrong'
                  }
                >
                  <select
                    id={`${id}-category`}
                    value={draft.category}
                    aria-invalid={problems.category != null}
                    aria-describedby={
                      problems.category == null ? undefined : `${id}-category-error`
                    }
                    onChange={(event) => set('category', event.target.value)}
                  >
                    <option value="" disabled>
                      {t('vendors.chooseCategory')}
                    </option>
                    {VENDOR_CATEGORIES.map((one) => (
                      <option key={one} value={one}>
                        {t(`vendors.categories.${one}`)}
                      </option>
                    ))}
                  </select>
                  <Glyph name="chevdown" size={18} weight={2.3} />
                </div>
                <Problem id={`${id}-category-error`} line={problems.category} />
              </div>
              {field('contact', t('vendors.contact'), { optional: true, autoComplete: 'name' })}
              {field('note', t('vendors.note'), { optional: true, lines: 4 })}
            </div>
            <div className="desk-fields">
              {field('email', t('vendors.email'), {
                optional: true,
                type: 'email',
                autoComplete: 'email',
              })}
              <PhoneField
                id={id}
                country={draft.country}
                phone={draft.phone}
                countryError={problems.country ?? null}
                phoneError={problems.phone ?? null}
                onCountry={(value) => set('country', value)}
                onPhone={(value) => set('phone', value)}
              />
              {field('website', t('vendors.website'), { optional: true, type: 'url' })}
              {field('address', t('vendors.address'), {
                optional: true,
                lines: 3,
                autoComplete: 'street-address',
              })}
            </div>
          </div>
          {vendor != null && (
            <div className="vd-archive">
              <TextAction label={t('vendors.archive')} onClick={archive} />
            </div>
          )}
        </div>
      </Dialog>
      {asking && (
        <Ask
          title={t(vendor == null ? 'vendors.discardNew' : 'vendors.discardChanges')}
          line={
            vendor == null
              ? t('vendors.discardNewLine')
              : t('vendors.discardChangesLine', { name: vendor.name })
          }
          keep={t('vendors.keepEditing')}
          go={t('vendors.discard')}
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

interface TextProps {
  id: string;
  label: string;
  value: string;
  error: string | null;
  optional?: boolean;
  lines?: number;
  type?: 'text' | 'email' | 'url';
  autoComplete?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
}

function TextField({
  id,
  label,
  value,
  error,
  optional = false,
  lines,
  type = 'text',
  autoComplete,
  inputRef,
  onChange,
}: TextProps) {
  const common = {
    id,
    value,
    autoComplete,
    spellCheck: false,
    'aria-invalid': error != null,
    'aria-describedby': error == null ? undefined : `${id}-error`,
  };

  return (
    <div className="desk-field">
      <Label id={id} label={label} optional={optional} />
      <div
        className={['desk-box', lines != null && 'vd-area', error != null && 'is-wrong']
          .filter(Boolean)
          .join(' ')}
      >
        {lines == null ? (
          <input
            ref={inputRef}
            type={type}
            {...common}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <textarea rows={lines} {...common} onChange={(event) => onChange(event.target.value)} />
        )}
      </div>
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}

/** "Contact name · Optional", as the board writes each optional field's label. */
function Label({ id, label, optional }: { id: string; label: string; optional: boolean }) {
  const { t } = useTranslation();

  return (
    <label htmlFor={id} className="desk-label">
      {label}
      {optional && <span className="vd-optional"> · {t('vendors.optional')}</span>}
    </label>
  );
}

function Problem({ id, line }: { id: string; line: string | null | undefined }): ReactNode {
  return line == null ? null : (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {line}
    </p>
  );
}

/** The country's code beside the number, as Verify phone draws them; any number valid for the country. */
function PhoneField({
  id,
  country,
  phone,
  countryError,
  phoneError,
  onCountry,
  onPhone,
}: {
  id: string;
  country: string;
  phone: string;
  countryError: string | null;
  phoneError: string | null;
  onCountry: (code: string) => void;
  onPhone: (typed: string) => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const countries = useMemo(
    () => countryChoices(locale).filter(({ code }) => callingCode(code) != null),
    [locale],
  );
  const error = countryError ?? phoneError;

  return (
    <div className="desk-field">
      <Label id={`${id}-phone`} label={t('vendors.phone')} optional />
      <div className="account-phone">
        <div
          className={
            countryError == null ? 'desk-box account-country' : 'desk-box account-country is-wrong'
          }
        >
          <span aria-hidden="true">{callingCode(country) ?? t('vendors.country')}</span>
          <Glyph name="chevdown" size={16} weight={2.4} />
          <select
            aria-label={t('vendors.country')}
            value={country}
            aria-invalid={countryError != null}
            onChange={(event) => onCountry(event.target.value)}
          >
            <option value="" disabled>
              {t('vendors.chooseCountry')}
            </option>
            {countries.map((each) => (
              <option key={each.code} value={each.code}>
                {codeChoice(each.code, each.name)}
              </option>
            ))}
          </select>
        </div>
        <div className={phoneError == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={`${id}-phone`}
            type="tel"
            value={phone}
            autoComplete="tel-national"
            aria-invalid={phoneError != null}
            aria-describedby={error == null ? undefined : `${id}-phone-error`}
            onChange={(event) => onPhone(event.target.value)}
          />
        </div>
      </div>
      <Problem id={`${id}-phone-error`} line={error} />
    </div>
  );
}
