import { formattingLocale } from '@soirely/domain';
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router';

import { offButton } from '../offButton.ts';
import { Forbidden } from '../routes/app/Forbidden.tsx';
import { EventsShell } from './EventParts.tsx';
import { Glyph } from './Glyph.tsx';
import { COUNTRIES, codeChoice } from './rules.ts';
import { SIDEBAR_EVENTS, type SettingsSay, settingsSayIn, viewerOf } from './settings.ts';
import { Ask, Chevron, Dialog, Menu, RowWords, TextAction, TitleRow } from './SettingsParts.tsx';
import type { Tell } from './TodayParts.tsx';
import { TodaySidebar } from './TodaySidebar.tsx';
import {
  BLANK,
  CATEGORIES,
  CATEGORY_WORDS,
  type Category,
  type Draft,
  type DraftField,
  type Load,
  type Looking,
  NOT_LOOKING,
  type Problems,
  type Vendor,
  type VendorsDialog,
  type View,
  archived,
  changed,
  draftOf,
  draftProblems,
  inView,
  isLooking,
  noMatchLine,
  paged,
  reachOf,
  restored,
  savedVendor,
  shown,
  vendorsStart,
} from './vendors.ts';
import './account.css';
import './vendors.css';

const BUSY_MS = 900;
const RETRY_MS = 1200;

const VIEWS: readonly View[] = ['inUse', 'archived'];
const VIEW_WORDS: Record<View, string> = { inUse: 'In use', archived: 'Archived' };

/** Vendors at a desk in B Confetti (Vendors.dc.html, page 81): the directory, its form, and every state, on sample data. */
export function Vendors() {
  const [params] = useSearchParams();
  const viewer = viewerOf(params.get('as'));
  const state = params.get('state') ?? '';

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <TodaySidebar events={SIDEBAR_EVENTS} tell={tell} vendors person={viewer} inert={covered} />
      )}
    >
      {(tell) =>
        viewer.manages ? (
          <Directory key={`${viewer.key}:${state}`} state={state} tell={tell} />
        ) : (
          <div className="desk-page">
            <Forbidden />
          </div>
        )
      }
    </EventsShell>
  );
}

