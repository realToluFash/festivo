/* global http, output, NET_URL -- what Maestro's runScript provides */
// For checks/sc58991-notcopied.yaml: asks a helper on the host to cut or restore the emulator's way to the API (NET_URL ends /offline or /online).
var r = http.get(NET_URL);
output.net = r.status;
