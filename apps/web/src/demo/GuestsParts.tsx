import { callingCode } from '@soirely/domain';
import { type ReactNode, type RefObject, useId, useState } from 'react';
import { Link } from 'react-router';

import type { Mesh } from '../mesh.ts';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import {
  GUEST_LANGUAGES,
  type GuestLanguage,
  type GuestsCard,
  type ListRow,
  type NumbersState,
  type Reply,
  type Values,
  countsOf,
  guestsAt,
  languageName,
  sampleGuests,
} from './guests.ts';
import { GGW, type GuestGroup, groupNameOf } from './guestGroups.ts';
import { MOST_AT_ONCE, MW } from './guestsMark.ts';
import { GW, REPLY_WORDS, figure } from './guestsWords.ts';
import { COUNTRIES, codeChoice } from './rules.ts';
import { CardStep, Chevron, Head, RowWords, TextAction } from '../components/SettingsParts.tsx';
import './guests.css';

const PIECES = [1, 2, 3, 4, 5, 6];

const KEBAB: Record<Reply, string> = {
  coming: 'coming',
  notSure: 'not-sure',
  noReply: 'no-reply',
  notComing: 'not-coming',
  held: 'held',
  notYet: 'not-yet',
  walkIn: 'walk-in',
};

/** A reply's mark (replyStates), always beside its word: drawn white on a cover. */
export function ReplyMark({
  reply,
  size = 22,
  cover = false,
}: {
  reply: Reply;
  size?: 16 | 22 | 28;
  cover?: boolean;
}) {
  return (
    <span
      className={`gs-mark is-${KEBAB[reply]} is-${size}${cover ? ' on-cover' : ''}`}
      aria-hidden="true"
    >
      {reply === 'coming' && <Glyph name="tick" size={Math.round(size * 0.66)} weight={3.2} />}
      {reply === 'notComing' && <span className="gs-bar" />}
      {reply === 'notSure' && <Glyph name="question" size={Math.round(size * 0.8)} weight={2.8} />}
      {reply === 'walkIn' && <Door size={Math.round(size * 0.7)} />}
    </span>
  );
}

/** The door the Arrived and Walk-in mark carries (spec §2), drawn here: the shared icons have none. */
function Door({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 21h16" />
      <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21" />
      <path d="M14.5 12.5h.01" />
    </svg>
  );
}

export function MarkLead({ reply }: { reply: Reply }) {
  return (
    <span className="gs-lead">
      <ReplyMark reply={reply} />
    </span>
  );
}

