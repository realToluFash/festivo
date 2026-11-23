import {
  ApiError,
  type EventMenu,
  type EventPicks,
  type HostPick,
  type MenuCourse,
  type MenuDish,
  type OrganisationEvent,
  type PicksCourse,
  type PicksRoomPerson,
  type PicksRow,
} from '@soirely/api-client';
import {
  against,
  clockOf,
  defaultPick,
  defaultedOn,
  dishRuledOut,
  excludedOf,
  goesBackTo,
  hostCount,
  listFormat,
  mealPickName,
  menuCourseOf,
  plateOf,
  showsDefaulted,
  waitingSplit,
} from '@soirely/domain';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { ChildrenTag } from '../menu/VariantParts.tsx';
import { allergensInSentence } from './allergenWords.ts';
import { closeDay } from './menuArea.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './guests.css';
import '../menu/menuLibrary.css';
import './menu.css';
import './seePicks.css';

const POLL_MS = 8000;

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; picks: EventPicks; menu: EventMenu; stale: boolean; refreshing: boolean };

type Opened =
  | { kind: 'chooseFor'; personId: string; courseIds: string[]; from: string; given?: boolean }
  | { kind: 'chooseWho'; courseId: string; row: PicksRow; from: string };

interface Said {
  line: string;
  overridden: string | null;
}

function useAllergens(): (codes: readonly string[]) => string {
  const { t, i18n } = useTranslation();

  return (codes) => allergensInSentence(t, i18n.language, codes);
}

function useList(): (items: readonly string[]) => string {
  const { i18n } = useTranslation();

  return (items) => listFormat(i18n.language, { type: 'conjunction' }).format(items);
}

