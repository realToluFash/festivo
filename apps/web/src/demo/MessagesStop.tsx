import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { Alert } from '../components/EventPageParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Ask } from '../components/SettingsParts.tsx';
import { offButton } from '../offButton.ts';
import { CLOCK, type GuestId, GUESTS, type MessagesState, READER, isGuest } from './messages.ts';
import { useInbox } from './messagesContext.ts';
import {
  STOP_MS,
  SW,
  type StopEvent,
  type StopFlow,
  letAgainSaid,
  stopFlowAfter,
  stopFlowOf,
  stopGo,
  stopItem,
  stopTitle,
  stoppedLine,
} from './messagesStop.ts';
import { MoreMark } from './MessagesTo.tsx';
import './messagesTo.css';
import './messagesStop.css';

const MOVES = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

/** Stop writing from their page (sc-3978): the head's More actions, its confirm, and the stopped inset under the head. */
export function useStopWriting(
  id: GuestId | 'unknown',
  state: MessagesState | null,
): { more: ReactNode; inset: ReactNode; ask: ReactNode } {
  const { inbox, act, focus, say, to } = useInbox();
  const [flow, setFlow] = useState<StopFlow>(() => stopFlowOf(state));
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const menuId = useId();
  const guestId = isGuest(id) ? id : null;
  const name = guestId == null ? '' : GUESTS[guestId].name;
  const stop = guestId == null ? undefined : inbox.stopped?.[guestId];
  const step = (event: StopEvent) => setFlow((now) => stopFlowAfter(now, event));
  const asking = flow.ask === 'busy';
  const letting = flow.letting === 'busy';

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (!flow.menu) return;

    const keys = (event: KeyboardEvent) => {
      const items = [...(box.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];

      if (MOVES.includes(event.key)) {
        const at = items.indexOf(document.activeElement as HTMLElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;

        event.preventDefault();
        items[next]?.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setFlow((now) => stopFlowAfter(now, 'closeMenu'));
        button.current?.focus();
      } else if (event.key === 'Tab') setFlow((now) => stopFlowAfter(now, 'closeMenu'));
    };
    const outside = (pointer: PointerEvent) => {
      if (!box.current?.contains(pointer.target as Node))
        setFlow((now) => stopFlowAfter(now, 'closeMenu'));
    };

    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [flow.menu]);

  if (guestId == null) return { more: null, inset: null, ask: null };

  function later(then: () => void): void {
    timer.current = window.setTimeout(then, STOP_MS);
  }

  function letGo(): void {
    if (asking || letting || guestId == null) return;
    step('letGo');
    later(() => {
      act({ kind: 'letWrite', id: guestId });
      step('letSaved');
      say(letAgainSaid(name));
      focus('stop-more');
    });
  }

  function stopGoes(): void {
    if (asking || guestId == null) return;
    step('go');
    later(() => {
      act({ kind: 'stop', id: guestId, stop: { by: READER, at: CLOCK } });
      step('stopSaved');
      focus('stop-line');
    });
  }

  const more = to.manage && (
    <div ref={box} className="mgt-more-at">
      <button
        ref={button}
        type="button"
        className="mgt-more"
        aria-label={SW.moreActions}
        aria-haspopup="menu"
        aria-expanded={flow.menu}
        aria-controls={flow.menu ? menuId : undefined}
        data-focus="stop-more"
        onClick={() => {
          if (flow.menu) step('closeMenu');
          else {
            step('openMenu');
            focus('stop-item');
          }
        }}
      >
        <MoreMark />
      </button>
      {flow.menu && (
        <ul
          id={menuId}
          className="mg-pop mgt-menu mgs-menu"
          role="menu"
          aria-label={SW.moreActions}
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="mgt-menu-item"
              data-focus="stop-item"
              onClick={() => {
                button.current?.focus();
                if (stop == null) step('pickStop');
                else letGo();
              }}
            >
              {stopItem(name, stop != null)}
            </button>
          </li>
        </ul>
      )}
    </div>
  );

  const inset = stop != null && (
    <div className="mgs-inset">
      <Glyph name="slash" size={18} weight={2.2} className="mgs-inset-mark" />
      <div className="mgs-inset-words">
        <p className="mgs-inset-line" tabIndex={-1} data-focus="stop-line">
          {stoppedLine(stop)}
        </p>
        {to.manage && (
          <button
            type="button"
            className={letting ? 'desk-text is-busy' : 'desk-text'}
            data-focus="let-again"
            aria-busy={letting || undefined}
            {...offButton(letting, { dim: false })}
            onClick={letGo}
          >
            {letting && <span className="pending-spinner desk-turning" aria-hidden="true" />}
            {SW.letAgain}
          </button>
        )}
        {to.manage && flow.letting === 'failed' && <Alert>{SW.notSaved}</Alert>}
      </div>
    </div>
  );

  const ask = to.manage && flow.ask !== 'closed' && (
    <Ask
      title={stopTitle(name)}
      line={SW.stopLine}
      keep={SW.stopKeep}
      go={stopGo(name)}
      red={false}
      busy={asking ? stopGo(name) : undefined}
      failed={flow.ask === 'failed' ? SW.notSaved : undefined}
      onKeep={() => {
        step('keep');
        focus('stop-more');
      }}
      onGo={stopGoes}
    >
      <span className="mgs-ask" aria-hidden="true" />
    </Ask>
  );

  return { more, inset, ask };
}