function Directory({ state, tell }: { state: string; tell: Tell }) {
  const say = useMemo(() => settingsSayIn(formattingLocale('en', navigator.language)), []);
  const [start] = useState(() => vendorsStart(state));
  const [load, setLoad] = useState<Load | 'retrying'>(start.load);
  const [vendors, setVendors] = useState(start.vendors);
  const [looking, setLooking] = useState<Looking>(start.looking);
  const [page, setPage] = useState(start.page);
  const [menu, setMenu] = useState(start.menu);
  const [dialog, setDialog] = useState<VendorsDialog | null>(start.dialog);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (load !== 'retrying') return;
    const timer = setTimeout(() => setLoad('loaded'), RETRY_MS);

    return () => clearTimeout(timer);
  }, [load]);

  const look = (next: Looking) => {
    setLooking(next);
    setPage(1);
  };
  const turn = (next: number) => {
    setPage(next);
    top.current?.querySelector<HTMLElement>('.desk-title')?.focus();
  };
  const close = useCallback(() => setDialog(null), []);
  const add = (
    <TextAction
      label="Add a vendor"
      before="plus"
      onClick={() => setDialog({ kind: 'add', draft: BLANK, problems: {} })}
    />
  );

  if (load !== 'loaded')
    return (
      <Page>
        <TitleRow title="Vendors" tell={tell} />
        {load === 'failed' ? <Failed onRetry={() => setLoad('retrying')} /> : <Loading />}
      </Page>
    );

  const inViewNow = vendors.filter((one) => inView(one, looking.view));
  const rows = shown(vendors, looking);
  const showing = paged(rows, page);
  const empty = vendors.filter((one) => one.archivedOn == null).length === 0;

  return (
    <Page>
      <div ref={top} className="vd-top">
        <TitleRow title="Vendors" action={add} tell={tell} />
        <p className="desk-line">The people Ire Events buys from, kept once for every event.</p>
      </div>
      {empty && looking.view === 'inUse' && !isLooking(looking) ? (
        <FirstRun
          archived={vendors.length}
          onAdd={() => setDialog({ kind: 'add', draft: BLANK, problems: {} })}
          onArchived={() => look({ ...NOT_LOOKING, view: 'archived' })}
        />
      ) : (
        <>
          <Tabs
            view={looking.view}
            counts={{
              inUse: vendors.filter((one) => one.archivedOn == null).length,
              archived: vendors.filter((one) => one.archivedOn != null).length,
            }}
            onPick={(view) => look({ ...looking, view })}
          />
          <SearchRow
            looking={looking}
            menu={menu}
            inView={inViewNow}
            onMenu={setMenu}
            onLooking={look}
          />
          {rows.length === 0 ? (
            <NoMatch looking={looking} onLooking={look} />
          ) : (
            <section className="desk-block" aria-label={VIEW_WORDS[looking.view]}>
              <ul className="desk-rows vd-rows">
                {showing.rows.map((one) => (
                  <li key={one.id}>
                    <VendorRow
                      vendor={one}
                      say={say}
                      onOpen={() =>
                        setDialog({ kind: 'edit', id: one.id, draft: draftOf(one), problems: {} })
                      }
                      onRestore={() => {
                        setVendors((now) => restored(now, one.id));
                        tell(`${one.name} is back in the directory.`);
                      }}
                    />
                  </li>
                ))}
              </ul>
              <Pager
                from={showing.from}
                to={showing.to}
                total={showing.total}
                page={showing.page}
                pages={showing.pages}
                onTurn={turn}
              />
            </section>
          )}
        </>
      )}
      {dialog != null && (
        <VendorDialogs
          dialog={dialog}
          vendors={vendors}
          onDialog={setDialog}
          onClose={close}
          onSaved={(vendor, adding) => {
            setVendors((now) =>
              adding ? [...now, vendor] : now.map((one) => (one.id === vendor.id ? vendor : one)),
            );
            close();
            tell(adding ? `${vendor.name} is added.` : `${vendor.name} is saved.`);
          }}
          onArchive={(vendor) => {
            setVendors((now) => archived(now, vendor.id));
            close();
            tell(`${vendor.name} is archived. Find it under Archived.`);
          }}
        />
      )}
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="desk-page">
      <div className="ev-column vd-column">{children}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="desk-loading" role="status" aria-label="Loading vendors…">
      <span className="desk-unseen">Loading vendors…</span>
      <ul className="desk-rows" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((bar) => (
          <li key={bar} className="desk-row is-bones">
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar % 4 || 4}`} />
              <span className={`desk-sunk is-line b${bar % 4 || 4}`} />
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
      <h2>We could not load the vendors.</h2>
      <p className="desk-line">Check your connection and try again.</p>
      <TextAction label="Try again" onClick={onRetry} />
    </div>
  );
}

function FirstRun({
  archived: archivedCount,
  onAdd,
  onArchived,
}: {
  archived: number;
  onAdd: () => void;
  onArchived: () => void;
}) {
  return (
    <div className="desk-empty vd-first" role="status">
      <p className="desk-empty-title">No vendors yet</p>
      <p className="desk-line">
        Add the caterers, venues and suppliers Ire Events buys from, so nobody types them twice.
      </p>
      <TextAction label="Add a vendor" before="plus" onClick={onAdd} />
      {archivedCount > 0 && <TextAction label="Show archived" onClick={onArchived} />}
    </div>
  );
}

function Tabs({
  view,
  counts,
  onPick,
}: {
  view: View;
  counts: Record<View, number>;
  onPick: (view: View) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next: View =
      event.key === 'Home'
        ? 'inUse'
        : event.key === 'End'
          ? 'archived'
          : view === 'inUse'
            ? 'archived'
            : 'inUse';
    onPick(next);
    list.current?.querySelector<HTMLElement>(`#vd-tab-${next}`)?.focus();
  };

  return (
    <div ref={list} className="ev-tabs" role="tablist" aria-label="Vendors">
      {VIEWS.map((one) => (
        <button
          key={one}
          id={`vd-tab-${one}`}
          type="button"
          role="tab"
          className="ev-tab"
          aria-selected={one === view}
          tabIndex={one === view ? 0 : -1}
          onClick={() => onPick(one)}
          onKeyDown={keys}
        >
          {one === view && <Glyph name="tick" size={14} weight={2.6} />}
          {VIEW_WORDS[one]}
          <span className="ev-tab-count">{counts[one]}</span>
        </button>
      ))}
    </div>
  );
}

