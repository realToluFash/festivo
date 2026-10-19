import { createBrowserRouter } from 'react-router';

import { Account } from './app/account/Account.tsx';
import { Security } from './app/account/Security.tsx';
import { AppLayout } from './app/AppLayout.tsx';
import { Dashboard } from './app/Dashboard.tsx';
import { General } from './app/settings/General.tsx';
import { Members } from './app/settings/Members.tsx';
import { Roles } from './app/settings/Roles.tsx';
import { SignInRules } from './app/settings/SignInRules.tsx';
import { GuestLayout } from './guest/GuestLayout.tsx';
import { Invitation } from './guest/Invitation.tsx';
import { ChangePhone } from './public/ChangePhone.tsx';
import { CompleteProfile } from './public/CompleteProfile.tsx';
import { ForgotPassword } from './public/ForgotPassword.tsx';
import { Home } from './public/Home.tsx';
import { Join } from './public/Join.tsx';
import { LostTwoFactor } from './public/LostTwoFactor.tsx';
import { NotFound } from './public/NotFound.tsx';
import { OAuthCallback } from './public/OAuthCallback.tsx';
import { RecoveryNotMe } from './public/RecoveryNotMe.tsx';
import { Register } from './public/Register.tsx';
import { ResetPassword } from './public/ResetPassword.tsx';
import { SignIn } from './public/SignIn.tsx';
import { TwoFactorAgain } from './public/TwoFactorAgain.tsx';
import { TwoFactorSignIn } from './public/TwoFactorSignIn.tsx';
import { VerifyEmail } from './public/VerifyEmail.tsx';
import { VerifyPhone } from './public/VerifyPhone.tsx';
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
  { path: '/sign-in/code', element: <TwoFactorSignIn /> },
  { path: '/two-factor/recovery', element: <LostTwoFactor /> },
  { path: '/two-factor/again', element: <TwoFactorAgain /> },
  { path: '/two-factor/not-me', element: <RecoveryNotMe /> },
  { path: '/register', element: <Register /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/oauth/google', element: <OAuthCallback provider="google" /> },
  { path: '/oauth/apple', element: <OAuthCallback provider="apple" /> },
  { path: '/verify-email', element: <VerifyEmail /> },
  { path: '/verify-phone', element: <VerifyPhone /> },
  { path: '/phone', element: <ChangePhone /> },
  { path: '/complete-profile', element: <CompleteProfile /> },
  { path: '/status', element: <Status /> },
  { path: '/join/:token', element: <Join /> },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'events', element: <Dashboard /> },
      { path: 'guests', element: <Dashboard /> },
      { path: 'account', element: <Account /> },
      { path: 'account/security', element: <Security /> },
      { path: 'settings', element: <General /> },
      { path: 'settings/members', element: <Members /> },
      { path: 'settings/roles', element: <Roles /> },
      { path: 'settings/sign-in-rules', element: <SignInRules /> },
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
