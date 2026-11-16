/* global http, output, ORIGIN, TOKEN -- what Maestro's runScript provides */
var r = http.post(URL, {
  headers: { Authorization: 'Bearer ' + TOKEN, Origin: ORIGIN, 'Content-Type': 'application/json' },
  body: '{}',
});
output.replaced = r.status;
