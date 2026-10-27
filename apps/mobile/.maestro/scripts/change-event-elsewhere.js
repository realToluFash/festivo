/* global http, json, output, API_URL, WEB_URL, EMAIL, PASSWORD, EVENT_ID, ELSEWHERE_NAME -- what Maestro's runScript provides */
// A second session for checks/sc3595-edit.yaml: signs in on the API as the same person and renames EVENT_ID, so the open form's tag is stale.
const login = http.post(`${API_URL}/api/auth/login`, {
  headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const token = json(login.body).accessToken;
const read = http.get(`${API_URL}/api/events/${EVENT_ID}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const tag =
  (read.headers && (read.headers.etag || read.headers.ETag || read.headers.Etag)) || '"1"';
const changed = http.request(`${API_URL}/api/events/${EVENT_ID}`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'If-Match': tag,
  },
  body: JSON.stringify({ name: ELSEWHERE_NAME }),
});
output.changed = changed.status;
