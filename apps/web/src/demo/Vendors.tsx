import { callingCode, formattingLocale } from '@soirely/domain';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';

import { offButton } from '../offButton.ts';
import { Glyph } from '../components/Glyph.tsx';
import { focusWhenFree } from '../layers.ts';
import { DemoBell } from './DemoBell.tsx';
import { COUNTRIES, codeChoice } from './rules.ts';
import { type Viewer, settingsPath } from './settings.ts';
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
} from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import {
  BLANK,
  CATEGORIES,
  type Category,
  type Draft,
  type DraftField,
  type Load,
  type Looking,
  type Problems,
  type Vendor,
  type VendorsDialog,
  type View,
  archived,
  changed,
  draftOf,
  draftProblems,
  fieldsToFix,
  inView,
  isLooking,
  noMatchLine,
  paged,
  refusedPhone,
  restored,
  rowLine,
  savedVendor,
  shown,
  vendorsCard,
  vendorsStart,
} from './vendors.ts';
import { CATEGORY_WORDS, VW } from './vendorsWords.ts';
import './account.css';
import './vendors.css';

const BUSY_MS = 900;
const RETRY_MS = 1200;

const STOREFRONT = [
  'M3 9l1.5-5h15L21 9',
  'M3 9a3 3 0 0 0 6 0a3 3 0 0 0 6 0a3 3 0 0 0 6 0',
  'M5 12v8h14v-8',
  'M10 20v-5h4v5',
];