function SearchRow({
  looking,
  menu,
  inView: here,
  onMenu,
  onLooking,
}: {
  looking: Looking;
  menu: boolean;
  inView: readonly Vendor[];
  onMenu: (open: boolean) => void;
  onLooking: (next: Looking) => void;
}) {
  const field = useRef<HTMLInputElement>(null);
  const onClose = useCallback(() => onMenu(false), [onMenu]);
  const items = [
    { key: 'all', word: 'All categories', count: here.length },
    ...CATEGORIES.map((key) => ({
      key,
      word: CATEGORY_WORDS[key],
      count: here.filter((one) => one.category === key).length,
    })),
  ];

  return (
    <div className="ev-search-row">
      <div className="ev-search" role="search">
        <div className="ev-field">
          <Glyph name="search" size={18} weight={2.2} />
          <input
            ref={field}
            type="search"
            aria-label="Search vendors by name"
            placeholder="Search vendors by name"
            value={looking.q}
            spellCheck={false}
            onChange={(event) => onLooking({ ...looking, q: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && looking.q !== '') {
                event.preventDefault();
                onLooking({ ...looking, q: '' });
              }
            }}
          />
          {looking.q !== '' && (
            <button
              type="button"
              className="ev-clear"
              aria-label="Clear the search"
              onClick={() => {
                onLooking({ ...looking, q: '' });
                field.current?.focus();
              }}
            >
              <span className="ev-clear-disc" aria-hidden="true">
                <Glyph name="clear" size={12} weight={3} />
              </span>
            </button>
          )}
        </div>
      </div>
      <Menu
        items={items}
        picked={looking.category}
        open={menu}
        onOpen={() => onMenu(true)}
        onClose={onClose}
        onPick={(key) => onLooking({ ...looking, category: key as Category | 'all' })}
      />
    </div>
  );
}

function NoMatch({ looking, onLooking }: { looking: Looking; onLooking: (next: Looking) => void }) {
  return (
    <div className="ev-none" role="status">
      <h2>No match</h2>
      <p className="desk-line">{noMatchLine(looking)}</p>
      <div className="ev-none-actions">
        {looking.q.trim() !== '' && (
          <TextAction label="Clear the search" onClick={() => onLooking({ ...looking, q: '' })} />
        )}
        {looking.category !== 'all' && (
          <TextAction
            label="Show every category"
            onClick={() => onLooking({ ...looking, category: 'all' })}
          />
        )}
      </div>
    </div>
  );
}

