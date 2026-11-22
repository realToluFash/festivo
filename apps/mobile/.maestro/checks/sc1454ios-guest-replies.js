/* global http, API_URL, WEB_URL, GUEST_TOKEN -- what Maestro's runScript provides */
// The guest replies from their own link while the organiser's Record reply sheet is open.
http.post(API_URL + '/api/guest-links/reply', {
  headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
  body: JSON.stringify({ token: GUEST_TOKEN, answer: 'coming' }),
});
