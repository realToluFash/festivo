/* global http, output, STOP_URL, TOKEN, ORIGIN */
if (STOP_URL !== 'none') {
  var r = http.post(STOP_URL, {
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      Authorization: 'Bearer ' + TOKEN,
    },
    body: '{}',
  });
  output.stopped = r.status;
}
