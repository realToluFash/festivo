import { Outlet, useParams } from 'react-router';

import { Brand } from '../../components/Brand.tsx';
import { LanguagePicker } from '../../components/LanguagePicker.tsx';
import { InvalidInvitation } from './InvalidInvitation.tsx';

/**
 * The guest tree, and the one that has to work for somebody with no account.
 *
 * A separate layout rather than a variant of the signed-in shell, so there is
 * no navigation to an application a guest cannot reach and no organisation
 * switcher for an organisation they are not in. The route shape says the same
 * thing: `/i/:token`, not `/app/...`.
 *
 * The token is checked for SHAPE here only. Whether it is a real, unexpired
 * invitation is the API's answer, and Guests owns the call that asks — what
 * matters at the shell level is that a malformed link renders a page saying so
 * rather than a crash or a blank screen.
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;

export function GuestLayout() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="guest">
      <header className="public-header">
        <Brand />
        <LanguagePicker />
      </header>

      {token == null || !TOKEN_SHAPE.test(token) ? <InvalidInvitation /> : <Outlet />}
    </div>
  );
}
