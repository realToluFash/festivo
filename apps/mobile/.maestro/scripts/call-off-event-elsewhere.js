/* global http, json, output, API_URL, WEB_URL, EMAIL, PASSWORD, EVENT_ID -- what Maestro's runScript provides */
// A second session for checks/sc17437-resume-called-off.yaml: signs in on the API as the same person and calls off EVENT_ID, so the open page's Resume is refused.
const login = http.post(`${API_URL}/api/auth/login`, {
  headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const token = json(login.body).accessToken;
const ended = http.post(`${API_URL}/api/events/${EVENT_ID}/end`, {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Origin: WEB_URL,
  },
  body: '{}',
});
output.ended = ended.status;
