/* global http, json, output, MAILPIT_URL, EMAIL -- what Maestro's runScript provides */
// The newest six-digit code Mailpit holds for EMAIL, as output.code, for verify-email.yaml.
const search = http.get(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`);
const newest = json(search.body).messages[0];
const message = http.get(`${MAILPIT_URL}/api/v1/message/${newest.ID}`);

output.code = json(message.body).Text.match(/\b\d{6}\b/)[0];
