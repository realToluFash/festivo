/*
 * A throwaway account for QA, registered through the API as a person would be.
 * Addresses are `@soirely.test`, which can never be delivered to.
 *
 *   node scripts/qa-account.mjs                      register a new account
 *   node scripts/qa-account.mjs --json               the same, as JSON
 *   node scripts/qa-account.mjs --sign-in <address>  sign an existing one in
 *   node scripts/qa-account.mjs --mail <address>     what was emailed to it
 */
const API = process.env.SOIRELY_API_URL ?? 'http://localhost:8080';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

const args = process.argv.slice(2);
const asJson = args.includes('--json');

const signIn = valueOf('--sign-in');
const mailFor = valueOf('--mail');

try {
  if (mailFor != null) {
    await report(await mail(mailFor));
  } else if (signIn != null) {
    await report(await session(signIn, valueOf('--password') ?? passwordFor(signIn)));
  } else {
    await report(await register());
  }
} catch (error) {
  process.stderr.write(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

async function register() {
  const stamp = Date.now();
  const email = valueOf('--email') ?? `qa-${stamp}@soirely.test`;
  const password = valueOf('--password') ?? passwordFor(email);
  const name = valueOf('--name') ?? 'QA Tester';

  const body = await call('/api/auth/register', { email, name, password });

  return {
    what: 'registered',
    email,
    password,
    name,
    accountId: body.user?.id,
    verified: body.user?.emailVerified,
    complete: body.user?.profileComplete,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    sessionId: body.sessionId,
  };
}

async function session(email, password) {
  const body = await call('/api/auth/login', { email, password });

  return {
    what: 'signed in',
    email,
    password,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    sessionId: body.sessionId,
  };
}

/** Nothing in this API sends mail yet — sc-56 — so this answers with nothing today. */
async function mail(address) {
  const response = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
  );

  if (!response.ok) {
    throw new Error(`Mailpit answered ${response.status}. Is the stack up? (just up)`);
  }

  const { messages = [] } = await response.json();
  const newest = messages[0];

  if (newest == null) return { what: 'nothing was emailed', email: address, inbox: MAILPIT };

  const full = await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`).then((r) => r.json());

  return {
    what: 'emailed',
    email: address,
    subject: full.Subject,
    sentAt: newest.Created,
    text: (full.Text ?? '').trim(),
  };
}

async function call(path, payload) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Soirely-QA/1.0 (scripts/qa-account.mjs)',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = body?.detail ?? body?.title ?? response.statusText;

    throw new Error(`${path} answered ${response.status}: ${detail}`);
  }

  return body;
}

/** Deterministic, so an account can be signed into again. */
function passwordFor(email) {
  return `qa-${email.split('@')[0]}-password`;
}

function valueOf(flag) {
  const at = args.indexOf(flag);

  return at === -1 ? null : (args[at + 1] ?? null);
}

async function report(result) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

    return;
  }

  process.stdout.write(`\n▸ ${result.what}\n\n`);

  for (const [key, value] of Object.entries(result)) {
    if (key === 'what' || value == null) continue;

    process.stdout.write(`  ${key.padEnd(13)} ${String(value)}\n`);
  }

  process.stdout.write('\n');
}
