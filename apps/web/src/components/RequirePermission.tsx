import type { ReactNode } from 'react';

import { can, useSession } from '../session.ts';
import { Forbidden } from '../routes/app/Forbidden.tsx';

/**
 * A page the signed-in person lacks permission for shows a real page.
 *
 * Not a redirect, which on a shared link produces a loop nobody can read, and
 * not a blank area, which looks like a failed load. The refused page says what
 * happened and who can change it.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const session = useSession();

  return can(session, permission) ? <>{children}</> : <Forbidden permission={permission} />;
}
