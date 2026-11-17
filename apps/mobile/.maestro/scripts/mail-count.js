/* global http, json, output, MAILPIT_URL, EMAIL -- what Maestro's runScript provides */
// How many emails Mailpit holds for EMAIL, as output.mailCount, for latest-code.js's AFTER.
const query = `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`;
output.mailCount = String(json(http.get(query).body).messages_count);
