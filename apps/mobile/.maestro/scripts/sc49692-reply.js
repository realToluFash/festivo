/* global http, output, API_URL, WEB_URL, GUEST_TOKEN -- what Maestro's runScript provides */
// For checks/sc49692-today-reply.yaml: a guest replies "coming" through their link, as a reply lands while Today is open.
const r = http.post(`${API_URL}/api/guest-links/reply`, {
  headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
  body: JSON.stringify({ token: GUEST_TOKEN, answer: 'coming' }),
});
output.replyStatus = r.status;
