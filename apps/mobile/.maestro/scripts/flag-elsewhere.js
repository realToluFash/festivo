/* global http, output, ORIGIN, LINKTOKEN -- what Maestro's runScript provides */
// A second session for checks/sc55558q3-clearlive.yaml: as the guest, with LINKTOKEN, says the link reached the wrong person (POST URL), so the host's open guest shows the flag.
var r = http.post(URL, {
  headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: LINKTOKEN }),
});
output.flagged = r.status;
