/* global http, json, output, API_URL, OWNER_EMAIL, OWNER_PASSWORD, EV_TO, PERSON -- what Maestro's runScript provides */
// sc-68438: the owner of EV_TO revokes the grant PERSON on it while the member's list is open.
const login = http.post(API_URL + '/api/auth/login', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
});
const token = json(login.body).accessToken;
const r = http.request(API_URL + '/api/events/' + EV_TO + '/people/' + PERSON, {
  method: 'DELETE',
  headers: { Authorization: 'Bearer ' + token },
});
output.revoked = r.status;
