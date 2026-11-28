/* global http, json, EMAIL, PASSWORD, API_URL, D -- what Maestro's runScript provides */
// sc-84453: delete event D from elsewhere while B is open over it.
var login = http.post(API_URL + '/api/auth/login', {
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'QA other device' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, refreshTokenIn: 'body' }),
});
if (!login.ok) throw new Error('sign-in elsewhere refused: ' + login.body);
var token = json(login.body).accessToken;
var del = http.request(API_URL + '/api/events/' + D, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ name: 'Oyo Picnic' }),
});
if (!del.ok) throw new Error('delete refused: ' + del.body);
