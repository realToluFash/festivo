import { useId } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { GUEST, type Visit, type Words } from './guest.ts';
import {
  added,
  hasStep,
  opened,
  partyLine,
  partyWords,
  placesLeft,
  renamed,
  renaming,
  toggled,
} from './guestCompanions.ts';
import { Filled, Line, TextAction } from './GuestParts.tsx';
import type { PartyActions } from './guestPartyActions.ts';
import './guestCompanions.css';

export function WithYou({
  visit,
  words,
  actions,
}: {
  visit: Visit;
  words: Words;
  actions: PartyActions;
}) {
  const id = useId();
  const { party } = visit;
  const P = partyWords(visit.lang);
  const left = placesLeft(party);
  const busyName = party.tried ? P.typeTheirName : null;

  return (
    <section className="gp-with" aria-labelledby="gp-with-h">
      <TextAction ink icon={<Glyph name="back" size={18} weight={2.2} />} onClick={actions.back}>
        {words.back}
      </TextAction>
      <h2 id="gp-with-h" className="gp-h2 is-24" tabIndex={-1} data-focus="withYouHead">
        {P.title}
      </h2>
      <p className="gp-sub">{P.places(words.hosts, party.places)}</p>
      <ul className="gp-with-rows">
        <li className="gp-with-row is-on">
          <span className="gp-with-words">
            <span className="gp-with-name">{GUEST}</span>
            <span className="gp-with-sub">{P.you}</span>
          </span>
          <span className="gp-with-tag">{P.coming}</span>
        </li>
        {party.people.map((one) => (
          <li key={one.key} className={one.coming ? 'gp-with-row is-on' : 'gp-with-row'}>
            <span className="gp-with-words">
              {party.renaming === one.key ? (
                <span className="gp-with-edit">
                  <label htmlFor={`${id}-rename`} className="gp-with-label">
                    {P.theirName}
                  </label>
                  <input
                    id={`${id}-rename`}
                    className="gp-with-input"
                    type="text"
                    value={party.draft}
                    autoComplete="off"
                    data-focus="renameField"
                    aria-invalid={party.tried}
                    onChange={(event) =>
                      actions.change((was) => ({ ...was, draft: event.target.value, tried: false }))
                    }
                  />
                  <button
                    type="button"
                    className="gp-outlined gp-with-small"
                    onClick={() => actions.change(renamed, `rename-${one.key}`)}
                  >
                    {party.tried ? P.typeTheirName : P.done}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="gp-with-name is-button"
                  aria-label={P.rename(one.name)}
                  data-focus={`rename-${one.key}`}
                  onClick={() => actions.change((was) => renaming(was, one.key), 'renameField')}
                >
                  <span>{one.name}</span>
                  <Line name="pencil" size={15} weight={2.2} />
                </button>
              )}
              <span className="gp-with-sub">
                {one.by === 'invitation' ? P.invitation : P.byYou}
              </span>
            </span>
            <button
              type="button"
              className={one.coming ? 'gp-with-toggle is-on' : 'gp-with-toggle'}
              aria-pressed={one.coming}
              aria-label={P.isComing(one.name)}
              onClick={() => actions.change((was) => toggled(was, one.key))}
            >
              {one.coming && <Glyph name="tick" size={16} weight={2.6} />}
              <span>{one.coming ? P.coming : P.notComing}</span>
            </button>
          </li>
        ))}
      </ul>
      {left > 0 && party.adding == null && (
        <button
          type="button"
          className="gp-outlined"
          data-focus="add"
          onClick={() => actions.change(opened, 'newName')}
        >
          {P.add(left)}
        </button>
      )}
      {left > 0 && party.adding != null && (
        <div className="gp-with-edit is-new">
          <label htmlFor={`${id}-new`} className="gp-with-label">
            {P.theirName}
          </label>
          <input
            id={`${id}-new`}
            className="gp-with-input"
            type="text"
            value={party.adding}
            autoComplete="off"
            data-focus="newName"
            aria-invalid={party.tried}
            onChange={(event) =>
              actions.change((was) => ({ ...was, adding: event.target.value, tried: false }))
            }
          />
          <button
            type="button"
            className="gp-outlined"
            data-focus="addNamed"
            onClick={() => actions.change(added, 'add')}
          >
            {party.tried ? P.typeTheirName : P.add(left)}
          </button>
        </div>
      )}
      <p className="visually-hidden" role="status">
        {busyName}
      </p>
      <Filled focus="withYouNext" onClick={actions.next}>
        {P.next}
      </Filled>
    </section>
  );
}

/** Check and send's row for who is coming, in the kitchen check's own row shape. */
export function PartyCheckRow({
  visit,
  words,
  busy,
  onChange,
}: {
  visit: Visit;
  words: Words;
  busy: boolean;
  onChange: () => void;
}) {
  if (!hasStep(visit.party)) return null;
  const P = partyWords(visit.lang);

  return (
    <div className="gk-row">
      <div className="gk-row-words">
        <p className="gk-label">{P.row}</p>
        <p className="gk-value">{partyLine(visit.party, visit.lang)}</p>
      </div>
      <TextAction off={busy} onClick={onChange}>
        <span className="visually-hidden">{P.change}</span>
        <span aria-hidden="true">{words.changeShort}</span>
      </TextAction>
    </div>
  );
}
