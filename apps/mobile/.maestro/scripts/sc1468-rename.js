/* global http, json, API_URL, EMAIL, PASSWORD, EVENT -- what Maestro's runScript provides */
// For sc1468-delete-refused.yaml: renames EVENT under the open Delete event screen, so the old name typed there is refused.
const origin = { Origin: 'http://127.0.0.1:15173', 'Content-Type': 'application/json' };
const login = http.post(`${API_URL}/api/auth/login`, {
  headers: origin,
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (login.status !== 200) throw new Error(`Login answered ${login.status}: ${login.body}`);
const token = json(login.body).accessToken;
const current = http.get(`${API_URL}/api/events/${EVENT}`, {
  headers: { ...origin, Authorization: `Bearer ${token}` },
});
if (current.status !== 200) throw new Error(`Reading the event answered ${current.status}`);
const version = current.headers.etag || current.headers.ETag || current.headers['Etag'];
const renamed = http.request(`${API_URL}/api/events/${EVENT}`, {
  method: 'PATCH',
  headers: { ...origin, Authorization: `Bearer ${token}`, 'If-Match': version },
  body: JSON.stringify({ name: 'QA One Renamed' }),
});
if (renamed.status !== 200) throw new Error(`Renaming answered ${renamed.status}: ${renamed.body}`);
