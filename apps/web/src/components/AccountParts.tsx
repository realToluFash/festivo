import { type ReactNode, useId } from 'react';

import { Glyph, type GlyphName } from './Glyph.tsx';
import { Card, CardStep, Chevron, Head, OnCard, RowWords } from './SettingsParts.tsx';
import './AccountParts.css';

export type ContactKind = 'email' | 'phone';

/** An address or a number as Your account lists it. */
export interface ContactRow {
  id: string;
  shown: string;
  verified: boolean;
  primary: boolean;
}

const ICONS: Record<ContactKind, GlyphName> = { email: 'mail', phone: 'phone' };

export function primaryFirst<Row extends ContactRow>(rows: readonly Row[]): Row[] {
  return [...rows].sort((one, other) => Number(other.primary) - Number(one.primary));
}

export function Lead({ name }: { name: GlyphName }) {
  return (
    <span className="account-lead" aria-hidden="true">
      <Glyph name={name} size={22} />
    </span>
  );
}

/** You: the disc, the name, the primary address, then what was just done or what is not verified yet. */
export function PersonCard({
  initials,
  name,
  address,
  said,
  step,
  saidRef,
}: {
  initials: string;
  name: string;
  address: string | null;
  said: { text: string; done: boolean } | null;
  step: { label: string; onClick: () => void } | null;
  saidRef?: (line: HTMLParagraphElement | null) => void;
}) {
  return (
    <Card size="person">
      <div>
        <div className="desk-who">
          <span className="desk-disc" aria-hidden="true">
            {initials}
          </span>
          <div className="desk-who-words">
            <p className="desk-name">{name}</p>
            <OnCard>{address}</OnCard>
          </div>
        </div>
        <div aria-live="polite">
          {said != null && (
            <p
              ref={saidRef}
              tabIndex={saidRef == null ? undefined : -1}
              className={said.done ? 'account-said is-done' : 'account-said'}
            >
              {said.done && (
                <span className="desk-mark is-yes account-done" aria-hidden="true">
                  <Glyph name="tick" size={11} weight={3.4} />
                </span>
              )}
              {said.text}
            </p>
          )}
        </div>
      </div>
      {step != null && <CardStep label={step.label} onClick={step.onClick} />}
    </Card>
  );
}

/** A row of About you that opens its dialog. */
export function AboutRow({
  lead,
  title,
  line,
  onOpen,
}: {
  lead: GlyphName;
  title: string;
  line: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <button type="button" className="desk-row account-row" onClick={onOpen}>
        <Lead name={lead} />
        <RowWords title={title} lines={[line]} />
        <Chevron />
      </button>
    </li>
  );
}

/** A section of addresses or numbers: the primary first and still, every other row opening in place under a Violet rule. */
export function ContactsBlock<Row extends ContactRow>({
  kind,
  title,
  add,
  rows,
  open,
  unverified,
  lineOf,
  foot,
  onToggle,
  onAdd,
  offers,
  under,
}: {
  kind: ContactKind;
  title: string;
  /** The add action's words, or null once the section is full. */
  add: string | null;
  rows: readonly Row[];
  open: string | null;
  unverified: string;
  lineOf: (row: Row) => string;
  foot: string;
  onToggle: (row: Row) => void;
  onAdd: () => void;
  /** What an opened row offers, with the line under its actions. */
  offers: (row: Row) => ReactNode;
  /** What stays under a row whether it is open or not: a refusal of what it was asked. */
  under?: (row: Row) => ReactNode;
}) {
  const id = useId();

  return (
    <section className="desk-block">
      <Head title={title}>
        {add != null && (
          <button type="button" className="desk-text" onClick={onAdd}>
            {add}
          </button>
        )}
      </Head>
      <ul className="desk-rows account-rows">
        {primaryFirst(rows).map((row) => {
          const words = (
            <>
              <Lead name={ICONS[kind]} />
              <RowWords
                title={row.shown}
                tag={
                  !row.verified && (
                    <span className="desk-tag is-notyet">
                      <span className="desk-mark is-notyet" aria-hidden="true" />
                      {unverified}
                    </span>
                  )
                }
                lines={[lineOf(row)]}
              />
            </>
          );

          if (row.primary)
            return (
              <li key={row.id} className="desk-row">
                {words}
              </li>
            );

          const on = row.id === open;
          const panel = `${id}-${row.id}`;

          return (
            <li key={row.id}>
              <button
                type="button"
                className={on ? 'desk-row account-row is-open' : 'desk-row account-row'}
                aria-expanded={on}
                aria-controls={on ? panel : undefined}
                onClick={() => onToggle(row)}
              >
                {words}
                <Glyph
                  name={on ? 'chevup' : 'chevdown'}
                  size={18}
                  weight={2.4}
                  className="desk-chevron"
                />
              </button>
              {on && (
                <div id={panel} className="account-open" role="group" aria-label={row.shown}>
                  {offers(row)}
                </div>
              )}
              {under?.(row)}
            </li>
          );
        })}
      </ul>
      <p className="desk-foot">{foot}</p>
    </section>
  );
}

/** An opened row's actions, then the line that says what Remove does. */
export function RowOffers({ line, children }: { line: string; children: ReactNode }) {
  return (
    <>
      <div className="account-acts">{children}</div>
      <p className="desk-note">{line}</p>
    </>
  );
}

/** A spent code, in the field's place: what happened, and what to do. */
export function ExpiredCode({ title, line }: { title: string; line: string }) {
  return (
    <div className="account-expired" role="alert">
      <p className="account-expired-title">{title}</p>
      <p className="desk-line">{line}</p>
    </div>
  );
}
