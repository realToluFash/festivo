/* global http, json, output, SMOCKER_URL -- what Maestro's runScript provides */
// The newest six-digit code Smocker received (WhatsApp or SMS), as output.code.
const history = json(http.get(`${SMOCKER_URL}/history`).body);
const codes = history
  .map((entry) => JSON.stringify(entry).match(/\b\d{6}\b/))
  .filter((code) => code !== null);
if (codes.length === 0) {
  throw new Error(`No code reached Smocker (${SMOCKER_URL})`);
}
output.code = codes[codes.length - 1][0];
