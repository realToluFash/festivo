import { useEffect, useRef, useState } from 'react';
import type { ViewInstance } from 'react-native';

import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import type { OnEvent } from '../people/PeopleSample.ts';
import { Ask, type AskProps } from '../settings/Summary.tsx';
import { AnotherCode, DoorCodeCard, NoCodeCard } from './DoorCodeCard.tsx';
import {
  type CodeForm,
  codeStatus,
  type DoorCode,
  type DoorStart,
  formFrom,
  HUGO,
  madeCode,
  type MakeStart,
  NO_PROBLEMS,
  renewed,
} from './DoorCodeModel.ts';
import { newLine, stopLine, W } from './DoorCodeWords.ts';
import { HoldItUp, SEND_MS } from './HoldItUp.tsx';
import { MakeCode } from './MakeCode.tsx';

interface Making {
  open: boolean;
  visit: number;
  start: MakeStart;
  /** The stopped or ended code a new one takes the place of. */
  replaces: string | null;
}

interface Holding {
  open: boolean;
  visit: number;
  codeId: string;
}

interface Asking {
  kind: 'new' | 'stop';
  codeId: string;
  sending: boolean;
  open: boolean;
  line: string;
}

function freshMake(form: CodeForm): MakeStart {
  return { form, problems: NO_PROBLEMS, endsDraft: null, sending: 'idle', failed: false };
}

