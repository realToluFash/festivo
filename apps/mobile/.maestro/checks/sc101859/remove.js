/* global http, json, output, API_URL, EVENT, TOKEN, WEB_ORIGIN, STEP, PREFIX -- what Maestro's runScript provides */
var base = API_URL + '/api/events/' + EVENT + '/staff';
var h = { Authorization: 'Bearer ' + TOKEN, Origin: WEB_ORIGIN };
if (STEP === 'pick') {
  var list = json(http.get(base, { headers: h }).body).staff;
  var one = list.filter(function (p) {
    return p.fullName.indexOf(PREFIX) === 0 && (PREFIX !== 'Markable' || p.link === 'copied');
  })[0];
  if (!one) throw new Error('no ' + PREFIX + ' person left');
  output.rid = one.id;
} else {
  var r = http.request(base + '/' + output.rid, { method: 'DELETE', headers: h });
  if (r.status >= 300) throw new Error('delete answered ' + r.status + ' ' + r.body);
}
