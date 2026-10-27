/* global http, json, output, MAILPIT_URL, EMAIL -- what Maestro's runScript provides */
// The newest six-digit code Mailpit holds for EMAIL, as output.code, for verify-email.yaml.
const search = http.get(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`);
const codes = json(search.body).messages.map((found) => {
  const message = http.get(`${MAILPIT_URL}/api/v1/message/${found.ID}`);
  return json(message.body).Text.match(/\b\d{6}\b/);
});
const newest = codes.find((code) => code !== null);
if (newest === undefined) {
  throw new Error(`No code reached ${EMAIL} in Mailpit (${MAILPIT_URL})`);
}

output.code = newest[0];