export function SeePicksArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [tick, setTick] = useState(0);
  const [query] = useSearchParams();
  const waitingFor = query.get('course');

  usePageTitle(pageTitle(t, [t('seePicks.title'), event.name]));

  useEffect(() => {
    let current = true;

    Promise.all([api.menuPicks(event.id), api.menu(event.id)]).then(
      ([picks, menu]) => {
        if (current) setLoad({ kind: 'loaded', picks, menu, stale: false, refreshing: false });
      },
      () => {
        if (!current) return;
        setLoad((was) =>
          was.kind === 'loaded' ? { ...was, stale: true, refreshing: false } : { kind: 'failed' },
        );
      },
    );

    return () => {
      current = false;
    };
  }, [event.id, tick]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLoad((was) => (was.kind === 'loaded' ? { ...was, refreshing: true } : was));
      setTick((n) => n + 1);
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="desk ev desk-page ev-page gs mn mc pk">
      <div className="ev-wide mn-page">
        <Crumbs event={event} />
        {load.kind === 'loaded' ? (
          <Picks
            event={event}
            picks={load.picks}
            menu={load.menu}
            stale={load.stale}
            refreshing={load.refreshing}
            waitingFor={waitingFor}
            onPicks={(picks) =>
              setLoad({ kind: 'loaded', picks, menu: load.menu, stale: false, refreshing: false })
            }
          />
        ) : (
          <>
            <Top event={event} />
            {load.kind === 'loading' ? (
              <div className="lib-loading" aria-busy="true">
                <p className="lib-loading-words" role="status">
                  {t('seePicks.loading')}
                </p>
                {[0, 1, 2].map((one) => (
                  <div key={one} className="lib-bone mc-bone" aria-hidden="true" />
                ))}
              </div>
            ) : (
              <div className="desk-card mc-refusal" role="alert">
                <h2>{t('eventMenu.cannotReach')}</h2>
                <button
                  type="button"
                  className="gs-pill is-primary"
                  onClick={() => {
                    setLoad({ kind: 'loading' });
                    setTick((n) => n + 1);
                  }}
                >
                  {t('eventMenu.tryAgain')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Crumbs({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const at = `/app/events/${encodeURIComponent(event.id)}`;

  return (
    <div className="ev-crumb-row">
      <nav className="ev-crumb" aria-label={t('eventMenu.crumb')}>
        <ol>
          <li className="ev-crumb-part">
            <Link to="/app/events">{t('eventMenu.events')}</Link>
          </li>
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={at}>
              {event.name}
            </Link>
          </li>
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={`${at}/menu`}>
              {t('eventMenu.title')}
            </Link>
          </li>
          <li className="ev-crumb-part" aria-current="page">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <span className="ev-crumb-name">{t('seePicks.title')}</span>
          </li>
        </ol>
      </nav>
      {desk.bell}
    </div>
  );
}

function Top({ event, children }: { event: OrganisationEvent; children?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <header className="gs-top pk-top">
      <div className="mn-head">
        <Link className="desk-text pk-back" to={`/app/events/${encodeURIComponent(event.id)}/menu`}>
          <Glyph name="back" size={16} weight={2.4} />
          {t('seePicks.backToMenu')}
        </Link>
        <h1 className="gs-title">{t('seePicks.title')}</h1>
        {children}
      </div>
    </header>
  );
}

function Picks({
  event,
  picks,
  menu,
  stale,
  refreshing,
  waitingFor,
  onPicks,
}: {
  event: OrganisationEvent;
  picks: EventPicks;
  menu: EventMenu;
  stale: boolean;
  refreshing: boolean;
  waitingFor: string | null;
  onPicks: (picks: EventPicks) => void;
}) {
  const { t } = useTranslation();
  const allergens = useAllergens();
  const list = useList();
  const [opened, setOpened] = useState<Opened | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const manage = picks.canChoose;
  const names = picks.people != null;
  const courseName = (id: string) => picks.courses.find((one) => one.id === id)?.name ?? '';
  const personOf = (id: string) => picks.people?.find((one) => one.id === id);
  const at = clockOf(picks.updatedAt);
  const [askedFor] = useState(waitingFor);

  useEffect(() => {
    if (askedFor == null) return;
    const heading = document.getElementById('pk-waiting-title');
    heading?.scrollIntoView();
    heading?.focus();
  }, [askedFor]);

  const open = (next: Opened) => {
    setSaid(null);
    setOpened(next);
  };
  const close = () => {
    const back = opened?.from;
    setOpened(null);
    requestAnimationFrame(() => {
      if (back != null) document.getElementById(back)?.focus();
    });
  };

  const header = (
    <Top event={event}>
      {picks.room > 0 && (
        <>
          <p className="pk-header">
            {t('seePicks.header', {
              answered: picks.answered,
              room: picks.room,
              percent: picks.percent,
            })}
          </p>
          {stale ? (
            <p className="pk-live is-stale" role="status">
              <Triangle />
              {t('seePicks.stale', { at })}
            </p>
          ) : (
            <p className="pk-live">
              <span>{t('seePicks.live', { at })}</span>
              {refreshing && (
                <span className="lib-refreshing" role="status">
                  <Glyph name="refresh" size={15} weight={2.4} />
                  {t('seePicks.refreshing')}
                </span>
              )}
            </p>
          )}
        </>
      )}
    </Top>
  );

  if (picks.room === 0 && picks.held === 0)
    return (
      <>
        {header}
        <div className="desk-card pk-empty">
          <h2>{t('seePicks.emptyTitle')}</h2>
          <p className="mn-quiet">{t('seePicks.emptyBody')}</p>
          <Link
            className="gs-pill is-primary pk-go"
            to={`/app/events/${encodeURIComponent(event.id)}/guests`}
          >
            {t('seePicks.toGuests')}
          </Link>
        </div>
      </>
    );

  const { never, parties: waiting } = waitingSplit(
    (picks.waiting ?? []).map((party) => ({
      ...party,
      people: party.people.filter(
        (person) =>
          askedFor == null ||
          person.courses.includes(askedFor) ||
          person.changed.some((one) => one.course === askedFor),
      ),
    })),
  );
  const given = picks.given ?? [];
  const givenCount = given.reduce((sum, party) => sum + party.people.length, 0);
  const openWords = (person: (typeof never)[number]) =>
    t('seePicks.notChosenOn', {
      courses: list(
        person.courses.map((id) => {
          const excluded = person.excluded.find((one) => one.course === id);

          return excluded == null
            ? courseName(id)
            : t('seePicks.excludedOn', { course: courseName(id), why: excludedWord(excluded) });
        }),
      ),
    });
  const excludedWord = (excluded: { reason: string }) =>
    excludedOf(excluded.reason) === 'allergy'
      ? t('seePicks.allergy')
      : excludedOf(excluded.reason) === 'other'
        ? t('seePicks.otherDiet')
        : t(`guestNeeds.dietName.${excluded.reason}`);
  const chooseForWaiting = (person: (typeof never)[number], id: string): Opened => {
    const courses = [
      ...person.courses,
      ...person.changed.map((one) => one.course).filter((one) => !person.courses.includes(one)),
    ];

    return {
      kind: 'chooseFor',
      personId: person.id,
      courseIds:
        askedFor == null || !courses.includes(askedFor)
          ? courses
          : [askedFor, ...courses.filter((one) => one !== askedFor)],
      from: id,
    };
  };
  const personLines = (person: (typeof never)[number]) => (
    <>
      {person.courses.length > 0 && (
        <span className="pk-state">
          <DashedCircle />
          {openWords(person)}
        </span>
      )}
      {person.changed.map((one) => (
        <span key={one.course} className="pk-state">
          <Swap />
          {t('seePicks.changedOn', { course: courseName(one.course), dish: one.picked })}
        </span>
      ))}
    </>
  );

  return (
    <>
      {header}
      {picks.held > 0 && (
        <p className="pk-held">{t('seePicks.held', { count: picks.held, room: picks.room })}</p>
      )}
      {names && !manage && <Lock words={t('seePicks.needsManage')} />}
      {!names && <Lock words={t('seePicks.needsRead')} />}
      {picks.allIn && (
        <p className="pk-all-in">
          <Glyph name="tick" size={16} weight={2.6} />
          {t('seePicks.allIn')}
        </p>
      )}
      <div className="pk-said" role="status">
        {said != null && (
          <>
            <p>{said.line}</p>
            {said.overridden != null && <p className="pk-said-override">{said.overridden}</p>}
          </>
        )}
      </div>
      {hostCount(picks) > 0 && (
        <section className="desk-card pk-host" aria-labelledby="pk-host-title">
          <h2 id="pk-host-title" className="pk-card-title">
            <Triangle />
            {t('seePicks.needsHost')}
          </h2>
          <p className="mn-quiet">{t('seePicks.needsHostBody')}</p>
          {picks.needsHost != null ? (
            <ul className="pk-people">
              {picks.needsHost.map((one) => {
                const person = one.person ?? { id: '', name: '' };
                const id = `pk-host-${person.id}-${one.course}`;

                return (
                  <li key={id} className="pk-person">
                    <div className="pk-person-words">
                      <strong>{person.name}</strong>
                      <span>
                        {one.reason === 'nothing'
                          ? t('seePicks.nothingFor', { course: courseName(one.course) })
                          : t('seePicks.allergyFor', {
                              course: courseName(one.course),
                              dish: one.pick ?? '',
                              allergens: allergens(one.allergens),
                            })}
                      </span>
                    </div>
                    {manage && (
                      <ChooseForButton
                        id={id}
                        name={person.name}
                        onOpen={() =>
                          open({
                            kind: 'chooseFor',
                            personId: person.id,
                            courseIds: [one.course],
                            from: id,
                          })
                        }
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="pk-lines">
              {picks.courses
                .filter((course) => course.needsHost > 0)
                .map((course) => (
                  <li key={course.id}>
                    {t('seePicks.hostCount', { course: course.name, count: course.needsHost })}
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}
      {picks.courses.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          menuCourse={menuCourseOf(menu, course.id)}
          manage={manage}
          onChooseWho={(row, from) => open({ kind: 'chooseWho', courseId: course.id, row, from })}
        />
      ))}
      {names && (
        <section className="desk-card pk-waiting" aria-labelledby="pk-waiting-title">
          <h2 id="pk-waiting-title" className="pk-card-title" tabIndex={-1}>
            {askedFor == null
              ? t('seePicks.whoHasnt')
              : t('seePicks.whoHasntOn', { course: courseName(askedFor) })}
          </h2>
          {waiting.length === 0 && never.length === 0 && (
            <p className="mn-quiet">
              {askedFor == null
                ? t('seePicks.whoHasntNone')
                : t('seePicks.whoHasntNoneOn', { course: courseName(askedFor) })}
            </p>
          )}
          {never.length > 0 && (
            <div className="pk-party">
              <h3>{t('seePicks.neverGiven', { count: never.length })}</h3>
              <ul className="pk-people">
                {never.map((person) => {
                  const id = `pk-never-${person.id}`;

                  return (
                    <li key={person.id} className="pk-person">
                      <div className="pk-person-words">
                        <strong>{person.name}</strong>
                        {personLines(person)}
                      </div>
                      {manage && (
                        <ChooseForButton
                          id={id}
                          name={person.name}
                          onOpen={() => open(chooseForWaiting(person, id))}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {waiting.map((party) => (
            <div key={party.id} className="pk-party">
              <h3>{t('seePicks.replied', { name: party.replier, count: party.people.length })}</h3>
              <ul className="pk-people">
                {party.people.map((person) => {
                  const id = `pk-wait-${person.id}`;

                  return (
                    <li key={person.id} className="pk-person">
                      <div className="pk-person-words">
                        <strong>{person.name}</strong>
                        {personLines(person)}
                      </div>
                      {manage && (
                        <ChooseForButton
                          id={id}
                          name={person.name}
                          onOpen={() => open(chooseForWaiting(person, id))}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}
      {names && givenCount > 0 && (
        <section className="desk-card pk-waiting" aria-labelledby="pk-given-title">
          <h2 id="pk-given-title" className="pk-card-title">
            {t('seePicks.given', { count: givenCount })}
          </h2>
          {given.map((party) => (
            <div key={party.id} className="pk-party">
              <h3>{t('seePicks.replied', { name: party.replier, count: party.people.length })}</h3>
              <ul className="pk-people">
                {party.people.map((person) => {
                  const id = `pk-given-${person.id}`;

                  return (
                    <li key={person.id} className="pk-person">
                      <div className="pk-person-words">
                        <strong>{person.name}</strong>
                        {person.courses.map((one) => (
                          <span key={one.course}>
                            {t('seePicks.givenOn', {
                              course: courseName(one.course),
                              pick: defaultPick(menu, one),
                            })}{' '}
                            <span className="pk-default-mark">{t('seePicks.defaultMark')}</span>
                          </span>
                        ))}
                      </div>
                      {manage && (
                        <ChooseForButton
                          id={id}
                          name={person.name}
                          onOpen={() =>
                            open({
                              kind: 'chooseFor',
                              personId: person.id,
                              courseIds: person.courses.map((one) => one.course),
                              from: id,
                              given: true,
                            })
                          }
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}
      {opened?.kind === 'chooseFor' && personOf(opened.personId) != null && (
        <ChooseFor
          eventId={event.id}
          person={personOf(opened.personId) as PicksRoomPerson}
          courses={opened.courseIds
            .map((id) => menuCourseOf(menu, id))
            .filter((one): one is MenuCourse => one != null)}
          given={opened.given === true}
          onSaved={(next, line, overridden) => {
            onPicks(next);
            setSaid({ line, overridden });
          }}
          onClose={close}
        />
      )}
      {opened?.kind === 'chooseWho' && (
        <ChooseWho
          eventId={event.id}
          picks={picks}
          course={picks.courses.find((one) => one.id === opened.courseId) as PicksCourse}
          dish={
            menuCourseOf(menu, opened.courseId)?.dishes.find(
              (one) => one.id === opened.row.dish,
            ) as MenuDish
          }
          row={opened.row}
          onSaved={(next, line, overridden) => {
            onPicks(next);
            setSaid({ line, overridden });
          }}
          onClose={close}
        />
      )}
    </>
  );
}

function Lock({ words }: { words: string }) {
  return (
    <p className="mn-lock">
      <Glyph name="lock" size={16} weight={2.2} />
      {words}
    </p>
  );
}

function ChooseForButton({ id, name, onOpen }: { id: string; name: string; onOpen: () => void }) {
  const { t } = useTranslation();

  return (
    <button
      id={id}
      type="button"
      className="gs-pill is-secondary pk-act"
      aria-label={t('seePicks.chooseForAria', { name })}
      onClick={onOpen}
    >
      {t('seePicks.chooseFor')}
    </button>
  );
}

function CourseCard({
  course,
  menuCourse,
  manage,
  onChooseWho,
}: {
  course: PicksCourse;
  menuCourse: MenuCourse | undefined;
  manage: boolean;
  onChooseWho: (row: PicksRow, from: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const titleId = `pk-course-${course.id}`;
  const options = course.rows.some((row) => row.kind === 'option');
  const defaults = showsDefaulted(course);
  const defaultLine = (() => {
    if (course.default == null || menuCourse == null) return null;
    const pick = defaultPick({ courses: [menuCourse] }, { course: course.id, ...course.default });
    const date = closeDay(`${course.default.chooseBy}T12:00:00Z`, 'UTC', i18n.language);
    if (!course.closed) return t('seePicks.defaultLine', { pick, date });
    const count = defaultedOn(course);

    return count === 0
      ? t('seePicks.defaultLineNobody', { pick, date })
      : t('seePicks.defaultLineGiven', { pick, date, count });
  })();
  const dishName = (id: string | null) => course.rows.find((row) => row.id === id)?.name ?? '';

  return (
    <section className="desk-card pk-course" id={`pk-${course.id}`} aria-labelledby={titleId}>
      <div className="pk-course-head">
        <h2 id={titleId} className="pk-card-title">
          {course.name}
        </h2>
        <p className="pk-answered">
          {t('seePicks.answered', { n: course.answered, room: course.room })}
        </p>
      </div>
      {course.asksNothing && (
        <p className="mn-quiet">
          {t('seePicks.asksNothing', { dish: course.rows[0]?.name ?? '' })}
        </p>
      )}
      {defaultLine != null && <p className="mn-quiet">{defaultLine}</p>}
      <div className="pk-scroll">
        <table className="pk-table">
          <caption className="pk-hidden">{`${course.name} · ${t('seePicks.dish')}`}</caption>
          <thead>
            <tr>
              <th scope="col">{t('seePicks.dish')}</th>
              <th scope="col">{t('seePicks.chosen')}</th>
              {defaults && <th scope="col">{t('seePicks.defaulted')}</th>}
            </tr>
          </thead>
          <tbody>
            {course.rows.map((row) => (
              <tr key={row.id} className={row.kind === 'dish' ? 'pk-dish' : 'pk-inner'}>
                <th scope="row">
                  <div className="pk-row-cell">
                    <span className="pk-row-name">
                      {row.kind === 'variant' && (
                        <span className="pk-prefix">{t('seePicks.variant')}</span>
                      )}
                      {row.kind === 'option' && (
                        <span className="pk-prefix">{t('seePicks.side')}</span>
                      )}
                      {row.name}
                      {row.for === 'children' && <ChildrenTag />}
                    </span>
                    {manage && row.for === 'children' && (
                      <button
                        id={`pk-who-${row.id}`}
                        type="button"
                        className="gs-pill is-secondary pk-act"
                        aria-label={t('seePicks.chooseWhoAria', {
                          variant: row.name,
                          dish: dishName(row.dish),
                        })}
                        onClick={() => onChooseWho(row, `pk-who-${row.id}`)}
                      >
                        {t('seePicks.chooseWho')}
                      </button>
                    )}
                  </div>
                </th>
                <td>{t('seePicks.number', { n: row.chosen })}</td>
                {defaults && <td>{t('seePicks.number', { n: row.defaulted })}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {options && <p className="mn-quiet">{t('seePicks.perPick')}</p>}
      <div className="pk-scroll">
        <table className="pk-table pk-states">
          <caption className="pk-hidden">{`${course.name} · ${t('seePicks.everyoneElse')}`}</caption>
          <thead>
            <tr>
              <th scope="col">{t('seePicks.everyoneElse')}</th>
              <th scope="col">{t('seePicks.people')}</th>
            </tr>
          </thead>
          <tbody>
            <StateRow mark={<Star />} name={t('seePicks.kitchen')} n={course.kitchen} />
            <StateRow mark={<CircleMinus />} name={t('seePicks.skipped')} n={course.skipped} />
            <StateRow mark={<Triangle />} name={t('seePicks.needsHost')} n={course.needsHost} />
            <StateRow mark={<DashedCircle />} name={t('seePicks.none')} n={course.notChosen} />
            {course.menuChanged > 0 && (
              <StateRow mark={<Swap />} name={t('seePicks.changed')} n={course.menuChanged} />
            )}
          </tbody>
          <tfoot>
            <tr className="pk-room">
              <th scope="row">{t('seePicks.theRoom')}</th>
              <td>{t('seePicks.number', { n: course.room })}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {course.menuChanged > 0 && <p className="mn-quiet">{t('seePicks.menuChanged')}</p>}
      {!course.skippable && !course.asksNothing && (
        <p className="mn-quiet">{t('seePicks.noSkip')}</p>
      )}
    </section>
  );
}

function StateRow({ mark, name, n }: { mark: ReactNode; name: string; n: number }) {
  const { t } = useTranslation();

  return (
    <tr>
      <th scope="row">
        <span className="pk-state">
          {mark}
          {name}
        </span>
      </th>
      <td>{t('seePicks.number', { n })}</td>
    </tr>
  );
}

interface Choice {
  dishId: string | 'kitchen' | null;
  variantId: string | null;
  optionIds: string[];
}

const blankChoice: Choice = { dishId: null, variantId: null, optionIds: [] };

function refusedFor(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

function ChooseFor({
  eventId,
  person,
  courses,
  given,
  onSaved,
  onClose,
}: {
  eventId: string;
  person: PicksRoomPerson;
  courses: MenuCourse[];
  given: boolean;
  onSaved: (picks: EventPicks, line: string, overridden: string | null) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const allergens = useAllergens();
  const [at, setAt] = useState(0);
  const startOf = (one: MenuCourse | undefined): Choice =>
    given && one?.default != null
      ? { dishId: one.default.dish, variantId: one.default.variant, optionIds: one.default.options }
      : blankChoice;
  const [choice, setChoice] = useState<Choice>(() => startOf(courses[0]));
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<string[] | null>(null);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  useDialogKeys(box, onClose, false);
  const focusOn = (target: { current: HTMLElement | null }) =>
    requestAnimationFrame(() => target.current?.focus());

  useEffect(() => box.current?.focus(), []);

  const course = courses[at];
  if (course == null) return null;
  const who = person.name;
  const dish = course.dishes.find((one) => one.id === choice.dishId) ?? null;
  const questions = dish?.choices.filter((one) => !one.draft) ?? [];
  const saveLabel = at + 1 < courses.length ? t('seePicks.saveNext') : t('seePicks.save');

  const fail = (words: string, focus: string) => {
    setError(words);
    requestAnimationFrame(() => document.getElementById(focus)?.focus());
  };

  const save = async (confirmed: boolean) => {
    if (busy) return;
    if (choice.dishId == null)
      return fail(
        t('seePicks.blank', { course: course.name.toLocaleLowerCase(i18n.language), name: who }),
        'pk-for-dish',
      );
    if (dish != null && dish.variants.length > 0 && choice.variantId == null)
      return fail(t('seePicks.blankWay', { dish: dish.name, name: who }), 'pk-for-way');
    const unanswered = questions.find(
      (one) => one.required && !one.options.some((option) => choice.optionIds.includes(option.id)),
    );
    if (unanswered != null)
      return fail(
        t('seePicks.blankOption', { question: unanswered.question, name: who }),
        'pk-for-option',
      );
    const ruled =
      dish == null
        ? []
        : against(plateOf(dish, choice.variantId, choice.optionIds), person.allergens);
    if (ruled.length > 0 && !confirmed) {
      setAsking(ruled);
      return;
    }
    setAsking(null);
    const pick: HostPick =
      dish == null
        ? { answer: 'chefsChoice' }
        : {
            answer: 'chosen',
            dish: dish.id,
            variant: choice.variantId,
            options: choice.optionIds,
            anyway: confirmed,
          };
    setBusy(true);
    try {
      const next = await api.chooseForGuest(eventId, person.id, course.id, pick);
      const what =
        dish == null
          ? t('seePicks.kitchen')
          : mealPickName(dish, choice.variantId, choice.optionIds);
      onSaved(
        next,
        t('seePicks.savedFor', { course: course.name, name: who, what }),
        ruled.length > 0
          ? t('seePicks.savedOverride', { name: who, dish: what, allergens: allergens(ruled) })
          : null,
      );
      if (at + 1 < courses.length) {
        setAt(at + 1);
        setChoice(startOf(courses[at + 1]));
        setError(null);
        focusOn(box);
      } else onClose();
    } catch (failure) {
      if (refusedFor(failure)) {
        setRefused(true);
        focusOn(box);
      } else if (failure instanceof ApiError && failure.is('meal_pick_ruled_out'))
        setAsking(failure.problem.people?.[0]?.allergens ?? ruled);
      else {
        setError(t('eventMenu.failedSave', { button: saveLabel }));
        focusOn(saveButton);
      }
    } finally {
      setBusy(false);
    }
  };

  const pickDish = (dishId: string | 'kitchen') => {
    setChoice({ dishId, variantId: null, optionIds: [] });
    setError(null);
  };

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog pk-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pk-for-title"
        tabIndex={-1}
      >
        <div className="dialog-heading">
          <h2 id="pk-for-title">{t('seePicks.choosing', { name: person.name })}</h2>
          <p>{t('seePicks.courseOf', { course: course.name, at: at + 1, all: courses.length })}</p>
        </div>
        {refused ? (
          <p className="pk-refused" role="alert">
            <Triangle />
            {t('seePicks.refused')}
          </p>
        ) : (
          <div className="pk-form">
            <fieldset
              className="pk-field"
              aria-describedby={error != null ? 'pk-for-error' : undefined}
            >
              <legend>{course.name}</legend>
              <div className="pk-options">
                {course.dishes.map((one, index) => (
                  <DishOption
                    key={one.id}
                    id={index === 0 ? 'pk-for-dish' : `pk-for-${one.id}`}
                    name="pk-for-dish"
                    label={one.name}
                    checked={choice.dishId === one.id}
                    ruled={dishRuledOut(one, person)}
                    who={who}
                    onPick={() => pickDish(one.id)}
                  />
                ))}
                <DishOption
                  id="pk-for-kitchen"
                  name="pk-for-dish"
                  label={t('seePicks.kitchenChoose')}
                  checked={choice.dishId === 'kitchen'}
                  ruled={[]}
                  who={who}
                  onPick={() => pickDish('kitchen')}
                />
              </div>
            </fieldset>
            {dish != null && dish.variants.length > 0 && (
              <fieldset className="pk-field">
                <legend>{t('seePicks.whichWay', { dish: dish.name })}</legend>
                <div className="pk-options">
                  {dish.variants.map((variant, index) => (
                    <DishOption
                      key={variant.id}
                      id={index === 0 ? 'pk-for-way' : `pk-for-${variant.id}`}
                      name="pk-for-way"
                      label={variant.name}
                      childrenOnly={variant.for === 'children'}
                      checked={choice.variantId === variant.id}
                      ruled={against(variant.allergens, person.allergens)}
                      who={who}
                      onPick={() => {
                        setChoice({ ...choice, variantId: variant.id });
                        setError(null);
                      }}
                    />
                  ))}
                </div>
              </fieldset>
            )}
            {questions.map((one) => (
              <fieldset key={one.id} className="pk-field">
                <legend>{one.question}</legend>
                <div className="pk-options">
                  {one.options.map((option, index) => (
                    <DishOption
                      key={option.id}
                      id={index === 0 ? 'pk-for-option' : `pk-for-${option.id}`}
                      name={`pk-for-${one.id}`}
                      label={option.name}
                      checked={choice.optionIds.includes(option.id)}
                      ruled={against(option.allergens, person.allergens)}
                      who={who}
                      onPick={() => {
                        setChoice({
                          ...choice,
                          optionIds: [
                            ...choice.optionIds.filter(
                              (id) => !one.options.some((other) => other.id === id),
                            ),
                            option.id,
                          ],
                        });
                        setError(null);
                      }}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
            {error != null && (
              <p id="pk-for-error" className="pk-error" role="alert">
                <span className="pk-error-mark" aria-hidden="true">
                  !
                </span>
                {error}
              </p>
            )}
          </div>
        )}
        <div className="dialog-actions">
          {refused ? (
            <button type="button" className="gs-pill is-secondary" onClick={onClose}>
              {t('seePicks.close')}
            </button>
          ) : (
            <>
              <button type="button" className="desk-text pk-text" onClick={onClose}>
                {t('seePicks.cancel')}
              </button>
              <button
                ref={saveButton}
                type="button"
                className="gs-pill is-primary"
                aria-disabled={busy}
                onClick={() => void save(false)}
              >
                {saveLabel}
              </button>
            </>
          )}
        </div>
      </div>
      {asking != null && dish != null && (
        <Override
          title={t('seePicks.overrideTitle', { name: who, allergens: allergens(asking) })}
          body={t('seePicks.overrideBody', {
            dish: mealPickName(dish, choice.variantId, choice.optionIds),
            allergens: allergens(asking),
            name: who,
          })}
          keep={t('seePicks.chooseAnother')}
          go={t('seePicks.pickAnyway')}
          onKeep={() => {
            setAsking(null);
            requestAnimationFrame(() => document.getElementById('pk-for-dish')?.focus());
          }}
          onGo={() => void save(true)}
        />
      )}
    </>
  );
}

function DishOption({
  id,
  name,
  label,
  checked,
  ruled,
  who,
  childrenOnly = false,
  onPick,
}: {
  id: string;
  name: string;
  label: string;
  checked: boolean;
  ruled: readonly string[];
  who: string;
  childrenOnly?: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  const allergens = useAllergens();
  const out = ruled.length > 0;

  return (
    <label className={checked ? 'pk-option is-checked' : 'pk-option'}>
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        aria-describedby={out ? `${id}-ruled` : undefined}
        onChange={onPick}
      />
      <span className="pk-option-words">
        <span className="pk-option-name">
          {label}
          {childrenOnly && <ChildrenTag />}
        </span>
        {out && (
          <span id={`${id}-ruled`} className="pk-allergy">
            <span className="pk-allergy-mark">
              <Triangle />
              {t('seePicks.allergyMark')}
            </span>
            {t('seePicks.ruledOut', { allergens: allergens(ruled), name: who })}
          </span>
        )}
      </span>
    </label>
  );
}

function Override({
  title,
  body,
  keep,
  go,
  onKeep,
  onGo,
}: {
  title: string;
  body: string;
  keep: string;
  go: string;
  onKeep: () => void;
  onGo: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  useDialogKeys(box, onKeep, false);
  useEffect(() => keepButton.current?.focus(), []);

  return (
    <>
      <div className="dialog-scrim pk-over-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog pk-over"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pk-over-title"
        aria-describedby="pk-over-body"
      >
        <div className="dialog-heading">
          <h2 id="pk-over-title">{title}</h2>
          <p id="pk-over-body">{body}</p>
        </div>
        <div className="dialog-actions">
          <button ref={keepButton} type="button" className="gs-pill is-primary" onClick={onKeep}>
            {keep}
          </button>
          <button type="button" className="gs-pill is-secondary" onClick={onGo}>
            {go}
          </button>
        </div>
      </div>
    </>
  );
}

function ChooseWho({
  eventId,
  picks,
  course,
  dish,
  row,
  onSaved,
  onClose,
}: {
  eventId: string;
  picks: EventPicks;
  course: PicksCourse;
  dish: MenuDish | undefined;
  row: PicksRow;
  onSaved: (picks: EventPicks, line: string, overridden: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const allergens = useAllergens();
  const list = useList();
  const people = picks.people ?? [];
  const holders = row.holders ?? [];
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(holders));
  const [asking, setAsking] = useState<PicksRoomPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  useDialogKeys(box, onClose, false);
  const focusOn = (target: { current: HTMLElement | null }) =>
    requestAnimationFrame(() => target.current?.focus());

  useEffect(() => box.current?.focus(), []);

  const dishName = dish?.name ?? '';
  const ruledFor = (person: PicksRoomPerson) => against(row.allergens, person.allergens);
  const goesBack = (person: PicksRoomPerson): string => {
    const to = goesBackTo(course, dish, person);
    if (to.kind === 'notChosen') return t('seePicks.goesBackNone');

    return t('seePicks.goesBack', {
      to: to.kind === 'needsHost' ? t('seePicks.needsHost') : to.name,
    });
  };

  const save = async (confirmed: boolean) => {
    if (busy) return;
    const ruled = people.filter(
      (one) => ticked.has(one.id) && !holders.includes(one.id) && ruledFor(one).length > 0,
    );
    if (ruled.length > 0 && !confirmed) {
      setAsking(ruled);
      return;
    }
    setAsking(null);
    setError(null);
    setBusy(true);
    try {
      const next = await api.giveVariant(eventId, row.id, [...ticked], confirmed);
      onSaved(
        next,
        t('seePicks.whoSaved', { variant: row.name, dish: dishName, count: ticked.size }),
        ruled.length > 0
          ? t('seePicks.whoOverride', { names: list(ruled.map((one) => one.name)) })
          : null,
      );
      onClose();
    } catch (failure) {
      if (refusedFor(failure)) {
        setRefused(true);
        focusOn(box);
      } else if (failure instanceof ApiError && failure.is('meal_pick_ruled_out')) {
        const ids = (failure.problem.people ?? []).map((one) => one.id);
        setAsking(people.filter((one) => ids.includes(one.id)));
      } else {
        setError(t('eventMenu.failedSave', { button: t('seePicks.save') }));
        focusOn(saveButton);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setTicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog pk-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pk-who-title"
        aria-describedby="pk-who-help"
        tabIndex={-1}
      >
        <div className="dialog-heading">
          <h2 id="pk-who-title">{t('seePicks.whoTitle', { variant: row.name })}</h2>
          <p>{t('seePicks.whoSub', { dish: dishName, course: course.name })}</p>
          <p id="pk-who-help">{t('seePicks.whoHelp')}</p>
        </div>
        {refused ? (
          <p className="pk-refused" role="alert">
            <Triangle />
            {t('seePicks.refused')}
          </p>
        ) : (
          <div className="pk-form pk-who-list">
            {(picks.parties ?? []).map((party) => {
              const members = people.filter((one) => one.party === party.id);

              return (
                <fieldset key={party.id} className="pk-field">
                  <legend>
                    {t('seePicks.replied', { name: party.replier, count: members.length })}
                  </legend>
                  {members.map((person) => {
                    const ruled = ruledFor(person);
                    const leaving = holders.includes(person.id) && !ticked.has(person.id);
                    const lineId = `pk-who-${person.id}-line`;

                    return (
                      <div key={person.id} className="pk-tick">
                        <label className="pk-tick-name">
                          <input
                            id={`pk-who-${person.id}`}
                            type="checkbox"
                            checked={ticked.has(person.id)}
                            aria-describedby={ruled.length > 0 || leaving ? lineId : undefined}
                            onChange={() => toggle(person.id)}
                          />
                          {person.name}
                        </label>
                        {(ruled.length > 0 || leaving) && (
                          <span id={lineId} className="pk-tick-lines">
                            {ruled.length > 0 && (
                              <span className="pk-allergy">
                                <span className="pk-allergy-mark">
                                  <Triangle />
                                  {t('seePicks.allergyMark')}
                                </span>
                                {t('seePicks.ruledOutWho', {
                                  allergens: allergens(ruled),
                                  name: person.name,
                                })}
                              </span>
                            )}
                            {leaving && <span className="pk-leaving">{goesBack(person)}</span>}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </fieldset>
              );
            })}
            {error != null && (
              <p id="pk-who-error" className="pk-error" role="alert">
                <span className="pk-error-mark" aria-hidden="true">
                  !
                </span>
                {error}
              </p>
            )}
          </div>
        )}
        <div className="dialog-actions">
          {refused ? (
            <button type="button" className="gs-pill is-secondary" onClick={onClose}>
              {t('seePicks.close')}
            </button>
          ) : (
            <>
              <button type="button" className="desk-text pk-text" onClick={onClose}>
                {t('seePicks.cancel')}
              </button>
              <button
                ref={saveButton}
                type="button"
                className="gs-pill is-primary"
                aria-disabled={busy}
                onClick={() => void save(false)}
              >
                {t('seePicks.save')}
              </button>
            </>
          )}
        </div>
      </div>
      {asking != null && (
        <Override
          title={t('seePicks.overrideWhoTitle', {
            names: list(asking.map((one) => one.name)),
            variant: row.name,
          })}
          body={t('seePicks.overrideWhoBody', {
            lines: asking
              .map((one) =>
                t('seePicks.overrideWhoLine', {
                  variant: row.name,
                  allergens: allergens(ruledFor(one)),
                  name: one.name,
                }),
              )
              .join(' '),
          })}
          keep={t('seePicks.leaveOut')}
          go={t('seePicks.giveAnyway')}
          onKeep={() => {
            setTicked((now) => {
              const next = new Set(now);
              for (const one of asking) next.delete(one.id);
              return next;
            });
            setAsking(null);
            focusOn(saveButton);
          }}
          onGo={() => void save(true)}
        />
      )}
    </>
  );
}

function Triangle() {
  return (
    <svg className="pk-mark is-host" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M10 2.5 18.5 17h-17L10 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M10 8v4M10 14.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Star() {
  return (
    <svg className="pk-mark" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="m10 2.5 2.3 4.9 5.2.6-3.9 3.6 1.1 5.2L10 14.2l-4.7 2.6 1.1-5.2L2.5 8l5.2-.6L10 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CircleMinus() {
  return (
    <svg className="pk-mark" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 10h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Swap() {
  return (
    <svg className="pk-mark" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M4 7h11l-3-3M16 13H5l3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DashedCircle() {
  return (
    <svg className="pk-mark" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeDasharray="3 2.6"
      />
    </svg>
  );
}
