/* global http, json, API_URL, BTOKEN, ANSWER -- what Maestro's runScript provides */
// For getting-back-in-walk.yaml: the approver (BTOKEN) answers the newest waiting recovery request with ANSWER, approve or turn-down.
const list = json(
  http.get(`${API_URL}/api/auth/recovery-requests`, {
    headers: { Authorization: `Bearer ${BTOKEN}` },
  }).body,
);
const rows = list.requests || list;
http.post(`${API_URL}/api/auth/recovery-requests/${rows[0].id}/${ANSWER}`, {
  headers: { Authorization: `Bearer ${BTOKEN}`, 'Content-Type': 'application/json' },
  body: '{}',
});
