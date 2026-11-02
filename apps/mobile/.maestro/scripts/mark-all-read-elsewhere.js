/* global http, json, output, API_URL, WEB_URL, EMAIL, PASSWORD -- what Maestro's runScript provides */
// A second session for checks/sc3980-live-read.yaml: signs in on the API as the same person and marks every item read, so the open bell must follow with no reload.
const login = http.post(`${API_URL}/api/auth/login`, {
  headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const token = json(login.body).accessToken;
const read = token
  ? http.post(`${API_URL}/api/notifications/read-all`, {
      headers: { Authorization: `Bearer ${token}`, Origin: WEB_URL },
    })
  : null;
output.readAll = read ? read.status : `no token on sign-in (${login.status})`;
