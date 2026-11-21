import { Navigate, createBrowserRouter } from 'react-router';

import { PageArrival } from '../components/PageArrival.tsx';
import { DemoRoute } from '../demo/DemoEntry.tsx';

import { Account } from './app/account/Account.tsx';
import { Security } from './app/account/Security.tsx';
import { NotificationSettings } from './app/account/NotificationSettings.tsx';
import { Personalisation } from './app/account/Personalisation.tsx';
import { AppLayout } from './app/AppLayout.tsx';
import { Calendar } from './app/calendar/Calendar.tsx';
import { MenuLibrary } from './app/menu/MenuLibrary.tsx';
import { EditRedirect } from './app/events/EditRedirect.tsx';
import {
  EventAreaPage,
  EventBudget,
  EventGuests,
  EventDates,
  EventPeoplePage,
  EventJobsShifts,
  EventRoster,
  EventRun,
  EventStaff,
  EventStations,
  EventView,
} from './app/events/EventView.tsx';
import { Events } from './app/events/Events.tsx';
import { NewEvent } from './app/events/NewEvent.tsx';
import { AuditLog } from './app/settings/AuditLog.tsx';
import { DataAndControl } from './app/settings/DataAndControl.tsx';
import { EmailDomains } from './app/settings/EmailDomains.tsx';
import { ExportAllData } from './app/settings/ExportAllData.tsx';
import { General } from './app/settings/General.tsx';
import { Members } from './app/settings/Members.tsx';
import { PaymentReminders } from './app/settings/PaymentReminders.tsx';
import { SignInRules } from './app/settings/SignInRules.tsx';
import { Vendors } from './app/settings/Vendors.tsx';
import { SettingsDesk } from './app/SettingsDesk.tsx';
import { SignedInHome } from './app/Today.tsx';
import { GuestLayout } from './guest/GuestLayout.tsx';
import { Invitation } from './guest/Invitation.tsx';
import { RoomScreenPage } from './screen/RoomScreen.tsx';
import { StaffLinkPage } from './public/StaffLink.tsx';
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
 *   /s/:tok  a room screen — a TV or projector, shown what guests see (sc-3897)
 *
 * Separated structurally because the alternative is one tree with conditions in
 * it, and a condition is something that can be forgotten on a new route. A
 * guest route under `/app` would inherit a shell built for an organisation
 * member and would look authenticated.
 *
 * `/app/guests` opens Today until the Guests epic gives the web a page of its
 * own (sc-39509): an old link still lands somewhere.
 */
export const routes = [
  {
    element: <PageArrival />,
    children: [
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
          { index: true, element: <SignedInHome /> },
          { path: 'events', element: <Events /> },
          { path: 'events/new', element: <NewEvent /> },
          { path: 'events/:eventId', element: <EventView /> },
          { path: 'events/:eventId/edit', element: <EditRedirect /> },
          { path: 'events/:eventId/guests', element: <EventGuests /> },
          { path: 'events/:eventId/dates', element: <EventDates /> },
          { path: 'events/:eventId/people', element: <EventPeoplePage /> },
          { path: 'events/:eventId/staff', element: <EventStaff /> },
          { path: 'events/:eventId/staff/roster', element: <EventRoster /> },
          { path: 'events/:eventId/staff/jobs', element: <EventJobsShifts /> },
          { path: 'events/:eventId/staff/stations', element: <EventStations /> },
          { path: 'events/:eventId/run', element: <EventRun /> },
          { path: 'events/:eventId/budget/*', element: <EventBudget /> },
          { path: 'events/:eventId/:area', element: <EventAreaPage /> },
          { path: 'calendar', element: <Calendar /> },
          { path: 'menu-library', element: <MenuLibrary /> },
          { path: 'guests', element: <Navigate to="/app" replace /> },
          {
            element: <SettingsDesk />,
            children: [
              { path: 'account', element: <Account /> },
              { path: 'account/security', element: <Security /> },
              { path: 'account/notifications', element: <NotificationSettings /> },
              { path: 'account/personalisation', element: <Personalisation /> },
              { path: 'settings', element: <General /> },
              { path: 'settings/members', element: <Members /> },
              { path: 'settings/sign-in-rules', element: <SignInRules /> },
              { path: 'settings/vendors', element: <Vendors /> },
              { path: 'settings/vendors/payment-reminders', element: <PaymentReminders /> },
              { path: 'settings/data-and-control', element: <DataAndControl /> },
              { path: 'settings/data-and-control/export', element: <ExportAllData /> },
              { path: 'settings/data-and-control/email-domains', element: <EmailDomains /> },
              { path: 'settings/data-and-control/audit-log', element: <AuditLog /> },
            ],
          },
        ],
      },
      {
        path: '/i/:token',
        element: <GuestLayout />,
        children: [{ index: true, element: <Invitation /> }],
      },
      { path: '/s/:token', element: <RoomScreenPage /> },
      { path: '/w/:token', element: <StaffLinkPage /> },
      { path: '/demo/*', element: <DemoRoute /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
