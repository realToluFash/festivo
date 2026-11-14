/* global http, json, output, API_URL, WEB_URL, EMAIL, PASSWORD, EVENT_ID, ELSEWHERE_NAME -- what Maestro's runScript provides */
// A second session for checks/sc44741-draft-live.yaml: signs in as the same person, renames the Draft EVENT_ID to ELSEWHERE_NAME, then makes it live, under the app's open plain Delete question.
const login = http.post(`${API_URL}/api/auth/login`, {
  headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const token = json(login.body).accessToken;
const read = http.get(`${API_URL}/api/events/${EVENT_ID}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const tag = read.headers && (read.headers.etag || read.headers.ETag || read.headers.Etag);
const renamed =
  tag &&
  http.request(`${API_URL}/api/events/${EVENT_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'If-Match': Array.isArray(tag) ? tag[0] : tag,
    },
    body: JSON.stringify({ name: ELSEWHERE_NAME }),
  });
const live = http.post(`${API_URL}/api/events/${EVENT_ID}/make-live`, {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Origin: WEB_URL,
  },
  body: '{}',
});
output.changed = renamed ? `${renamed.status}/${live.status}` : `no ETag on GET (${read.status})`;
