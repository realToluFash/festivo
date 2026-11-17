/* global http, json, output, API, EV, GUEST, EMAIL, PASSWORD */
// Marks the guest Invited through the API, between typing the name and pressing Delete (sc-14445's race).
const login = http.post(API + '/api/auth/login', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const token = json(login.body).accessToken;
const r = http.put(API + '/api/events/' + EV + '/guests/' + GUEST + '/invitation', {
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: '{"how":"whatsapp"}',
});
output.mark = r.status;
