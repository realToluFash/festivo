import type { ServiceTapStep } from '@soirely/api-client';
import {
  type FloorGroup,
  type FloorRead,
  type FloorTable,
  type FloorWord,
  type Freshness,
  type HeldChoice,
  type PlateStage,
  type SentBackReason,
  type ServiceGuestRead,
  type ServicePlateRead,
  type TapRefusal,
  HELD_CHOICES,
  SENT_BACK_REASONS,
  UNDO_MINUTES,
  floorGroups,
  freshnessKey,
  hasFlags,
  refusalKey,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Glyph } from '../../components/Glyph.tsx';
import { useDialogKeys } from '../../dialogFocus.ts';
import { dateLocale } from '../../i18n/index.ts';
import { useFloor } from './useFloor.ts';
import './floor.css';

/** Tablet landscape keeps the list beside the open table; floor.css draws the same width. */
export const FLOOR_WIDE = '(orientation: landscape) and (min-width: 900px)';

type Shape = 'ring' | 'dot' | 'hatched' | 'dashed' | 'grey' | 'filled';

const SHAPE_OF_WORD: Record<FloorWord, Shape> = {
  toServe: 'ring',
  onATray: 'dot',
  waitingOnTheKitchen: 'hatched',
  notHereYet: 'dashed',
  notFiredYet: 'grey',
  served: 'filled',
};

const SHAPE_OF_STAGE: Record<PlateStage, Shape> = {
  toServe: 'ring',
  dishing: 'dot',
  checked: 'dot',
  onItsWay: 'dot',
  served: 'filled',
};

interface SendingBack {
  plate: ServicePlateRead;
  guest: string;
  table: string;
}

interface Undoable {
  subject: string;
  line: string;
  until: Date;
}

function clock(at: Date): string {
  return new Intl.DateTimeFormat(dateLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
}

function seatName(t: TFunction, guest: ServiceGuestRead): string {
  return guest.name ?? t('service.floor.seat', { seat: guest.seat });
}

function itemsOf(t: TFunction, plate: ServicePlateRead): string {
  return plate.items.map((one) => one.name ?? t('service.floor.chefsChoice')).join(', ');
}

function wordSaid(t: TFunction, table: FloorTable): string {
  const word = t(`service.floor.word.${table.word}`);

  return table.earlierCourse == null
    ? word
    : t('service.floor.earlier', { course: table.earlierCourse, word });
}

function openPlates(guest: ServiceGuestRead): ServicePlateRead[] {
  return guest.order == null ? [] : [guest.order, ...guest.order.owed];
}

function useWide(): boolean {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia?.(FLOOR_WIDE);
      query?.addEventListener('change', changed);

      return () => query?.removeEventListener('change', changed);
    },
    () => window.matchMedia?.(FLOOR_WIDE).matches ?? false,
  );
}

/** /floor/:eventId (sc-4021): Floor in a signed-in staff member's browser, as the app draws it. */
export function FloorPage() {
  const { eventId = '' } = useParams();

  return <Floor key={eventId} eventId={eventId} />;
}

