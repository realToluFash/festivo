/* global http, output, STOP_URL, TOKEN */
if (STOP_URL !== 'none') {
  var r = http.post(STOP_URL, {
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:15173',
      Authorization: 'Bearer ' + TOKEN,
    },
    body: '{}',
  });
  output.stopped = r.status;
}
