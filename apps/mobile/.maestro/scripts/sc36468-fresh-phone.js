/* global http, json, output, EMAIL, PASSWORD, API_URL, MODE, FAIL -- what Maestro's runScript provides */
// MODE=alt adds an alternative number (output.phoneId); MODE=primary sets the primary one.
// FAIL=1 picks a number Smocker's sc-36468 mock refuses to text (+23480399…), for a failing Text it to me instead.
var base = { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:15173' };
var login = http.post(API_URL + '/api/auth/login', {
  headers: base,
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, refreshTokenIn: 'body' }),
});
if (!login.ok) throw new Error('sign-in refused: ' + login.body);
var auth = {
  'Content-Type': 'application/json',
  Origin: base.Origin,
  Authorization: 'Bearer ' + json(login.body).accessToken,
};
var meAnswer = http.get(API_URL + '/api/auth/me', { headers: auth });
if (!meAnswer.ok) throw new Error('profile refused: ' + meAnswer.body);
var phones = json(meAnswer.body).phoneNumbers || [];
for (var i = 0; i < phones.length; i++) {
  if (phones[i].primary) {
    if (MODE !== 'primary' && !phones[i].verified)
      throw new Error(
        'unverified primary ' +
          phones[i].id +
          ' would open from account.step before the added number',
      );
    continue;
  }
  var removed = http.request(API_URL + '/api/auth/phones/' + phones[i].id, {
    method: 'DELETE',
    headers: auth,
  });
  if (!removed.ok) throw new Error('number removal refused: ' + removed.body);
}
var tail = String(Date.now()).slice(-5);
var number = (FAIL === '1' ? '80399' : '80356') + tail;
var answer =
  MODE === 'primary'
    ? http.put(API_URL + '/api/auth/phone', {
        headers: auth,
        body: JSON.stringify({ countryCode: 'NG', number: number }),
      })
    : http.post(API_URL + '/api/auth/phones', {
        headers: auth,
        body: JSON.stringify({ countryCode: 'NG', number: number }),
      });
if (!answer.ok) throw new Error('number refused: ' + answer.body);
var body = json(answer.body);
output.phoneId = (body.phone || body).id;
