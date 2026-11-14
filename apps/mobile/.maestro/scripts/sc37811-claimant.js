/* global http, json, API_URL, WEB_URL, ORG, CLAIMANT_EMAIL, CLAIMANT_PASSWORD, ASK -- what Maestro's runScript provides */
// For checks/sc37811-claim-stop.yaml: CLAIMANT signs in, then withdraws their owner claim on ORG (ASK=withdraw) or makes a new one (ASK=claim).
const login = http.post(`${API_URL}/api/auth/login`, {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CLAIMANT_EMAIL, password: CLAIMANT_PASSWORD }),
});
const token = login.status === 200 ? json(login.body).accessToken : undefined;
if (token === undefined) {
  throw new Error(`Signing in ${CLAIMANT_EMAIL} answered ${login.status}: ${login.body}`);
}
const headers = { Authorization: `Bearer ${token}`, Origin: WEB_URL };
const answered =
  ASK === 'withdraw'
    ? http.post(`${API_URL}/api/orgs/${ORG}/owner-claim/withdraw`, { headers, body: '' })
    : http.post(`${API_URL}/api/orgs/${ORG}/owner-claim`, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{}',
      });
if (answered.status < 200 || answered.status > 299) {
  throw new Error(
    `${ASK} of ${CLAIMANT_EMAIL}'s claim on ${ORG} answered ${answered.status}: ${answered.body}`,
  );
}