function VendorRow({
  vendor,
  say,
  onOpen,
  onRestore,
}: {
  vendor: Vendor;
  say: SettingsSay;
  onOpen: () => void;
  onRestore: () => void;
}) {
  const reach = reachOf(vendor);
  const words = (
    <>
      <RowWords
        title={vendor.name}
        lines={[vendor.contact === '' ? 'No contact name' : vendor.contact]}
      />
      <span className="vd-cell">{CATEGORY_WORDS[vendor.category]}</span>
      <span className={reach == null ? 'vd-cell is-none' : 'vd-cell'}>
        {reach ?? 'No email or phone'}
      </span>
    </>
  );

  if (vendor.archivedOn != null)
    return (
      <div className="desk-row vd-row is-archived">
        {words}
        <span className="vd-archived">
          <span className="vd-cell">Archived {say.date(vendor.archivedOn)}</span>
          <TextAction label="Restore" onClick={onRestore} />
        </span>
      </div>
    );

  return (
    <button
      type="button"
      className="desk-row vd-row"
      aria-label={`${vendor.name}, ${CATEGORY_WORDS[vendor.category]}`}
      onClick={onOpen}
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
    <nav className="vd-pager" aria-label="Pages">
      <p className="desk-foot" aria-live="polite">
        {from} to {to} of {total}, A to Z
      </p>
      {pages > 1 && (
        <span className="vd-pager-turns">
          <button
            type="button"
            className="desk-text"
            {...offButton(page === 1)}
            onClick={() => onTurn(page - 1)}
          >
            <Glyph name="back" size={16} weight={2.4} />
            Previous
          </button>
          <span className="desk-foot">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className="desk-text"
            {...offButton(page === pages)}
            onClick={() => onTurn(page + 1)}
          >
            Next
            <Glyph name="chevron" size={16} weight={2.4} />
          </button>
        </span>
      )}
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
  onSaved: (vendor: Vendor, adding: boolean) => void;
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

/** Name and Category, then the optional fields: checked at each field before anything is sent. */
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

  useEffect(() => () => window.clearTimeout(pending.current), []);

  const set = (field: keyof Draft, value: string) => {
    const next = { ...draft, [field]: value } as Draft;
    const now = draftProblems(next);
    const kept: Problems = { ...problems };
    const linked = field === 'country' ? ['country', 'phone'] : [field];
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
      const first = document.querySelector<HTMLElement>('.desk-dialog [aria-invalid="true"]');
      window.setTimeout(() => (first ?? name.current)?.focus(), 0);
      return;
    }
    setBusy(true);
    pending.current = window.setTimeout(() => {
      setBusy(false);
      onSaved(draft);
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
        title={vendor == null ? 'Add a vendor' : 'Edit vendor'}
        verb={busy ? 'Saving…' : vendor == null ? 'Add' : 'Save'}
        on={!busy}
        first={name}
        onDismiss={dismiss}
        onConfirm={save}
      >
        <div className="desk-fields">
          {field('name', 'Name', { inputRef: name, autoComplete: 'organization' })}
          <div className="desk-field">
            <label htmlFor={`${id}-category`} className="desk-label">
              Category
            </label>
            <div
              className={
                problems.category == null ? 'desk-box ev-select' : 'desk-box ev-select is-wrong'
              }
            >
              <select
                id={`${id}-category`}
                value={draft.category}
                aria-invalid={problems.category != null}
                aria-describedby={problems.category == null ? undefined : `${id}-category-error`}
                onChange={(event) => set('category', event.target.value)}
              >
                <option value="" disabled>
                  Choose a category
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
          {field('contact', 'Contact name', { optional: true, autoComplete: 'name' })}
          {field('email', 'Email address', {
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
          {field('website', 'Website', {
            optional: true,
            type: 'url',
            help: 'You can leave off https://. It is added when you save.',
          })}
          {field('address', 'Address', {
            optional: true,
            lines: 3,
            autoComplete: 'street-address',
          })}
          {field('note', 'Note', { optional: true, lines: 4 })}
          {vendor != null && (
            <div className="vd-archive">
              <TextAction label="Archive this vendor" onClick={onArchive} />
              <p className="desk-note">
                It leaves the directory at once. You can restore it from Archived at any time.
              </p>
            </div>
          )}
        </div>
      </Dialog>
      {asking && (
        <Ask
          title={vendor == null ? 'Discard this vendor?' : 'Discard your changes?'}
          line={vendor == null ? 'Nothing you typed is saved.' : `${vendor.name} stays as it was.`}
          keep="Keep editing"
          go="Discard"
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
  help?: string;
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
  help,
  lines,
  type = 'text',
  autoComplete,
  inputRef,
  onChange,
}: TextProps) {
  const told = [help == null ? null : `${id}-help`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');
  const common = {
    id,
    value,
    autoComplete,
    spellCheck: false,
    'aria-invalid': error != null,
    'aria-describedby': told === '' ? undefined : told,
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
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}

function Label({ id, label, optional }: { id: string; label: string; optional: boolean }) {
  return optional ? (
    <div className="desk-label-row vd-label-row">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <span className="vd-optional">Optional</span>
    </div>
  ) : (
    <label htmlFor={id} className="desk-label">
      {label}
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

/** The country beside the number, as Verify phone draws them; any number valid for the country. */
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
  const told = [`${id}-phone-help`, error == null ? null : `${id}-phone-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <Label id={`${id}-phone`} label="Phone number" optional />
      <div className="account-phone">
        <div
          className={
            countryError == null ? 'desk-box account-country' : 'desk-box account-country is-wrong'
          }
        >
          <span aria-hidden="true">{country === '' ? 'Country' : codeChoice(country)}</span>
          <Glyph name="chevdown" size={16} weight={2.4} />
          <select
            aria-label="Country"
            value={country}
            aria-invalid={countryError != null}
            onChange={(event) => onCountry(event.target.value)}
          >
            <option value="" disabled>
              Choose a country
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
            aria-describedby={told}
            onChange={(event) => onPhone(event.target.value)}
          />
        </div>
      </div>
      <p id={`${id}-phone-help`} className="desk-help">
        Choose the country code, then type the number any way you like.
      </p>
      <Problem id={`${id}-phone-error`} line={error} />
    </div>
  );
}
