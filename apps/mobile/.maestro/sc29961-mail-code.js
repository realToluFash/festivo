/* global http, json, output, MAILPIT_URL, EMAIL -- what Maestro's runScript provides */
// sc-29961: the 6-digit code in the newest email to ${EMAIL}, read from Mailpit, in output.mail.code.
var list = json(
  http.get(MAILPIT_URL + '/api/v1/search?limit=1&query=' + encodeURIComponent('to:' + EMAIL)).body,
);
var message = json(http.get(MAILPIT_URL + '/api/v1/message/' + list.messages[0].ID).body);
var found = message.Text.match(/\b\d{6}\b/);
if (!found)
  throw new Error('no code in the newest email to ' + EMAIL + ': ' + list.messages[0].Subject);
output.mail = { code: found[0] };