/** The door codes on People, under Add: a card each, what is under it, and the screens and Asks they open. */
export function DoorCodes({
  start,
  locale,
  onToast,
  onJoined,
}: {
  start: DoorStart;
  locale: string;
  onToast: (words: string | null) => void;
  onJoined: (person: OnEvent) => void;
}) {
  const [codes, setCodes] = useState(start.codes);
  const [had, setHad] = useState(start.had);
  const [making, setMaking] = useState<Making | null>(
    start.make == null ? null : { open: true, visit: 1, start: start.make, replaces: null },
  );
  const [holding, setHolding] = useState<Holding | null>(
    start.hold == null ? null : { open: true, visit: 1, codeId: start.hold.codeId },
  );
  const [asking, setAsking] = useState<Asking | null>(null);
  const steps = useRef(new Map<string, ViewInstance>());
  const opener = useRef<ScreenReaderTarget | null>(null);
  const firstStep = useRef<ViewInstance>(null);
  useEffect(() => {
    if (asking?.kind !== 'stop' || !asking.sending) return;
    const stopped = setTimeout(() => {
      setCodes((now) =>
        now.map((one) => (one.id === asking.codeId ? { ...one, stopped: true } : one)),
      );
      setAsking({ ...asking, sending: false, open: false });
    }, SEND_MS);

    return () => clearTimeout(stopped);
  }, [asking]);

  function askAbout(kind: Asking['kind'], code: DoorCode): void {
    openerFor(code.id);
    onToast(null);
    const line = kind === 'new' ? newLine(code.code, code.used) : stopLine(code.used);
    setAsking({ kind, codeId: code.id, sending: false, open: true, line });
  }

  function closeAsk(): void {
    setAsking((now) => (now == null || now.sending ? now : { ...now, open: false }));
  }

  function openerFor(id: string | null): void {
    opener.current = id == null ? firstStep.current : (steps.current.get(id) ?? null);
  }

  function openMake(replacing: DoorCode | null): void {
    openerFor(replacing?.id ?? null);
    onToast(null);
    setMaking((was) => ({
      open: true,
      visit: (was?.visit ?? 0) + 1,
      start: freshMake(formFrom(replacing)),
      replaces: replacing?.id ?? null,
    }));
  }

  function made(form: CodeForm): void {
    const code = madeCode(form, had);
    const replaces = making?.replaces ?? null;
    setHad((now) => [...now, code.code]);
    setCodes((now) =>
      replaces == null ? [...now, code] : now.map((one) => (one.id === replaces ? code : one)),
    );
    setMaking((was) => (was == null ? null : { ...was, open: false }));
    onToast(W.made);
  }

  function renew(old: DoorCode): DoorCode {
    const code = renewed(old, had);
    setHad((now) => [...now, code.code]);
    setCodes((now) => now.map((one) => (one.id === old.id ? code : one)));

    return code;
  }

  function makeNew(code: DoorCode): void {
    if (codeStatus(code) === 'full' || codeStatus(code) === 'working') askAbout('new', code);
    else openMake(code);
  }

  function hold(code: DoorCode): void {
    openerFor(code.id);
    onToast(null);
    setHolding((was) => ({ open: true, visit: (was?.visit ?? 0) + 1, codeId: code.id }));
  }

  const asked = asking == null ? null : codes.find((one) => one.id === asking.codeId);
  const ask: AskProps | null =
    asking == null
      ? null
      : asking.kind === 'new'
        ? {
            title: W.newTitle,
            line: asking.line,
            keep: { label: W.keepThis, testID: 'door.new.keep' },
            confirm: { label: W.makeNew, testID: 'door.new.confirm' },
            onKeep: closeAsk,
            onConfirm: () => {
              if (asked != null) renew(asked);
              setAsking({ ...asking, open: false });
              onToast(W.made);
            },
          }
        : {
            title: W.stopTitle,
            line: asking.line,
            keep: { label: W.keepIt, off: asking.sending, testID: 'door.stop.keep' },
            confirm: {
              label: W.stop,
              removes: true,
              busy: asking.sending ? W.stopping : undefined,
              testID: 'door.stop.confirm',
            },
            onKeep: closeAsk,
            onConfirm: () => setAsking({ ...asking, sending: true }),
          };
  const held = holding == null ? null : codes.find((one) => one.id === holding.codeId);

  return (
    <>
      {codes.length === 0 ? (
        <NoCodeCard onMake={() => openMake(null)} stepRef={firstStep} />
      ) : (
        codes.map((code) => (
          <DoorCodeCard
            key={code.id}
            code={code}
            locale={locale}
            stepRef={(node) => {
              if (node == null) steps.current.delete(code.id);
              else steps.current.set(code.id, node);
            }}
            onHold={() => hold(code)}
            onMakeNew={() => makeNew(code)}
            onStop={() => askAbout('stop', code)}
          />
        ))
      )}
      {codes.length > 0 && <AnotherCode onPress={() => openMake(null)} />}
      {ask != null && <Ask open={asking?.open === true} opener={opener} {...ask} />}
      {making != null && (
        <MakeCode
          key={`make-${making.visit}`}
          open={making.open}
          start={making.start}
          locale={locale}
          opener={opener}
          onClose={() => setMaking((was) => (was == null ? null : { ...was, open: false }))}
          onMade={made}
        />
      )}
      {holding != null && held != null && (
        <HoldItUp
          key={`hold-${holding.visit}`}
          open={holding.open}
          code={held}
          start={
            holding.visit === 1 && start.hold != null
              ? start.hold
              : { codeId: held.id, ask: null, stopping: false, failed: false, joins: false }
          }
          locale={locale}
          opener={opener}
          onClose={() => setHolding((was) => (was == null ? null : { ...was, open: false }))}
          onRenew={() => {
            const code = renew(held);
            setHolding((was) => (was == null ? null : { ...was, codeId: code.id }));
          }}
          onStopped={() => {
            setCodes((now) =>
              now.map((one) => (one.id === held.id ? { ...one, stopped: true } : one)),
            );
            setHolding((was) => (was == null ? null : { ...was, open: false }));
          }}
          onJoin={() => {
            setCodes((now) =>
              now.map((one) => (one.id === held.id ? { ...one, used: one.used + 1 } : one)),
            );
            onJoined(HUGO);
          }}
        />
      )}
    </>
  );
}
