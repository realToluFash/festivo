/* global http, json, EMAIL, PASSWORD, API_URL, EVENT, ITEM, KIND -- what Maestro's runScript provides */
// sc-33154: press an item's start or done from another device, timed 30 seconds ago, so a press the app has in flight loses.
var login = http.post(API_URL + '/api/auth/login', {
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'QA other device',
  },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, refreshTokenIn: 'body' }),
});
if (!login.ok) throw new Error('sign-in elsewhere refused: ' + login.body);
var token = json(login.body).accessToken;
var key = 'qa-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
var press = http.post(API_URL + '/api/events/' + EVENT + '/schedule/items/' + ITEM + '/presses', {
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
    'Idempotency-Key': key,
  },
  body: JSON.stringify({ kind: KIND, pressedAt: new Date(Date.now() - 30000).toISOString() }),
});
if (!press.ok) throw new Error('press elsewhere refused: ' + press.body);
