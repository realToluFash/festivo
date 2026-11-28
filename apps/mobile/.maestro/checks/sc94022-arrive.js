/* global http, output, API_URL, EV, TOK, GUEST, METHOD, ORIGIN -- what Maestro's runScript provides */
// sc-94022: another device marks GUEST arrived (METHOD POST) or undoes it (METHOD DELETE) while Today is open.
const path = '/api/events/' + EV + '/check-in/arrivals';
const r =
  METHOD === 'DELETE'
    ? http.request(API_URL + path + '/' + GUEST, {
        method: 'DELETE',
        headers: { Origin: ORIGIN, Authorization: 'Bearer ' + TOK },
      })
    : http.post(API_URL + path, {
        headers: {
          Origin: ORIGIN,
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + TOK,
        },
        body: JSON.stringify({ guestId: GUEST }),
      });
output.arrive = METHOD + ' ' + r.status + ' at ' + new Date().toISOString();
