import { createContext, useContext } from 'react';
import { Link } from 'react-router';

import './seePicks.css';

import type { EvCourse } from './menuCourses.ts';
import {
  type PicksWorld,
  SW,
  header,
  menuFigures,
  needsHost,
  numberIn,
  picksAt,
  whoHasnt,
} from './seePicks.ts';

/** sc-3909 on the event's Menu: the picks on each dish row and variant inset, See picks on each course, and the summary beside the menu, all from See picks' figures. */
const Picked = createContext<PicksWorld | null>(null);

export const MenuPicksProvider = Picked.Provider;

function useFigure(id: string): { count: number; share: number } | null {
  const world = useContext(Picked);
  if (world == null) return null;

  return menuFigures(world).get(id) ?? { count: 0, share: 0 };
}

export function useHasPicks(): boolean {
  return useContext(Picked) != null;
}

export function DishPicks({ id }: { id: string }) {
  const figure = useFigure(id);
  if (figure == null) return null;

  return (
    <p className="pk-row-picks">
      {SW.menuPicks(figure.count, numberIn(figure.count), numberIn(figure.share))}
    </p>
  );
}

/** A variant's picks from See picks' figures, or null off the picks states, where sc-3903's sample count stands. */
export function useVariantPicks(id: string): { count: string; share: string } | null {
  const figure = useFigure(id);

  return figure == null
    ? null
    : { count: numberIn(figure.count), share: `${numberIn(figure.share)}%` };
}

export function SeePicksLink({ course }: { course: EvCourse }) {
  if (!useHasPicks() || course.dishes.length === 0) return null;

  return (
    <Link
      className="gs-pill is-secondary pk-see"
      to={`${picksAt('picks')}#pk-${course.id}`}
      aria-label={`${SW.title} · ${course.name}`}
    >
      {SW.title}
    </Link>
  );
}

export function PicksSummary() {
  const world = useContext(Picked);
  if (world == null) return null;
  const all = header(world);
  const host = needsHost(world).length;
  const waiting = whoHasnt(world).reduce((sum, one) => sum + one.people.length, 0);

  return (
    <aside className="desk-card pk-summary" aria-labelledby="pk-summary-title">
      <h2 id="pk-summary-title" className="pk-card-title">
        {SW.summaryTitle}
      </h2>
      <p className="pk-header">
        {SW.header(numberIn(all.answered), numberIn(all.room), numberIn(all.percent))}
      </p>
      <ul className="pk-lines">
        <li>{`${SW.needsHost} · ${numberIn(host)}`}</li>
        <li>{`${SW.whoHasnt} · ${numberIn(waiting)}`}</li>
      </ul>
      <p className="mn-quiet">{SW.closes}</p>
      <Link className="gs-pill is-primary pk-go" to={picksAt('picks')}>
        {SW.title}
      </Link>
    </aside>
  );
}
