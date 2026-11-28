/* global http, json, output, API_URL, WEB_URL, OWNER_EMAIL, OWNER_PASSWORD, EVENT_ID, ORG_ID, MEMBERSHIP_ID, ACTION -- what Maestro's runScript provides */
// A second session for checks/sc75689-*.yaml: the owner, on the API, takes MEMBERSHIP_ID off the event (remove), puts them back as Can edit (add), makes a fresh event with them on it, a waiting guest and a Reply by (fresh), or deletes the event (delete).
const login = http.post(`${API_URL}/api/auth/login`, {
  headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
  body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
});
const token = json(login.body).accessToken;
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Origin: WEB_URL,
};
const eventId = (typeof output.eventId === 'string' && output.eventId) || EVENT_ID;
if (ACTION === 'fresh') {
  const made = http.post(`${API_URL}/api/orgs/${ORG_ID}/events`, {
    headers,
    body: JSON.stringify({
      name: 'QA gone app',
      type: 'wedding',
      startsAt: '2027-06-12T14:00',
      endsAt: '2027-06-12T22:00',
      timeZone: 'Europe/London',
      currency: 'GBP',
    }),
  });
  const id = json(made.body).event.id;
  http.post(`${API_URL}/api/events/${id}/people`, {
    headers,
    body: JSON.stringify({ membershipId: MEMBERSHIP_ID, role: 'can_edit' }),
  });
  http.post(`${API_URL}/api/events/${id}/guests`, {
    headers,
    body: JSON.stringify({ fullName: 'Guest Waiting' }),
  });
  const read = http.get(`${API_URL}/api/events/${id}`, { headers });
  http.request(`${API_URL}/api/events/${id}`, {
    method: 'PATCH',
    headers: Object.assign({}, headers, { 'If-Match': read.headers.etag || read.headers.ETag }),
    body: JSON.stringify({ replyBy: '2027-06-05' }),
  });
  output.eventId = id;
} else if (ACTION === 'delete') {
  const gone = http.request(`${API_URL}/api/events/${eventId}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ name: 'QA gone app' }),
  });
  output.gone = gone.status;
} else if (ACTION === 'add') {
  const added = http.post(`${API_URL}/api/events/${eventId}/people`, {
    headers,
    body: JSON.stringify({ membershipId: MEMBERSHIP_ID, role: 'can_edit' }),
  });
  output.added = added.status;
} else if (ACTION === 'remove') {
  const people = json(http.get(`${API_URL}/api/events/${eventId}/people`, { headers }).body);
  const list = people.people || people.items || [];
  const mine = list.filter((p) => JSON.stringify(p).indexOf(MEMBERSHIP_ID) >= 0)[0];
  const removed = http.request(`${API_URL}/api/events/${eventId}/people/${mine.id}`, {
    method: 'DELETE',
    headers,
  });
  output.removed = removed.status;
}
