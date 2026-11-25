import { Link, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { EVENT } from './guest.ts';
import {
  type Card,
  MESHES,
  MESH_JPEGS,
  cardOf,
  cardStateOf,
  guestNameFor,
  headOf,
  meshOf,
  messageFor,
} from './linkCard.ts';
import './linkCard.css';

const SENT_AT = '18:42';
const DOMAIN = 'soirely.app';

/** /demo/link-card (sc-89272): the card a chat app makes from a guest's link, in a WhatsApp chat on the host's phone, beside the head it is made from. */
export function LinkCard() {
  const [params, setParams] = useSearchParams();
  const state = cardStateOf(params.get('state'));
  const mesh = meshOf(params.get('mesh'), EVENT.mesh);
  const card = cardOf(state, mesh);

  function pick(next: string): void {
    setParams((was) => {
      was.set('mesh', next);
      return was;
    });
  }

  return (
    <main id="content" className="lk">
      <header className="lk-head">
        <Link className="lk-back" to="/demo">
          Design demo
        </Link>
        <h1>A guest’s link in a chat</h1>
        <p>
          A chat app fetches the link with no session, no cookies and no JavaScript, and draws its
          card from what the head answers. The card is WhatsApp’s, drawn here at a phone’s width;
          Soirely sends only the head.
        </p>
      </header>
      <div className="lk-row">
        <section className="lk-chat" aria-label="WhatsApp on the host’s phone">
          <p className="lk-chat-top">{guestNameFor(state)}</p>
          <div className="lk-chat-body">
            <Bubble card={card} message={messageFor(state)} />
          </div>
        </section>
        <section className="lk-side" aria-labelledby="lk-answers">
          <h2 id="lk-answers">What the link answers</h2>
          <pre className="lk-code">
            <code>{headOf(card).join('\n')}</code>
          </pre>
          <ul className="lk-notes">
            {notesOf(card).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <div className="lk-demo-only">
            <p className="lk-demo-only-head">Demo only · the four colours, exported once</p>
            <p>Each is a 1200 × 675 JPEG with no words, the colour the guest’s page draws.</p>
            <fieldset className="lk-meshes">
              <legend className="visually-hidden">The event’s colour</legend>
              {MESHES.map((one) => (
                <label key={one} className="lk-mesh">
                  <input
                    type="radio"
                    name="lk-mesh"
                    checked={mesh === one}
                    onChange={() => pick(one)}
                  />
                  <img src={MESH_JPEGS[one]} alt="" width={120} height={68} />
                  <span className="lk-mesh-name">
                    {mesh === one && <Glyph name="tick" size={14} weight={2.8} />}
                    {one}
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
        </section>
      </div>
    </main>
  );
}

function Bubble({ card, message }: { card: Card; message: string }) {
  const at = message.lastIndexOf('https://');
  const words = message.slice(0, at).trimEnd();
  const link = message.slice(at);

  return (
    <div className="lk-bubble">
      <div className="lk-preview" lang={card.lang === 'en' ? undefined : card.lang}>
        {card.picture?.kind === 'colour' && (
          <img className="lk-picture" src={MESH_JPEGS[card.picture.mesh]} alt="" />
        )}
        {card.picture?.kind === 'photo' && (
          <span className="lk-picture lk-photo" aria-hidden="true">
            <Glyph name="photo" size={40} weight={1.6} />
          </span>
        )}
        <div className="lk-preview-words">
          <p className="lk-title">{card.title}</p>
          {card.line != null && <p className="lk-line">{card.line}</p>}
          <p className="lk-domain">{DOMAIN}</p>
        </div>
      </div>
      <p className="lk-message">
        {words !== '' && <>{words} </>}
        <span className="lk-link">{link}</span>
      </p>
      <p className="lk-time">{SENT_AT}</p>
    </div>
  );
}

function notesOf(card: Card): string[] {
  if (!card.opens)
    return [
      'Byte for byte the answer to a made-up token: a replaced link, a removed or erased guest and a deleted event answer the same.',
    ];

  const notes = [
    'The same for every guest of this event in this language. No guest’s name or answer, and no date, time or place.',
  ];

  if (card.line == null && card.picture == null)
    notes.push('Called off or Finished: the name alone, with no line and no picture.');
  else if (card.line == null) notes.push('The event names no hosts, so there is no line.');
  if (card.picture?.kind === 'photo')
    notes.push(
      card.picture.alt == null
        ? 'The photo has no description, so there is no og:image:alt.'
        : 'The host’s photo as a JPEG, cropped to the 16:9 frame they set, at most 300 KB.',
    );
  if (card.picture?.kind === 'colour')
    notes.push(
      `No photo: the ${card.picture.mesh} colour, the one the guest’s page draws for this event. Decorative, so no og:image:alt.`,
    );
  if (card.line != null && card.lang !== 'en')
    notes.push(
      'The guest’s language, not the fetch’s. Only the line is translated; the names are the host’s own.',
    );

  return notes;
}
