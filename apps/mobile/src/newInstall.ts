import { type Reload, forgetOnNewInstall, reloadAppAsync } from './colourScheme.ts';
import { takeHeldLink } from './heldLink.ts';
import { dropRecovery } from './heldRecovery.ts';
import { dropRegistration } from './pendingRegistration.ts';
import { tokens } from './tokens.ts';

type EndSession = (refreshToken: string) => Promise<void>;

// Loaded when it is needed: the API client's module needs the app's runtime.
const signOutKept: EndSession = (refreshToken) =>
  import('./api.ts').then(({ api }) => api.signOutKept(refreshToken));

/** How long a restart into the default colours waits for the old session to end: the restart would cut it off. */
const ENDING_MS = 3000;

/**
 * A reinstall is a new device (sc-511, sc-34831): the Keychain outlives an uninstall, so an install's first launch drops all it kept, before any screen shows, and ends the session it held where Soirely answers. Unanswered, that session lapses; it is never tried again.
 */
export async function startAfresh(
  newInstall: boolean,
  end: EndSession = signOutKept,
  reload: Reload = reloadAppAsync,
): Promise<void> {
  if (!newInstall) return;

  const kept = await tokens.refresh();
  await Promise.all([tokens.clear(), dropRegistration(), dropRecovery(), takeHeldLink()]);

  const ending = kept != null && kept !== '' ? end(kept).catch(() => {}) : Promise.resolve();

  await forgetOnNewInstall(true, undefined, (reason) =>
    within(ending, ENDING_MS).then(() => reload(reason)),
  );
}

function within(work: Promise<void>, ms: number): Promise<void> {
  return Promise.race([work, new Promise<void>((done) => setTimeout(done, ms))]);
}
