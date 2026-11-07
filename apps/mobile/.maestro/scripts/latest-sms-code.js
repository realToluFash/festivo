/* global http, json, output, SMOCKER_URL -- what Maestro's runScript provides */
// The newest six-digit code Smocker received (WhatsApp or SMS), as output.code.
const MESSAGE_PATHS = [
  /^\/2010-04-01\/Accounts\/[^/]+\/Messages\.json$/,
  /^\/whatsapp\/v[\d.]+\/[^/]+\/messages$/,
];
const history = json(http.get(`${SMOCKER_URL}/history`).body);
const codes = history
  .filter((entry) => MESSAGE_PATHS.some((path) => path.test(entry.request.path)))
  .map((entry) => JSON.stringify(entry.request.body).match(/\b\d{6}\b/))
  .filter((code) => code !== null);
if (codes.length === 0) {
  throw new Error(`No code reached Smocker (${SMOCKER_URL})`);
}
output.code = codes[codes.length - 1][0];
