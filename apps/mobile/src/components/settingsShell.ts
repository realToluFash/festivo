import { createContext, type ReactNode, useContext } from 'react';

import type { SettingsSection } from '../kit/appNav.ts';
import { useLayout } from '../layout/useLayout.ts';
import type { CoverLayout, Tab } from './TodayCover.tsx';
import type { Tell } from './TodayParts.tsx';

/** Who is looking: an owner sees every section, a member their own, the organisation read only and Sign-in rules, and somebody with no organisation only their own. */
export type Viewer = 'owner' | 'member' | 'noOrg';

/** sc-29859 leaves no Roles section: what each role does is fixed. sc-30441 adds Personalisation, ahead of the app. */
export type ShellSection = Exclude<SettingsSection, 'roles'> | 'personalisation';

/** Who is looking, as the Settings card and the sidebar's foot show them: no role outside an organisation. */
export interface Looking {
  name: string;
  initials: string;
  email: string;
  role: string | null;
}

/** Who a Settings page is for and where its taps go, so one set of parts draws the demo and the app. */
export interface Shell {
  layout: CoverLayout;
  viewer: Viewer;
  looking: Looking;
  open: ShellSection | null;
  /** A state opens the section where a step on another page left off: Security's setup. */
  openSection: (section: ShellSection, state?: string) => void;
  toSettings: () => void;
  tell: Tell;
  onTab: (tab: Tab) => void;
  listColumn: ReactNode;
}

export const ShellContext = createContext<Shell | null>(null);

export function useShell(): Shell {
  const shell = useContext(ShellContext);
  if (shell == null) throw new Error('A Settings page is drawn inside a ShellContext.');

  return shell;
}

/** A phone, as the demo's shell draws it, or as the device is when the product draws the page with no shell. */
export function usePhone(): boolean {
  const shell = useContext(ShellContext);
  const { kind } = useLayout();

  return shell == null ? kind === 'phone' : shell.layout === 'phone';
}
