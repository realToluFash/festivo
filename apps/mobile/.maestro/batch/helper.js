/* global http, json, output, HELPER_URL, ASK -- what Maestro's runScript provides */
// Asks the harness (qa-env.mjs batch) for ${ASK}, again while it answers wait, and leaves
// its answer in output.helper. A two-factor code can be up to a step away.
var answer = null;
for (var i = 0; i < 12 && answer === null; i++) {
  var response = http.get(HELPER_URL + ASK);
  if (!response.ok) throw new Error('the harness refused ' + ASK + ': ' + response.body);
  var body = json(response.body);
  if (!body.wait) answer = body;
}
if (answer === null) throw new Error('the harness never answered ' + ASK);
output.helper = answer;
