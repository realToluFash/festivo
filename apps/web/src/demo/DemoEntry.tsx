import { Suspense, lazy } from 'react';
import { Link, useLocation } from 'react-router';

import { config } from '../config.ts';
import { NotFound } from '../routes/public/NotFound.tsx';
import { demoOpens } from './gate.ts';

const Demo = lazy(() => import('./Demo.tsx'));

export function DemoLink() {
  const { pathname, search } = useLocation();

  if (!demoOpens(config().environment)) return null;

  return (
    <p className="demo-way-in">
      <Link className="link-button" to="/demo" state={{ from: pathname + search }}>
        Design demo
      </Link>
    </p>
  );
}

export function DemoRoute() {
  if (!demoOpens(config().environment)) return <NotFound />;

  return (
    <Suspense fallback={null}>
      <Demo />
    </Suspense>
  );
}
