/* global http, output, API_URL, EV, OWNER_TOKEN, ORIGIN -- what Maestro's runScript provides */
var r = http.post(API_URL + '/api/events/' + EV + '/end', {
  headers: {
    Authorization: 'Bearer ' + OWNER_TOKEN,
    'Content-Type': 'application/json',
    Origin: ORIGIN,
  },
  body: '{}',
});
output.ended = r.status;
