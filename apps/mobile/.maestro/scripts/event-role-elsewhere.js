/* global http, json, output, API_URL, WEB_URL, OWNER_EMAIL, OWNER_PASSWORD, EVENT_ID, PERSON_ID, ROLE -- what Maestro's runScript provides */
// A second session for checks/sc49861-*.yaml: the owner, signed in on the API, gives PERSON_ID the role ROLE on EVENT_ID, so an open part's Save meets the new role.
const login = http.post(`${API_URL}/api/auth/login`, {
  headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
  body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
});
const token = json(login.body).accessToken;
const changed = http.request(`${API_URL}/api/events/${EVENT_ID}/people/${PERSON_ID}`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Origin: WEB_URL,
  },
  body: JSON.stringify({ role: ROLE }),
});
output.role = changed.status;
