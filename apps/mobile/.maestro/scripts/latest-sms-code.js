/* global http, json, output, SMOCKER_URL, DIGITS -- what Maestro's runScript provides */
// The newest six-digit code Smocker received (WhatsApp or SMS), as output.code; DIGITS keeps only
// messages to that number. sc36468-fresh-phone.js reads Smocker the same way; change both together.
const MESSAGE_PATHS = [
  /^\/2010-04-01\/Accounts\/[^/]+\/Messages\.json$/,
  /^\/whatsapp\/v[\d.]+\/[^/]+\/messages$/,
];
const history = json(http.get(`${SMOCKER_URL}/history`).body);
const codes = history
  .filter((entry) => MESSAGE_PATHS.some((path) => path.test(entry.request.path)))
  .map((entry) => JSON.stringify(entry.request.body))
  .filter((body) => typeof DIGITS === 'undefined' || !DIGITS || body.includes(DIGITS))
  .map((body) => body.match(/\b\d{6}\b/))
  .filter((code) => code !== null);
if (codes.length === 0) {
  throw new Error(`No code reached Smocker (${SMOCKER_URL})`);
}
output.code = codes[codes.length - 1][0];
