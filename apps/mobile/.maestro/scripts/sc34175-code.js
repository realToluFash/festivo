/* global http, json, output, MAILPIT_URL, SMOCKER_URL, ALT -- what Maestro's runScript provides */
// sc-34175: the newest code for ALT, from Mailpit when ALT is an address, else from Smocker.
if (ALT.includes('@')) {
  const search = http.get(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${ALT}`)}`);
  const id = json(search.body).messages[0].ID;
  output.code = json(http.get(`${MAILPIT_URL}/api/v1/message/${id}`).body).Text.match(
    /\b\d{6}\b/,
  )[0];
} else {
  const codes = json(http.get(`${SMOCKER_URL}/history`).body)
    .map((entry) => JSON.stringify(entry.request.body).match(/\b\d{6}\b/))
    .filter((code) => code !== null);
  output.code = codes[codes.length - 1][0];
}
