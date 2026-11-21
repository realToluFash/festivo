/* global http, json, output, API_URL, WEB_URL, EMAIL, PASSWORD, EVENT_ID -- what Maestro's runScript provides */
// Signs in on the API as the same person and resumes EVENT_ID, so a check that paused it puts it back whether it passed or failed.
const login = http.post(`${API_URL}/api/auth/login`, {
  headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const token = json(login.body).accessToken;
const resumed = http.post(`${API_URL}/api/events/${EVENT_ID}/resume`, {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Origin: WEB_URL,
  },
  body: '{}',
});
output.resumed = resumed.status;
