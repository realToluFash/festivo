/* global http, json, output, API_URL, WEB_URL, EMAIL, PASSWORD, EVENT -- what Maestro's runScript provides */
// sc-29875: presses Done on the item that is Now in ${EVENT}'s running order, as another member would, from inside a flow.
const headers = { 'Content-Type': 'application/json', Origin: WEB_URL };
const login = http.post(API_URL + '/api/auth/login', {
  headers,
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
headers.Authorization = 'Bearer ' + json(login.body).accessToken;
const items = json(http.get(API_URL + '/api/events/' + EVENT + '/schedule', { headers }).body)
  .schedule.items;
const now = items.filter((item) => item.startedAt != null && item.endedAt == null)[0];
headers['Idempotency-Key'] = 'sc29875-' + Date.now();
const pressed = http.post(
  API_URL + '/api/events/' + EVENT + '/schedule/items/' + now.id + '/presses',
  { headers, body: JSON.stringify({ kind: 'done' }) },
);
output.pressed = pressed.status;
