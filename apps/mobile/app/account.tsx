import { Redirect } from 'expo-router';

import { INTERIM_HREF } from '../src/kit/appNav.ts';

/** The interim screen's old path: a link to it opens its Settings page (sc-722). */
export default function InterimAccount() {
  return <Redirect href={INTERIM_HREF['/account']} />;
}
