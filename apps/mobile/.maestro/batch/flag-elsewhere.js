/* global http, output, ORIGIN, LINKTOKEN -- what Maestro's runScript provides */
var r = http.post(URL, {
  headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: LINKTOKEN }),
});
output.flagged = r.status;
