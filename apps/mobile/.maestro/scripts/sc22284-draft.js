/* global http, json, output, API_URL, EMAIL, PASSWORD, NAME */
// sc-22284: a new Draft with no host and an end still to come, in the account's first organisation, as output.event.
const headers = { 'Content-Type': 'application/json' };
const login = json(
  http.post(`${API_URL}/api/auth/login`, {
    headers,
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).body,
);
const auth = { ...headers, Authorization: `Bearer ${login.accessToken}` };
const org = json(http.get(`${API_URL}/api/orgs`, { headers: auth }).body).organisations[0].id;
const day = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
const made = http.post(`${API_URL}/api/orgs/${org}/events`, {
  headers: auth,
  body: JSON.stringify({
    name: NAME,
    type: 'party',
    startsAt: `${day}T18:00:00`,
    endsAt: `${day}T23:00:00`,
    hosts: [],
  }),
});
if (!made.ok) throw new Error(`draft not created: ${made.status} ${made.body}`);
output.event = json(made.body).event.id;
