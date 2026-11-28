/* global http, json, output, API_URL, OWNER_EMAIL, OWNER_PASSWORD, MODE, EV, Z_EMAIL -- what Maestro's runScript provides */
// sc-71337: the event's owner (OWNER_EMAIL) grants Z_EMAIL a view of EV, or revokes it, as MODE says.
const login = http.post(API_URL + '/api/auth/login', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
});
const token = json(login.body).accessToken;
const auth = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
if (MODE === 'grant') {
  const r = http.post(API_URL + '/api/events/' + EV + '/people', {
    headers: auth,
    body: JSON.stringify({ address: Z_EMAIL, role: 'can_view' }),
  });
  output.person = json(r.body).person.id;
  output.granted = r.status;
} else {
  const r = http.request(API_URL + '/api/events/' + EV + '/people/' + output.person, {
    method: 'DELETE',
    headers: auth,
  });
  output.revoked = r.status;
}
