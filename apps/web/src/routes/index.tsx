import { createBrowserRouter } from 'react-router';

import { RequirePermission } from '../components/RequirePermission.tsx';
import { Security } from './app/account/Security.tsx';
import { AppLayout } from './app/AppLayout.tsx';
import { Dashboard } from './app/Dashboard.tsx';
import { GuestLayout } from './guest/GuestLayout.tsx';
import { Invitation } from './guest/Invitation.tsx';
import { Home } from './public/Home.tsx';
import { NotFound } from './public/NotFound.tsx';
import { SignIn } from './public/SignIn.tsx';
import { VerifyEmail } from './public/VerifyEmail.tsx';
import { Status } from './public/Status.tsx';

/**
 * Three audiences, separated in the tree rather than by a flag.
 *
 *   /        public — anybody, no account, no authentication
 *   /app     the product — signed in, scoped to an organisation
 *   /i/:tok  a guest — reached by an invitation, will never install anything
 *
 * Separated structurally because the alternative is one tree with conditions in
 * it, and a condition is something that can be forgotten on a new route. A
 * guest route under `/app` would inherit a shell built for an organisation
 * member and would look authenticated.
 *
 * `/app/events` and the rest resolve to the dashboard for now. The screens
 * belong to the scopes that own them; what belongs here is that the navigation
 * does not lead anywhere blank.
 */
export const routes = [
  { path: '/', element: <Home /> },
  { path: '/sign-in', element: <SignIn /> },
  { path: '/verify-email', element: <VerifyEmail /> },
  { path: '/status', element: <Status /> },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'events', element: <Dashboard /> },
      { path: 'guests', element: <Dashboard /> },
      { path: 'account/security', element: <Security /> },
      // Gated on a permission the stand-in session does not carry, so the
      // refused page is reachable by clicking rather than only in a test.
      {
        path: 'settings',
        element: (
          <RequirePermission permission="organisation.manage">
            <Dashboard />
          </RequirePermission>
        ),
      },
    ],
  },
  {
    path: '/i/:token',
    element: <GuestLayout />,
    children: [{ index: true, element: <Invitation /> }],
  },
  { path: '*', element: <NotFound /> },
];

export const router = createBrowserRouter(routes);