function Floor({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const floor = useFloor(eventId);
  const wide = useWide();
  const [open, setOpen] = useState<string | null>(null);
  const [sending, setSending] = useState<SendingBack | null>(null);
  const [undo, setUndo] = useState<Undoable | null>(null);
  const [heard, setHeard] = useState('');
  const [yours, setYours] = useState<{ ids: string[]; moved: string | null } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const read = floor.seen.kind === 'shown' ? floor.seen.floor : null;

  if (read != null) {
    const ids = read.yours.map((one) => one.id);
    if (yours == null) setYours({ ids, moved: null });
    else if (yours.ids.join() !== ids.join()) {
      const joined = read.yours.find((one) => !yours.ids.includes(one.id));
      setYours({
        ids,
        moved:
          joined == null
            ? t('service.floor.noSectionNoLead')
            : t('service.floor.moved', { section: joined.name }),
      });
    }
  }

  useEffect(() => {
    if (undo == null) return;
    const timer = setTimeout(() => setUndo(null), Math.max(0, undo.until.getTime() - Date.now()));

    return () => clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    if (open != null) heading.current?.focus();
  }, [open]);

  if (read == null)
    return (
      <main id="content" className="flr flr-centred">
        <p role="status">
          {floor.seen.kind === 'loading' ? t('service.floor.title') : t('service.floor.loadFailed')}
        </p>
        {floor.seen.kind !== 'loading' && (
          <button type="button" className="flr-button" onClick={floor.retry}>
            {t('service.floor.tryAgain')}
          </button>
        )}
      </main>
    );

  const groups = floorGroups(read, dateLocale());
  const tables = groups.flatMap((g) => (g.kind === 'noSection' ? [] : g.tables));
  const shown = tables.find((one) => one.key === open) ?? (wide ? tables[0] : undefined) ?? null;
  const inFront = !wide && shown != null;
  const keptOn = new Set(floor.kept.map((tap) => tap.path.split('/')[2]));

  const made = (step: ServiceTapStep, plate: ServicePlateRead, line: string) => {
    void floor.tap(step, { plates: { [plate.id]: plate.stage } }).then((ok) => {
      if (!ok) return;
      setUndo({
        subject: plate.id,
        line,
        until: new Date(Date.now() + UNDO_MINUTES * 60_000),
      });
      setHeard(line);
    });
  };
  const closeSheet = (to: HTMLElement | null) => {
    setSending(null);
    to?.focus();
  };

  return (
    <main id="content" className={wide ? 'flr is-wide' : 'flr'}>
      <p className="visually-hidden" role="status">
        {heard}
      </p>
      {!inFront && (
        <div className="flr-list">
          <div className="flr-head">
            <h1>{t('service.floor.title')}</h1>
            <Strip freshness={floor.freshness} />
          </div>
          <p className="flr-moved" role="status">
            {yours?.moved}
          </p>
          <NotSent refusals={floor.notSent} read={read} onDismiss={floor.dismissNotSent} />
          {groups.map((group) => (
            <Group
              key={group.kind === 'yours' ? group.section.id : group.kind}
              group={group}
              current={wide ? (shown?.key ?? null) : null}
              onOpen={setOpen}
            />
          ))}
        </div>
      )}
      {shown != null && (
        <div className="flr-table">
          <TableView
            read={read}
            table={shown}
            wide={wide}
            freshness={floor.freshness}
            keptOn={keptOn}
            heading={heading}
            onClose={() => setOpen(null)}
            onChoose={(order, guest, choice) =>
              made(
                { kind: 'choice', plateId: order.id, choice },
                order,
                t('service.floor.step.choice', { guest, choice: t(`service.choice.${choice}`) }),
              )
            }
            onSendBack={(plate, guest, button) => {
              opener.current = button;
              setSending({ plate, guest, table: shown.name });
            }}
          />
          {undo != null && (
            <div className="flr-undo">
              <div className="flr-undo-words">
                <p className="flr-strong">{undo.line}</p>
                <p>{t('service.floor.undoUntil', { time: clock(undo.until) })}</p>
                {keptOn.has(undo.subject) && <p>{t('service.waitingToSend')}</p>}
              </div>
              <button
                type="button"
                className="flr-button"
                onClick={() => {
                  void floor.tap({ kind: 'undo', subject: undo.subject }, {});
                  setUndo(null);
                  setHeard(t('service.floor.undone'));
                }}
              >
                {t('service.floor.undo')}
              </button>
            </div>
          )}
        </div>
      )}
      {sending != null && (
        <SendBackSheet
          sending={sending}
          lead={read.floorLead}
          onCancel={() => closeSheet(opener.current)}
          onSend={(reason) => {
            made(
              { kind: 'sendBack', plateId: sending.plate.id, reason },
              sending.plate,
              t('service.floor.step.sentBack', {
                guest: sending.guest,
                items: itemsOf(t, sending.plate),
                reason: t(`service.sentBack.${reason}`),
              }),
            );
            closeSheet(heading.current);
          }}
        />
      )}
    </main>
  );
}

function Strip({ freshness }: { freshness: Freshness }) {
  const { t } = useTranslation();
  const asOf = freshness.state === 'notStarted' ? null : freshness.asOf;
  const count = freshness.state === 'noConnection' ? freshness.waiting : 0;

  return (
    <p className={`flr-strip is-${freshness.state}`}>
      {t(freshnessKey(freshness), { time: asOf == null ? '–' : clock(asOf), count })}
    </p>
  );
}

function NotSent({
  refusals,
  read,
  onDismiss,
}: {
  refusals: TapRefusal[];
  read: FloorRead;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  if (refusals.length === 0) return null;
  const guests = read.courses.flatMap((c) => c.tables.flatMap((table) => table.guests));
  const who = (id: string) => {
    const guest = guests.find((one) => one.id === id);

    return guest == null ? '' : seatName(t, guest);
  };

  return (
    <div className="flr-card flr-notsent" role="alert">
      <p className="flr-strong">{t('service.notSent.heading')}</p>
      {refusals.map((refusal, i) => {
        const key = refusalKey(refusal);

        return (
          <p key={i}>
            {key == null
              ? refusal.kind === 'other'
                ? refusal.title
                : ''
              : t(key, {
                  who: 'guestId' in refusal ? who(refusal.guestId) : '',
                  by: 'by' in refusal ? refusal.by : '',
                  item: 'item' in refusal ? refusal.item : '',
                  name: 'name' in refusal ? refusal.name : '',
                  count: UNDO_MINUTES,
                })}
          </p>
        );
      })}
      <button type="button" className="flr-button" onClick={onDismiss}>
        {t('service.floor.dismiss')}
      </button>
    </div>
  );
}

function WordLine({ shape, said }: { shape: Shape; said: string }) {
  return (
    <span className="flr-word">
      <span className={`flr-shape is-${shape}`} aria-hidden="true" />
      <span>{said}</span>
    </span>
  );
}

function FlagWords({ guest }: { guest: ServiceGuestRead }) {
  const { t } = useTranslation();
  const { allergens, allergenOther, diet, dietOther } = guest.flags;
  const words = [
    ...allergens.map((code) => t(`guestNeeds.allergen.${code}`)),
    ...(allergenOther == null ? [] : [allergenOther]),
    ...diet.map((code) => t(`guestNeeds.dietName.${code}`)),
    ...(dietOther == null ? [] : [dietOther]),
  ];

  return words.map((word) => (
    <p key={word} className="flr-flag">
      <Glyph name="alert" size={13} />
      <span>{word}</span>
    </p>
  ));
}

function Group({
  group,
  current,
  onOpen,
}: {
  group: FloorGroup;
  current: string | null;
  onOpen: (key: string) => void;
}) {
  const { t } = useTranslation();

  if (group.kind === 'noSection')
    return (
      <p className="flr-none">
        {group.lead == null
          ? t('service.floor.noSectionNoLead')
          : t('service.floor.noSection', { lead: group.lead })}
      </p>
    );

  return (
    <section className="flr-part">
      <h2>
        {group.kind === 'other'
          ? t('service.floor.other')
          : t('service.floor.yours', { section: group.section.name })}
      </h2>
      <ul className="flr-rows">
        {group.tables.map((table) => (
          <li key={table.key}>
            <Row
              table={table}
              other={group.kind === 'other'}
              current={current === table.key}
              onPress={() => onOpen(table.key)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({
  table,
  other,
  current,
  onPress,
}: {
  table: FloorTable;
  other: boolean;
  current: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const served = t('service.floor.servedCount', { n: table.served, count: table.ordered });
  const covers = t('service.floor.covers', { count: table.covers });
  const said = [
    table.name,
    wordSaid(t, table),
    served,
    covers,
    ...(table.flagged > 0 ? [t('service.floor.flaggedSaid', { count: table.flagged })] : []),
    ...(other && table.section != null ? [table.section.name] : []),
  ].join(', ');

  return (
    <button
      type="button"
      className="flr-row"
      aria-label={said}
      aria-current={current ? 'true' : undefined}
      onClick={onPress}
    >
      <span className="flr-row-lines">
        <span className="flr-wrap">
          <span className="flr-name">{table.name}</span>
          {other && table.section != null && (
            <span className="flr-quiet">{table.section.name}</span>
          )}
        </span>
        <WordLine shape={SHAPE_OF_WORD[table.word]} said={wordSaid(t, table)} />
        <span className="flr-wrap flr-quiet">
          <span>{served}</span>
          <span>{covers}</span>
          {table.flagged > 0 && (
            <span className="flr-flag">
              <Glyph name="alert" size={13} />
              <span>{t('service.floor.flagged', { count: table.flagged })}</span>
            </span>
          )}
        </span>
      </span>
      <Glyph name="chevron" size={20} />
    </button>
  );
}

function stageOf(t: TFunction, guest: ServiceGuestRead): { shape: Shape; said: string } {
  if (guest.order?.held === true) return { shape: 'hatched', said: t('service.held') };
  if (guest.order != null)
    return {
      shape: SHAPE_OF_STAGE[guest.order.stage],
      said: t(`service.stage.${guest.order.stage}`),
    };

  return { shape: 'dashed', said: t(`service.noOrder.${guest.noOrder ?? 'notHereYet'}`) };
}

type Choose = (order: ServicePlateRead, guest: string, choice: HeldChoice) => void;
type SendBackPress = (plate: ServicePlateRead, guest: string, button: HTMLElement) => void;

function TableView({
  read,
  table,
  wide,
  freshness,
  keptOn,
  heading,
  onClose,
  onChoose,
  onSendBack,
}: {
  read: FloorRead;
  table: FloorTable;
  wide: boolean;
  freshness: Freshness;
  keptOn: Set<string | undefined>;
  heading: React.RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  onChoose: Choose;
  onSendBack: SendBackPress;
}) {
  const { t } = useTranslation();
  const course = read.courses.find((one) => one.course.id === table.courseId);
  const flagged = table.read.guests.filter(
    (g) => hasFlags(g) && openPlates(g).some((p) => p.stage !== 'served'),
  );
  const trays = (course?.trays ?? []).filter((tray) => tray.table === table.key && !tray.done);
  const plates = course?.tables.flatMap((one) => one.guests).flatMap(openPlates) ?? [];
  const section = table.section?.name ?? '';
  const Title = wide ? 'h2' : 'h1';

  return (
    <>
      <div className="flr-head">
        {!wide && (
          <button type="button" className="flr-back" onClick={onClose}>
            <Glyph name="back" size={22} />
            <span>{t('service.floor.back')}</span>
          </button>
        )}
        <Title ref={heading} className="flr-title" tabIndex={-1}>
          {table.name}
        </Title>
        <WordLine shape={SHAPE_OF_WORD[table.word]} said={wordSaid(t, table)} />
        <p className="flr-quiet">
          {t('service.floor.header', {
            covers: t('service.floor.covers', { count: table.covers }),
            section,
          })}
        </p>
        <Strip freshness={freshness} />
      </div>
      {flagged.length > 0 && (
        <section className="flr-part">
          <h3>{t('service.floor.flaggedGuests')}</h3>
          {flagged.map((guest) => (
            <div key={guest.id} className="flr-flagged">
              <p className="flr-strong">{seatName(t, guest)}</p>
              <FlagWords guest={guest} />
              {guest.order != null && <p>{itemsOf(t, guest.order)}</p>}
              <WordLine {...stageOf(t, guest)} />
            </div>
          ))}
        </section>
      )}
      {trays.length > 0 && (
        <section className="flr-part">
          <h3>{t('service.floor.trays')}</h3>
          {trays.map((tray) => {
            const stage = plates.find((plate) => plate.trayId === tray.id)?.stage;

            return (
              <p key={tray.id} className="flr-card">
                {t('service.floor.tray', {
                  waiter: tray.waiter.name,
                  plates: t('service.floor.plates', { count: tray.plates.length }),
                  stage: stage == null ? '' : t(`service.stage.${stage}`),
                })}
              </p>
            );
          })}
        </section>
      )}
      <section className="flr-part">
        <h3>{t('service.floor.seats')}</h3>
        <ul className="flr-seats">
          {table.read.guests.map((guest) => (
            <li key={guest.id}>
              <Seat
                guest={guest}
                read={read}
                table={table}
                keptOn={keptOn}
                onChoose={onChoose}
                onSendBack={onSendBack}
              />
            </li>
          ))}
        </ul>
      </section>
      <p className="flr-card flr-strong">
        {table.people.length === 0
          ? t('service.floor.onItNobody', { section })
          : t('service.floor.onIt', {
              section,
              people: table.people.map((one) => one.name).join(', '),
            })}
      </p>
    </>
  );
}

function Seat({
  guest,
  read,
  table,
  keptOn,
  onChoose,
  onSendBack,
}: {
  guest: ServiceGuestRead;
  read: FloorRead;
  table: FloorTable;
  keptOn: Set<string | undefined>;
  onChoose: Choose;
  onSendBack: SendBackPress;
}) {
  const { t } = useTranslation();
  const order = guest.order;
  const name = seatName(t, guest);
  const held = order?.held === true ? order : null;
  const course = read.courses.find((one) => one.course.id === table.courseId);
  const item = (key: string) => course?.items.find((one) => one.key === key);
  const anyReady = order?.items.some((one) => one.state === 'ready') ?? false;
  const readyIn = held?.holding.map((key) => item(key)?.readyIn).find((n) => n != null);
  const sendable = (plate: ServicePlateRead) => table.mayWrite && plate.stage === 'served';
  const owedBack = (order?.owed ?? []).some(
    (plate) => plate.owedReason === 'sentBack' && plate.stage !== 'served',
  );
  const sendBack = (plate: ServicePlateRead) => (
    <button
      type="button"
      className="flr-button"
      onClick={(event) => onSendBack(plate, name, event.currentTarget)}
    >
      {t('service.floor.sendBack')}
    </button>
  );
  const waiting = <span className="flr-chip">{t('service.waitingToSend')}</span>;

  return (
    <div className="flr-seat">
      <span className="flr-badge" aria-hidden="true">
        {guest.seat}
      </span>
      <div className="flr-seat-lines">
        <p className="flr-wrap">
          <span className="flr-strong">{name}</span>
          {guest.name != null && (
            <span className="flr-quiet">{t('service.floor.seat', { seat: guest.seat })}</span>
          )}
        </p>
        <FlagWords guest={guest} />
        {order != null && <p>{itemsOf(t, order)}</p>}
        <WordLine {...stageOf(t, guest)} />
        {held != null && (
          <>
            <p className="flr-quiet">
              {[
                held.holding.map((key) => item(key)?.name ?? key).join(', '),
                ...(readyIn == null ? [] : [t('service.readyIn', { minutes: readyIn })]),
              ].join(' · ')}
            </p>
            {!table.mayWrite && held.choice != null && (
              <p className="flr-strong">{t(`service.choice.${held.choice}`)}</p>
            )}
            {table.mayWrite && (
              <div className="flr-wrap">
                {HELD_CHOICES.filter((choice) => choice !== 'whatsReadyNow' || anyReady).map(
                  (choice) => (
                    <button
                      key={choice}
                      type="button"
                      className="flr-button flr-choice"
                      aria-pressed={held.choice === choice}
                      onClick={() => onChoose(held, name, choice)}
                    >
                      {held.choice === choice && <Glyph name="tick" size={16} />}
                      <span>{t(`service.choice.${choice}`)}</span>
                    </button>
                  ),
                )}
              </div>
            )}
            {keptOn.has(held.id) && waiting}
          </>
        )}
        {order != null && !owedBack && sendable(order) && sendBack(order)}
        {(order?.owed ?? []).map((plate) => {
          const last = plate.sentBack.at(-1);

          return (
            <div key={plate.id} className="flr-owed">
              <p>
                {[
                  ...(plate.courseId === table.courseId
                    ? []
                    : [
                        read.courses.find((c) => c.course.id === plate.courseId)?.course.name ?? '',
                      ]),
                  t(`service.owed.${plate.owedReason ?? 'toFollow'}`),
                  ...(plate.owedReason === 'sentBack' && last != null
                    ? [t(`service.sentBack.${last.reason}`)]
                    : []),
                  itemsOf(t, plate),
                ].join(' · ')}
              </p>
              <p className="flr-wrap">
                <WordLine
                  shape={SHAPE_OF_STAGE[plate.stage]}
                  said={t(`service.stage.${plate.stage}`)}
                />
                {keptOn.has(plate.id) && waiting}
              </p>
              {sendable(plate) && sendBack(plate)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SendBackSheet({
  sending,
  lead,
  onCancel,
  onSend,
}: {
  sending: SendingBack;
  lead: string | null;
  onCancel: () => void;
  onSend: (reason: SentBackReason) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<SentBackReason | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useDialogKeys(dialog, onCancel, false);
  useEffect(() => title.current?.focus(), []);

  return (
    <>
      <div className="flr-scrim" aria-hidden="true" onClick={onCancel} />
      <div
        ref={dialog}
        className="flr-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flr-sheet-title"
      >
        <h2 id="flr-sheet-title" ref={title} tabIndex={-1}>
          {t('service.floor.sendBackTitle', { items: itemsOf(t, sending.plate) })}
        </h2>
        <p className="flr-quiet">
          {t('service.floor.sendBackWho', { guest: sending.guest, table: sending.table })}
        </p>
        <div role="radiogroup" aria-labelledby="flr-sheet-title">
          {SENT_BACK_REASONS.map((one) => (
            <label key={one} className="flr-reason">
              <input
                type="radio"
                name="flr-reason"
                checked={reason === one}
                onChange={() => setReason(one)}
              />
              <span>
                <span className="flr-strong">{t(`service.sentBack.${one}`)}</span>
                {one === 'allergyConcern' && (
                  <span className="flr-quiet flr-reason-hint">
                    {lead == null
                      ? t('service.floor.alertsTheLead')
                      : t('service.floor.alertsLead', { lead })}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        <div className="flr-sheet-actions">
          <button type="button" className="flr-button" onClick={onCancel}>
            {t('service.floor.cancel')}
          </button>
          <button
            type="button"
            className="flr-button flr-primary"
            disabled={reason == null}
            onClick={() => reason != null && onSend(reason)}
          >
            {t('service.floor.sendBack')}
          </button>
        </div>
      </div>
    </>
  );
}