/** #1418's storefront, drawn in the demo for Vendors' tile in the Settings list; the developer moves it into the product's glyphs. */
export function StorefrontGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {STOREFRONT.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** The old address keeps working: Vendors is a section of Settings now (A · Summary first). */
export function VendorsMoved() {
  const { search } = useLocation();

  return <Navigate to={`/demo/settings/vendors${search}`} replace />;
}

/** Settings › Vendors in A · Summary first (Budget-A-Vendors, page e81): the card, the directory, its form, every state, on sample data. */
export function Vendors({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  return viewer.manages ? <Directory state={state} tell={tell} /> : <Refused viewer={viewer} />;
}

function Refused({ viewer }: { viewer: Viewer }) {
  const { t } = useTranslation();

  return (
    <Page>
      <div className="vd-refused" role="alert">
        <h1 className="desk-title" tabIndex={-1}>
          {t('forbidden.title')}
        </h1>
        <Link className="desk-text" to={settingsPath('account', viewer)}>
          <Glyph name="back" size={16} weight={2.4} />
          {VW.backToSettings}
        </Link>
      </div>
    </Page>
  );
}

function Directory({ state, tell }: { state: string; tell: Tell }) {
  const [params] = useSearchParams();
  const [locale] = useState(() => formattingLocale('en', navigator.language));
  const [start] = useState(() => vendorsStart(state, params.get('vendor')));
  const [load, setLoad] = useState<Load | 'retrying'>(start.load);
  const [vendors, setVendors] = useState(start.vendors);
  const [looking, setLooking] = useState<Looking>(start.looking);
  const [page, setPage] = useState(start.page);
  const [menu, setMenu] = useState(start.menu);
  const [dialog, setDialog] = useState<VendorsDialog | null>(start.dialog);
  const [lit, setLit] = useState(start.lit);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (load !== 'retrying') return;
    const timer = setTimeout(() => setLoad('loaded'), RETRY_MS);

    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (start.told != null) tell(start.told);
    if (start.searching) search.current?.focus();
    if (start.lit != null) focusWhenFree(() => document.getElementById(`vendor-${start.lit}`));
  }, [start, tell]);

  const look = (next: Looking) => {
    setLooking(next);
    setPage(1);
    setLit(null);
  };
  const turn = (next: number) => {
    setPage(next);
    document.querySelector<HTMLElement>('.desk-main h1')?.focus();
  };
  const close = useCallback(() => setDialog(null), []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const adding = () => setDialog({ kind: 'add', draft: BLANK, problems: {} });

  if (load !== 'loaded')
    return (
      <Page>
        <TitleRow title={VW.title} bell={<DemoBell tell={tell} />} />
        {load === 'failed' ? <Failed onRetry={() => setLoad('retrying')} /> : <Loading />}
      </Page>
    );

  const card = vendorsCard(vendors);
  const counts: Record<View, number> = {
    inUse: vendors.filter((one) => inView(one, 'inUse')).length,
    archived: vendors.filter((one) => inView(one, 'archived')).length,
  };
  const here = vendors.filter((one) => inView(one, looking.view));
  const rows = shown(vendors, looking);
  const showing = paged(rows, page);
  const searching = isLooking(looking);
  const nothingInUse = counts.inUse === 0 && looking.view === 'inUse' && !searching;

  return (
    <Page>
      <TitleRow title={VW.title} bell={<DemoBell tell={tell} />} />
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
        <CardStep label={VW.add} onClick={adding} />
      </Card>
      {vendors.length > 0 && (
        <>
          <div className="vd-tools">
            <div className="vd-search" role="search">
              <Glyph name="search" size={18} weight={2.2} />
              <input
                ref={search}
                type="search"
                aria-label={VW.search}
                placeholder={VW.search}
                value={looking.q}
                spellCheck={false}
                onChange={(event) => look({ ...looking, q: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && looking.q !== '') {
                    event.preventDefault();
                    look({ ...looking, q: '' });
                  }
                }}
              />
              {looking.q !== '' && (
                <button
                  type="button"
                  className="vd-clear"
                  aria-label={VW.clearSearch}
                  onClick={() => {
                    look({ ...looking, q: '' });
                    search.current?.focus();
                  }}
                >
                  <Glyph name="clear" size={16} weight={2.4} />
                </button>
              )}
            </div>
            <Menu
              items={[
                { key: 'all', word: VW.allCategories, count: here.length },
                ...CATEGORIES.map((key) => ({
                  key,
                  word: CATEGORY_WORDS[key],
                  count: here.filter((one) => one.category === key).length,
                })),
              ]}
              picked={looking.category}
              open={menu === 'category'}
              onOpen={() => setMenu('category')}
              onClose={closeMenu}
              onPick={(key) => look({ ...looking, category: key as Category | 'all' })}
            />
            <Menu
              items={[
                { key: 'inUse', word: VW.inUse, count: counts.inUse },
                { key: 'archived', word: VW.archived, count: counts.archived },
              ]}
              picked={looking.view}
              open={menu === 'filter'}
              onOpen={() => setMenu('filter')}
              onClose={closeMenu}
              onPick={(key) => look({ ...looking, view: key as View })}
            />
          </div>
          <p className={searching && rows.length > 0 ? 'vd-count' : 'desk-unseen'} role="status">
            {searching && rows.length > 0 ? VW.vendors(rows.length) : ''}
          </p>
          {rows.length === 0 ? (
            !nothingInUse && <NoMatch looking={looking} onLooking={look} />
          ) : (
            <>
              <ul className="desk-rows" aria-label={VW.title}>
                {showing.rows.map((one) => (
                  <li key={one.id}>
                    <VendorRow
                      vendor={one}
                      line={rowLine(one, locale)}
                      lit={one.id === lit}
                      onOpen={() =>
                        setDialog({ kind: 'edit', id: one.id, draft: draftOf(one), problems: {} })
                      }
                      onMoveOn={() => setLit(null)}
                      onRestore={() => {
                        setVendors((now) => restored(now, one.id));
                        tell(VW.restored(one.name));
                        document.querySelector<HTMLElement>('.desk-main h1')?.focus();
                      }}
                    />
                  </li>
                ))}
              </ul>
              {showing.pages > 1 && <Pager {...showing} onTurn={turn} />}
            </>
          )}
        </>
      )}
      {dialog != null && (
        <VendorDialogs
          dialog={dialog}
          vendors={vendors}
          onDialog={setDialog}
          onClose={close}
          onSaved={(vendor, added) => {
            setVendors((now) =>
              added ? [...now, vendor] : now.map((one) => (one.id === vendor.id ? vendor : one)),
            );
            close();
            tell(added ? VW.added(vendor.name) : VW.saved(vendor.name));
          }}
          onArchive={(vendor) => {
            setVendors((now) => archived(now, vendor.id));
            setLit(null);
            close();
            tell(VW.archivedToast(vendor.name));
          }}
        />
      )}
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="desk-page">
      <div className="desk-column vd-column">{children}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="desk-loading" role="status" aria-label={VW.loading}>
      <span className="desk-unseen">{VW.loading}</span>
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
  return (
    <div className="desk-failed" role="alert">
      <h2>{VW.failed}</h2>
      <p className="desk-line">{VW.failedLine}</p>
      <TextAction label={VW.tryAgain} onClick={onRetry} />
    </div>
  );
}

/** What was looked for, and a way back for whichever narrowed it; never the empty directory. */
function NoMatch({ looking, onLooking }: { looking: Looking; onLooking: (next: Looking) => void }) {
  return (
    <div className="vd-none" role="status">
      <p className="vd-none-line">{noMatchLine(looking)}</p>
      <div className="vd-none-actions">
        {looking.q.trim() !== '' && (
          <TextAction label={VW.clearSearch} onClick={() => onLooking({ ...looking, q: '' })} />
        )}
        {looking.category !== 'all' && (
          <TextAction
            label={VW.everyCategory}
            onClick={() => onLooking({ ...looking, category: 'all' })}
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
  lit,
  onOpen,
  onMoveOn,
  onRestore,
}: {
  vendor: Vendor;
  line: string;
  lit: boolean;
  onOpen: () => void;
  onMoveOn: () => void;
  onRestore: () => void;
}) {
  const words = <RowWords title={vendor.name} lines={line === '' ? [] : [line]} />;

  if (vendor.archivedOn != null)
    return (
      <div className="desk-row">
        {words}
        <TextAction label={VW.restore} onClick={onRestore} />
      </div>
    );

  return (
    <button
      id={`vendor-${vendor.id}`}
      type="button"
      className={lit ? 'desk-row is-on' : 'desk-row'}
      onClick={onOpen}
      onBlur={(event) => {
        const to = event.relatedTarget;
        if (lit && !(to instanceof Element && to.closest('.desk-layers') != null)) onMoveOn();
      }}
    >
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
  return (
    <nav className="vd-pager" aria-label={VW.pages}>
      <p className="vd-pager-words">{VW.page(from, to, total)}</p>
      <button
        type="button"
        className="desk-text"
        {...offButton(page === 1)}
        onClick={() => onTurn(page - 1)}
      >
        {VW.previous}
      </button>
      <button
        type="button"
        className="desk-text"
        {...offButton(page === pages)}
        onClick={() => onTurn(page + 1)}
      >
        {VW.next}
      </button>
    </nav>
  );
}

function VendorDialogs({
  dialog,
  vendors,
  onDialog,
  onClose,
  onSaved,
  onArchive,
}: {
  dialog: VendorsDialog;
  vendors: readonly Vendor[];
  onDialog: (dialog: VendorsDialog) => void;
  onClose: () => void;
  onSaved: (vendor: Vendor, added: boolean) => void;
  onArchive: (vendor: Vendor) => void;
}) {
  const editing = dialog.kind === 'edit' ? vendors.find((one) => one.id === dialog.id) : undefined;

  return (
    <VendorForm
      key={dialog.kind === 'edit' ? dialog.id : 'add'}
      dialog={dialog}
      vendor={editing}
      onDraft={(draft, problems) => onDialog({ ...dialog, draft, problems })}
      onClose={onClose}
      onSaved={(draft) =>
        onSaved(savedVendor(draft, editing?.id ?? `v${vendors.length + 1}`), editing == null)
      }
      onArchive={() => editing != null && onArchive(editing)}
    />
  );
}

const firstProblem = () =>
  window.setTimeout(() => {
    document.querySelector<HTMLElement>('.desk-dialog [aria-invalid="true"]')?.focus();
  }, 0);

/** A 700 dialog in two columns: Name and Category, then the optional fields, each checked at the field before anything is sent. */
function VendorForm({
  dialog,
  vendor,
  onDraft,
  onClose,
  onSaved,
  onArchive,
}: {
  dialog: VendorsDialog;
  vendor: Vendor | undefined;
  onDraft: (draft: Draft, problems: Problems) => void;
  onClose: () => void;
  onSaved: (draft: Draft) => void;
  onArchive: () => void;
}) {
  const id = useId();
  const { draft, problems } = dialog;
  const [from] = useState(() => (vendor == null ? BLANK : draftOf(vendor)));
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const name = useRef<HTMLInputElement>(null);
  const pending = useRef<number | undefined>(undefined);
  const toFix = fieldsToFix(problems);
  const [refusedAtStart] = useState(toFix > 0);

  useEffect(() => () => window.clearTimeout(pending.current), []);
  useEffect(() => {
    if (refusedAtStart) firstProblem();
  }, [refusedAtStart]);

  const set = (field: keyof Draft, value: string) => {
    const next = { ...draft, [field]: value } as Draft;
    const now = draftProblems(next);
    const kept: Problems = { ...problems };
    const linked = field === 'country' || field === 'phone' ? ['country', 'phone'] : [field];
    for (const one of linked as (keyof Problems)[]) {
      const line = now[one];
      if (kept[one] == null) continue;
      if (line == null) delete kept[one];
      else kept[one] = line;
    }
    onDraft(next, kept);
  };
  const save = () => {
    if (busy) return;
    const found = draftProblems(draft);
    onDraft(draft, found);
    if (Object.keys(found).length > 0) {
      firstProblem();
      return;
    }
    setBusy(true);
    pending.current = window.setTimeout(() => {
      setBusy(false);
      const refused = refusedPhone(draft);
      if (Object.keys(refused).length === 0) {
        onSaved(draft);
        return;
      }
      onDraft(draft, refused);
      firstProblem();
    }, BUSY_MS);
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
        title={vendor == null ? VW.addTitle : VW.editTitle}
        verb={busy ? VW.saving : vendor == null ? VW.addVerb : VW.saveVerb}
        on={!busy}
        first={name}
        onDismiss={dismiss}
        onConfirm={save}
      >
        <div className="vd-wide">
          {toFix > 0 && (
            <p className="desk-error vd-to-fix" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {VW.toFix(toFix)}
            </p>
          )}
          <div className="vd-columns">
            <div className="desk-fields">
              {field('name', VW.name, { inputRef: name, autoComplete: 'organization' })}
              <div className="desk-field">
                <label htmlFor={`${id}-category`} className="desk-label">
                  {VW.category}
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
                      {VW.chooseCategory}
                    </option>
                    {CATEGORIES.map((one) => (
                      <option key={one} value={one}>
                        {CATEGORY_WORDS[one]}
                      </option>
                    ))}
                  </select>
                  <Glyph name="chevdown" size={18} weight={2.3} />
                </div>
                <Problem id={`${id}-category-error`} line={problems.category} />
              </div>
              {field('contact', VW.contact, { optional: true, autoComplete: 'name' })}
              {field('note', VW.note, { optional: true, lines: 4 })}
            </div>
            <div className="desk-fields">
              {field('email', VW.email, { optional: true, type: 'email', autoComplete: 'email' })}
              <PhoneField
                id={id}
                country={draft.country}
                phone={draft.phone}
                countryError={problems.country ?? null}
                phoneError={problems.phone ?? null}
                onCountry={(value) => set('country', value)}
                onPhone={(value) => set('phone', value)}
              />
              {field('website', VW.website, { optional: true, type: 'url' })}
              {field('address', VW.address, {
                optional: true,
                lines: 3,
                autoComplete: 'street-address',
              })}
            </div>
          </div>
          {vendor != null && (
            <div className="vd-archive">
              <TextAction label={VW.archive} onClick={onArchive} />
            </div>
          )}
        </div>
      </Dialog>
      {asking && (
        <Ask
          title={vendor == null ? VW.discardNew : VW.discardChanges}
          line={vendor == null ? VW.discardNewLine : VW.discardChangesLine(vendor.name)}
          keep={VW.keepEditing}
          go={VW.discard}
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
  return (
    <label htmlFor={id} className="desk-label">
      {label}
      {optional && <span className="vd-optional"> · {VW.optional}</span>}
    </label>
  );
}

function Problem({ id, line }: { id: string; line: string | null | undefined }) {
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
  const error = countryError ?? phoneError;

  return (
    <div className="desk-field">
      <Label id={`${id}-phone`} label={VW.phone} optional />
      <div className="account-phone">
        <div
          className={
            countryError == null ? 'desk-box account-country' : 'desk-box account-country is-wrong'
          }
        >
          <span aria-hidden="true">{callingCode(country) ?? VW.country}</span>
          <Glyph name="chevdown" size={16} weight={2.4} />
          <select
            aria-label={VW.country}
            value={country}
            aria-invalid={countryError != null}
            onChange={(event) => onCountry(event.target.value)}
          >
            <option value="" disabled>
              {VW.chooseCountry}
            </option>
            {COUNTRIES.map((each) => (
              <option key={each.code} value={each.code}>
                {codeChoice(each.code)}
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
