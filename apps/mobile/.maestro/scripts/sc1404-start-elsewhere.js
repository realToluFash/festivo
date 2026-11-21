/* global http, output, API_URL, EVENT, ITEM, TOKEN -- what Maestro's runScript provides */
// sc-1404: starts ITEM on EVENT as a manager (TOKEN), the way another person's phone would.
const r = http.post(API_URL + '/api/events/' + EVENT + '/schedule/items/' + ITEM + '/start', {
  headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
  body: '{}',
});
output.started = r.status;
