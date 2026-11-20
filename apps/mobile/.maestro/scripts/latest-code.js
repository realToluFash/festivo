/* global http, json, output, MAILPIT_URL, EMAIL, AFTER -- what Maestro's runScript provides */
// The newest six-digit code Mailpit holds for EMAIL, as output.code, for verify-email.yaml.
// AFTER, the count mail-count.js gave before the send, waits up to 30s for a newer message:
// read at once, an email still on its way left the previous code (sc-35231).
const query = `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`;
const before = typeof AFTER === 'undefined' || AFTER === '' ? -1 : Number(AFTER);
const deadline = Date.now() + 30000;
let found = json(http.get(query).body);
while (found.messages_count <= before && Date.now() < deadline) {
  found = json(http.get(query).body);
}
if (found.messages_count <= before) {
  throw new Error(`No new email reached ${EMAIL} in Mailpit (${MAILPIT_URL}) within 30s`);
}
const codes = found.messages.map((summary) => {
  const message = http.get(`${MAILPIT_URL}/api/v1/message/${summary.ID}`);
  return json(message.body).Text.match(/\b\d{6}\b/);
});
const newest = codes.find((code) => code !== null);
if (newest === undefined) {
  throw new Error(`No code reached ${EMAIL} in Mailpit (${MAILPIT_URL})`);
}

output.code = newest[0];
