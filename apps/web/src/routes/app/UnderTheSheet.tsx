import { type ReactNode } from 'react';
import { type Location, type RouteObject, useLocation, useRoutes } from 'react-router';

import { PageUnderContext, underOf } from './pageUnder.ts';

export function PageUnder({ pages, children }: { pages: RouteObject[]; children: ReactNode }) {
  const under = underOf(useLocation());

  return under == null ? (
    children
  ) : (
    <Under pages={pages} under={under}>
      {children}
    </Under>
  );
}

function Under({
  pages,
  under,
  children,
}: {
  pages: RouteObject[];
  under: Location;
  children: ReactNode;
}) {
  return <PageUnderContext value={useRoutes(pages, under)}>{children}</PageUnderContext>;
}
