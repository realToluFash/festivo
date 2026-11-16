/* global http, output, TARGET_URL, ORIGIN, TOKEN -- what Maestro's runScript provides */
// A second session for checks/sc55558q3-clearlive.yaml: as the host, with TOKEN, replaces the guest's link (POST TARGET_URL), so the open guest's flag clears live.
var r = http.post(TARGET_URL, {
  headers: { Authorization: 'Bearer ' + TOKEN, Origin: ORIGIN, 'Content-Type': 'application/json' },
  body: '{}',
});
output.replaced = r.status;
