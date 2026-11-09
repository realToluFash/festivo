/* global http, EMAIL, PASSWORD, API_URL, OTHERS, WAIT_MS -- what Maestro's runScript provides */
// sc-23422: sign the account in elsewhere OTHERS times, then let the app's access token run out for WAIT_MS.
for (var i = 0; i < Number(OTHERS || 0); i++) {
  var response = http.post(API_URL + '/api/auth/login', {
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'QA other device ' + (i + 1) },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, refreshTokenIn: 'body' }),
  });
  if (!response.ok) throw new Error('sign-in elsewhere refused: ' + response.body);
}
var until = Date.now() + Number(WAIT_MS || 0);
while (Date.now() < until) {
  // runScript has no sleep
}
