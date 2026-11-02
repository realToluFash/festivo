/* global http, json, API_URL, BTOKEN, EMAIL, ANSWER -- what Maestro's runScript provides */
// For getting-back-in-walk.yaml: the approver (BTOKEN) answers EMAIL's waiting recovery request with ANSWER, approve or turn-down.
const headers = { Authorization: `Bearer ${BTOKEN}` };
const listed = http.get(`${API_URL}/api/auth/recovery-requests`, { headers });
if (listed.status !== 200) {
  throw new Error(`Listing recovery requests answered ${listed.status}: ${listed.body}`);
}
const request = json(listed.body).requests.find(
  (row) => row.email.toLowerCase() === EMAIL.toLowerCase(),
);
if (request === undefined) {
  throw new Error(`No waiting recovery request for ${EMAIL} that BTOKEN's approver can answer`);
}
const answered = http.post(`${API_URL}/api/auth/recovery-requests/${request.id}/${ANSWER}`, {
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: '{}',
});
if (answered.status !== 204) {
  throw new Error(
    `Answering ${request.id} with ${ANSWER} answered ${answered.status}: ${answered.body}`,
  );
}