/** The selection bar, one for sc-3776 and sc-46880: the count with its companions, Mark as invited while invites are on, Add to group, Remove from the list, Clear. Each demo passes the actions; one it does not build points to the demo that does. */
export function SelectBar({
  count,
  companions,
  pretend,
  onMark,
  onAdd,
  onRemove,
  onClear,
}: {
  count: number;
  companions: number;
  pretend: number | null;
  onMark: (() => void) | null;
  onAdd: () => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  return (
    <section className="gm-bar" aria-label={MW.bar}>
      <p className="gm-count">
        <strong>{MW.selected(count)}</strong>
        {companions > 0 && <span>{MW.withCompanions(companions)}</span>}
      </p>
      {count > MOST_AT_ONCE && <p className="desk-line gm-narrow">{MW.narrowing}</p>}
      {pretend != null && <p className="desk-note gm-pretend">{MW.pretend(pretend)}</p>}
      <div className="gm-actions">
        {onMark != null && (
          <button type="button" className="gs-pill is-primary" data-focus="mark" onClick={onMark}>
            {MW.markAsInvited}
          </button>
        )}
        <button type="button" className="gs-pill is-secondary" data-focus="add" onClick={onAdd}>
          {MW.addToGroup}
        </button>
        <button
          type="button"
          className="gs-pill is-secondary"
          data-focus="remove"
          onClick={onRemove}
        >
          {MW.remove}
        </button>
        <TextAction label={MW.clear} onClick={onClear} />
      </div>
    </section>
  );
}

/** Says the count when the bar comes up, since the bar itself is not a live region. */
export function SelectedSaid({ count, companions }: { count: number | null; companions: number }) {
  return (
    <p className="visually-hidden" role="status">
      {count != null &&
        [MW.selected(count), companions > 0 ? MW.withCompanions(companions) : '']
          .filter((words) => words !== '')
          .join(', ')}
    </p>
  );
}

/** A guest's row has a box; a companion's has none, since they follow their guest. Without guests.manage, no row has one. */
export function SelectRows({
  rows,
  selected,
  onToggle,
  groups = [],
  manages = true,
}: {
  rows: readonly ListRow[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  groups?: readonly GuestGroup[];
  manages?: boolean;
}) {
  return (
    <ul className="desk-rows gs-rows">
      {rows.map((row) => {
        const group = row.indent ? null : groupNameOf(groups, row.person.guest.group);
        const words = (
          <>
            <MarkLead reply={row.person.reply} />
            <RowWords title={row.person.name} lines={[row.line]} />
            {group != null && (
              <span className="gs-row-tags" aria-hidden="true">
                <span className="gs-tag gg-tag">{group}</span>
              </span>
            )}
          </>
        );
        const label = group == null ? row.label : `${row.label}, ${GGW.inGroup(group)}`;

        return manages && row.person.companion == null ? (
          <li key={row.person.id}>
            <label className="desk-row gs-row gm-row">
              <input
                type="checkbox"
                className="gs-box"
                aria-label={label}
                checked={selected.has(row.person.id)}
                onChange={() => onToggle(row.person.id)}
              />
              {words}
            </label>
          </li>
        ) : (
          <li key={row.person.id} className={row.indent ? 'is-companion' : undefined}>
            <div className="desk-row gs-row gm-row is-companion" aria-label={label}>
              {words}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function IconLead({ name }: { name: GlyphName }) {
  return (
    <span className="gs-lead is-icon" aria-hidden="true">
      <Glyph name={name} size={20} weight={2} />
    </span>
  );
}

/** A card in the event's own Confetti: the Guests card across the page, or the guest's at the head of their column. */
export function Cover({
  mesh,
  size,
  label,
  children,
}: {
  mesh: Mesh;
  size: 'page' | 'guest';
  label?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`ev-card today-cover is-${mesh} gs-card is-${size}`}
      aria-labelledby={label}
    >
      <span className="ev-scrim" aria-hidden="true" />
      {PIECES.map((piece) => (
        <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
      ))}
      <div className="ev-card-inner gs-card-inner">{children}</div>
    </section>
  );
}

function GlassMark({ kind }: { kind: GuestsCard['tags'][number]['kind'] }) {
  if (kind == null) return null;
  if (kind === 'paused')
    return (
      <span className="ev-glass-mark is-paused" aria-hidden="true">
        <span />
        <span />
      </span>
    );

  return <span className={`ev-glass-mark is-${kind}`} aria-hidden="true" />;
}

/** spec §4: the room's sentence, why it matters now, and its one step. */
export function GuestsCardView({
  card,
  mesh,
  step,
  onStep,
}: {
  card: GuestsCard;
  mesh: Mesh;
  step: string | null;
  onStep: () => void;
}) {
  return (
    <Cover mesh={mesh} size="page">
      {card.tags.length > 0 && (
        <ul className="desk-glass-tags">
          {card.tags.map((tag) => (
            <li key={tag.word} className="desk-glass">
              <GlassMark kind={tag.kind} />
              {tag.word}
            </li>
          ))}
        </ul>
      )}
      {card.arrived == null ? (
        <p className="gs-says">{card.says}</p>
      ) : (
        <p className="gs-arrived" role="status" aria-live="polite">
          <span className="gs-arrived-figure">{card.says}</span>
          <span className="gs-arrived-word">{card.arrived}</span>
        </p>
      )}
      {card.line != null && <p className="desk-on-card">{card.line}</p>}
      {step != null && (
        <div className="ev-card-foot">
          <CardStep label={step} onClick={onStep} />
        </div>
      )}
    </Cover>
  );
}

export function OkLine({ children }: { children: ReactNode }) {
  return (
    <p className="gs-ok" role="status">
      <Glyph name="tick" size={17} weight={2.6} />
      {children}
    </p>
  );
}

export function Refused({ children }: { children: ReactNode }) {
  return (
    <p className="desk-error gs-refused" role="alert">
      <Glyph name="alert" size={15} weight={2.2} />
      {children}
    </p>
  );
}

/** The amber panel (duplicates, the 412, replacing a guest's own reply): an alert, its heading takes the focus. */
export function Amber({
  title,
  focusKey,
  children,
}: {
  title: string;
  focusKey: string;
  children: ReactNode;
}) {
  return (
    <div className="gs-amber" role="alert">
      <h3 className="gs-amber-head" tabIndex={-1} data-focus={focusKey}>
        <Glyph name="alert" size={17} weight={2.2} />
        {title}
      </h3>
      {children}
    </div>
  );
}

export function Pill({
  label,
  primary = false,
  tall = false,
  busy = false,
  onClick,
}: {
  label: string;
  primary?: boolean;
  tall?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={['gs-pill', primary ? 'is-primary' : 'is-secondary', tall && 'is-tall']
        .filter(Boolean)
        .join(' ')}
      aria-busy={busy || undefined}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function Pair({ children }: { children: ReactNode }) {
  return <div className="gs-pair">{children}</div>;
}

/** A field as sc-1468 draws it: the label, Optional as a pill, the 52 box, help and the refusal under it. */
export function GuestField({
  label,
  value,
  optional = false,
  error,
  help,
  counter,
  inputRef,
  focusKey,
  type = 'text',
  autoComplete,
  onChange,
}: {
  label: string;
  value: string;
  optional?: boolean;
  error?: string | undefined;
  help?: string;
  counter?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  focusKey: string;
  type?: 'text' | 'email';
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const told = [
    help == null ? null : `${id}-help`,
    counter == null ? null : `${id}-counter`,
    error == null ? null : `${id}-error`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label gs-label">
        {label}
        {optional && <span className="gs-optional">{GW.optional}</span>}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          ref={inputRef}
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          spellCheck={false}
          data-focus={focusKey}
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      {counter != null && (
        <p id={`${id}-counter`} className="desk-help">
          {counter}
        </p>
      )}
    </div>
  );
}

export function PhoneField({
  values,
  error,
  help,
  onChange,
}: {
  values: Values;
  error?: string | undefined;
  help?: string;
  onChange: (next: Partial<Values>) => void;
}) {
  const id = useId();
  const told = [help == null ? null : `${id}-help`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label gs-label">
        {GW.mobileNumber}
        <span className="gs-optional">{GW.optional}</span>
      </label>
      <div className="gs-phone">
        <div className="desk-box gs-country">
          <span aria-hidden="true">{`${values.country} ${callingCode(values.country) ?? ''}`}</span>
          <Glyph name="chevdown" size={15} weight={2.4} />
          <select
            aria-label={GW.country}
            value={values.country}
            onChange={(event) => onChange({ country: event.target.value })}
          >
            {COUNTRIES.map((each) => (
              <option key={each.code} value={each.code}>
                {codeChoice(each.code)}
              </option>
            ))}
          </select>
        </div>
        <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={id}
            type="tel"
            value={values.number}
            autoComplete="tel-national"
            data-focus="number"
            aria-invalid={error != null}
            aria-describedby={told === '' ? undefined : told}
            onChange={(event) => onChange({ number: event.target.value })}
          />
        </div>
      </div>
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
    </div>
  );
}

/** The guest's own choice, under the host's Language: the info mark and the words, never colour alone (sc-3790). */
export function ChoseNote({ chose, id }: { chose: GuestLanguage; id?: string }) {
  return (
    <p id={id} className="gs-chose">
      <Glyph name="info" size={16} weight={2.2} />
      <span>{GW.theyChose(languageName(chose) ?? '')}</span>
    </p>
  );
}

/** sc-3790: Language after the contact fields, optional, Not set first, each language in its own name and lang. */
export function LanguageField({
  value,
  chose,
  onChange,
}: {
  value: GuestLanguage | null;
  chose: GuestLanguage | null;
  onChange: (language: GuestLanguage | null) => void;
}) {
  const id = useId();
  const told = [chose == null ? null : `${id}-chose`, `${id}-help`].filter(Boolean).join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label gs-label">
        {GW.language}
        <span className="gs-optional">{GW.optional}</span>
      </label>
      <div className="desk-box gs-select">
        <span aria-hidden="true">{languageName(value) ?? GW.notSet}</span>
        <Glyph name="chevdown" size={15} weight={2.4} />
        <select
          id={id}
          value={value ?? ''}
          data-focus="language"
          aria-describedby={told}
          onChange={(event) =>
            onChange(GUEST_LANGUAGES.find((one) => one.code === event.target.value)?.code ?? null)
          }
        >
          <option value="">{GW.notSet}</option>
          {GUEST_LANGUAGES.map((one) => (
            <option key={one.code} value={one.code} lang={one.code}>
              {one.name}
            </option>
          ))}
        </select>
      </div>
      {chose != null && <ChoseNote chose={chose} id={`${id}-chose`} />}
      <p id={`${id}-help`} className="desk-help">
        {GW.languageHint}
      </p>
    </div>
  );
}

export function ListBones() {
  return (
    <div className="desk-loading gs-bones" role="status" aria-busy="true">
      <span className="desk-unseen">{GW.loading}</span>
      <span className="desk-sunk gs-bone-card" aria-hidden="true" />
      <span className="desk-sunk gs-bone-field" aria-hidden="true" />
      <ul className="desk-rows gs-rows" aria-hidden="true">
        {[1, 2, 3, 4, 1].map((bone, index) => (
          <li key={index} className="desk-row is-bones">
            <span className="desk-sunk gs-bone-mark" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bone}`} />
              <span className={`desk-sunk is-line b${bone}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GuestBones() {
  return (
    <div className="desk-loading gs-bones" role="status" aria-busy="true">
      <span className="desk-unseen">{GW.loading}</span>
      <span className="desk-sunk gs-bone-guest" aria-hidden="true" />
      <ul className="desk-rows gs-rows" aria-hidden="true">
        {[1, 2, 3].map((bone) => (
          <li key={bone} className="desk-row is-bones">
            <span className="desk-sunk gs-bone-icon" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bone}`} />
              <span className={`desk-sunk is-line b${bone}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const COUNTED = [
  ['invited', 'Invited'],
  ['coming', REPLY_WORDS.coming],
  ['notComing', REPLY_WORDS.notComing],
  ['notSure', REPLY_WORDS.notSure],
  ['noReply', REPLY_WORDS.noReply],
  ['held', REPLY_WORDS.held],
] as const;

/** Overview's guest numbers (sc-3786): exclusive rows that add up to Invited, each opening the guests it counts, then those not yet invited. */
export function GuestNumbers({ eventId, state }: { eventId: string; state: NumbersState | null }) {
  const [loaded, setLoaded] = useState(state !== 'overviewFailed');
  const counts = countsOf(sampleGuests(eventId));
  const loading = state === 'overviewLoading';
  const head = (
    <Head title={<span id="gs-numbers">{GW.title}</span>}>
      <Link className="desk-text" to={guestsAt(eventId)}>
        {GW.openList}
      </Link>
    </Head>
  );

  if (state === 'overviewViewer') return null;
  if (!loaded)
    return (
      <section className="desk-block gs-numbers" aria-labelledby="gs-numbers">
        {head}
        <Refused>{GW.numbersFailed}</Refused>
        <TextAction label={GW.retry} onClick={() => setLoaded(true)} />
      </section>
    );
  if (state === 'overviewNone' || counts.invited === 0)
    return (
      <section className="desk-block gs-numbers" aria-labelledby="gs-numbers">
        <Head title={<span id="gs-numbers">{GW.title}</span>} />
        <p className="gs-none-yet">{GW.noneInvited}</p>
        <Link className="desk-text" to={guestsAt(eventId)}>
          {GW.openList}
        </Link>
      </section>
    );

  return (
    <section
      className="desk-block gs-numbers"
      aria-labelledby="gs-numbers"
      aria-busy={loading || undefined}
    >
      {head}
      <p className="desk-line is-small">{GW.numbersLead(counts.coming, counts.invited)}</p>
      <ul className="desk-rows gs-counts">
        {COUNTED.map(([key, word]) => {
          const lead = key === 'invited' ? <IconLead name="users" /> : <MarkLead reply={key} />;
          const words = <RowWords title={word} lines={key === 'held' ? [GW.heldNumber] : []} />;

          return (
            <li key={key}>
              {loading ? (
                <div className="desk-row gs-count">
                  {lead}
                  {words}
                  <span className="desk-sunk gs-bone-figure" aria-hidden="true" />
                </div>
              ) : (
                <Link
                  className="desk-row gs-count"
                  to={guestsAt(eventId, { filter: key })}
                  aria-label={
                    key === 'invited'
                      ? GW.opensInvited(counts.invited)
                      : GW.opens(counts[key], word)
                  }
                >
                  {lead}
                  {words}
                  <span className="gs-figure">{figure(counts[key])}</span>
                  <Chevron />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {!loading && counts.notYet > 0 && (
        <Link
          className="desk-text gs-not-yet"
          to={guestsAt(eventId, { filter: 'notYet' })}
          aria-label={GW.notYetName(counts.notYet)}
        >
          <ReplyMark reply="notYet" size={16} />
          {GW.notYetLink(counts.notYet)}
          <Glyph name="chevron" size={15} weight={2.4} />
        </Link>
      )}
    </section>
  );
}
