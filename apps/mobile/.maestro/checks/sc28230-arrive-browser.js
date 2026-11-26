/* global http, output, API_URL, EV, TOK, GUEST -- what Maestro's runScript provides */
// sc-28230: the browser's door marks GUEST arrived while the app's Check-in is open.
const r = http.post(API_URL + '/api/events/' + EV + '/check-in/arrivals', {
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK },
  body: JSON.stringify({ guestId: GUEST }),
});
output.arrive = r.status + ' at ' + new Date().toISOString();
